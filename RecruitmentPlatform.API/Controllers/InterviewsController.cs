using System.Security.Claims;
using System.Web;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruitmentPlatform.API.Models.DTOs;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;
using RecruitmentPlatform.API.Services;

namespace RecruitmentPlatform.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    /// <summary>
/// Manages interview scheduling, status updates, feedback recording, and candidate notifications.
/// Automatically transitions application stages and generates Google/Outlook calendar integration links.
/// </summary>
    public class InterviewsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly INotificationService _notificationService;
        private readonly IAuditService _auditService;

        public InterviewsController(
            IUnitOfWork unitOfWork,
            UserManager<ApplicationUser> userManager,
            INotificationService notificationService,
            IAuditService auditService)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
            _notificationService = notificationService;
            _auditService = auditService;
        }

        private string CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

        /// <summary>Recruiter/HiringManager/Admin: schedule an interview for an
        /// application. Advances the application to "InterviewScheduled" if it
        /// hasn't progressed further already, and returns Outlook/Google
        /// "add to calendar" links for the interviewer.</summary>
        [HttpPost]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> Schedule([FromBody] CreateInterviewDto dto)
        {
            var application = await _unitOfWork.JobApplications.Query()
                .Include(a => a.JobPosting)
                .Include(a => a.CandidateProfile).ThenInclude(c => c.User)
                .SingleOrDefaultAsync(a => a.Id == dto.JobApplicationId);

            if (application is null) return NotFound("Application not found.");

            var interviewerUserId = string.IsNullOrWhiteSpace(dto.InterviewerUserId) ? CurrentUserId : dto.InterviewerUserId;
            var interviewer = await _userManager.FindByIdAsync(interviewerUserId);
            if (interviewer is null) return BadRequest("Interviewer not found.");

            var interview = new Interview
            {
                JobApplicationId = application.Id,
                InterviewerUserId = interviewerUserId,
                ScheduledAt = dto.ScheduledAt,
                DurationMinutes = dto.DurationMinutes,
                Location = dto.Location,
                CalendarProvider = dto.CalendarProvider,
                Status = InterviewStatus.Scheduled
            };

            await _unitOfWork.Interviews.AddAsync(interview);

            if (application.Status < ApplicationStatus.InterviewScheduled)
            {
                application.Status = ApplicationStatus.InterviewScheduled;
                _unitOfWork.JobApplications.Update(application);
            }

            var when = dto.ScheduledAt.ToLocalTime().ToString("f");
            await _notificationService.NotifyAsync(
                application.CandidateProfile.UserId,
                "Interview scheduled",
                $"An interview for \"{application.JobPosting?.Title}\" has been scheduled for {when}.");

            if (interviewerUserId != CurrentUserId)
            {
                await _notificationService.NotifyAsync(
                    interviewerUserId,
                    "You've been assigned an interview",
                    $"You're interviewing a candidate for \"{application.JobPosting?.Title}\" on {when}.");
            }

            await _auditService.LogAsync(CurrentUserId, "InterviewScheduled", "Interview", null, $"Application #{application.Id}");

            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetForApplication), new { jobApplicationId = application.Id },
                ToDto(interview, application, interviewer));
        }

        /// <summary>Recruiter/HiringManager/Admin: list interviews for a specific application.</summary>
        [HttpGet]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> GetForApplication([FromQuery] int jobApplicationId)
        {
            var interviews = await LoadQuery()
                .Where(i => i.JobApplicationId == jobApplicationId)
                .OrderBy(i => i.ScheduledAt)
                .ToListAsync();

            return Ok(interviews.Select(i => ToDto(i, i.JobApplication, i.InterviewerUser)));
        }

        /// <summary>Recruiter/HiringManager: "my interviews" — everything the
        /// current user is the assigned interviewer for, soonest first.</summary>
        [HttpGet("me")]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> GetMine()
        {
            var interviews = await LoadQuery()
                .Where(i => i.InterviewerUserId == CurrentUserId)
                .OrderBy(i => i.ScheduledAt)
                .ToListAsync();

            return Ok(interviews.Select(i => ToDto(i, i.JobApplication, i.InterviewerUser)));
        }

        /// <summary>Recruiter/HiringManager/Admin: reschedule, cancel, or record
        /// interview feedback and a score.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateInterviewDto dto)
        {
            var interview = await LoadQuery().SingleOrDefaultAsync(i => i.Id == id);
            if (interview is null) return NotFound();

            if (dto.ScheduledAt.HasValue) interview.ScheduledAt = dto.ScheduledAt.Value;
            if (dto.DurationMinutes.HasValue) interview.DurationMinutes = dto.DurationMinutes.Value;
            if (dto.Location is not null) interview.Location = dto.Location;
            if (dto.Status.HasValue) interview.Status = dto.Status.Value;
            if (dto.Feedback is not null) interview.Feedback = dto.Feedback;
            if (dto.Score.HasValue) interview.Score = dto.Score.Value;

            _unitOfWork.Interviews.Update(interview);
            await _unitOfWork.SaveChangesAsync();

            return Ok(ToDto(interview, interview.JobApplication, interview.InterviewerUser));
        }

        private IQueryable<Interview> LoadQuery() =>
            _unitOfWork.Interviews.Query()
                .Include(i => i.InterviewerUser)
                .Include(i => i.JobApplication).ThenInclude(a => a.JobPosting)
                .Include(i => i.JobApplication).ThenInclude(a => a.CandidateProfile).ThenInclude(c => c.User);

        private static InterviewDto ToDto(Interview i, JobApplication application, ApplicationUser interviewer)
        {
            var end = i.ScheduledAt.AddMinutes(i.DurationMinutes);
            var subject = $"Interview: {application.CandidateProfile?.User?.FirstName} {application.CandidateProfile?.User?.LastName} — {application.JobPosting?.Title}";
            var details = $"Interview for the {application.JobPosting?.Title} position via Talent Bridge.";

            return new InterviewDto
            {
                Id = i.Id,
                JobApplicationId = i.JobApplicationId,
                JobTitle = application.JobPosting?.Title ?? string.Empty,
                CandidateName = $"{application.CandidateProfile?.User?.FirstName} {application.CandidateProfile?.User?.LastName}".Trim(),
                InterviewerUserId = i.InterviewerUserId,
                InterviewerName = $"{interviewer.FirstName} {interviewer.LastName}".Trim(),
                ScheduledAt = i.ScheduledAt,
                DurationMinutes = i.DurationMinutes,
                Location = i.Location,
                Status = i.Status.ToString(),
                Feedback = i.Feedback,
                Score = i.Score,
                GoogleCalendarLink = BuildGoogleCalendarLink(subject, details, i.Location, i.ScheduledAt, end),
                OutlookCalendarLink = BuildOutlookCalendarLink(subject, details, i.Location, i.ScheduledAt, end)
            };
        }

        private static string BuildGoogleCalendarLink(string subject, string details, string? location, DateTime start, DateTime end)
        {
            var dates = $"{start.ToUniversalTime():yyyyMMddTHHmmssZ}/{end.ToUniversalTime():yyyyMMddTHHmmssZ}";
            return "https://calendar.google.com/calendar/render?action=TEMPLATE" +
                   $"&text={HttpUtility.UrlEncode(subject)}" +
                   $"&dates={dates}" +
                   $"&details={HttpUtility.UrlEncode(details)}" +
                   $"&location={HttpUtility.UrlEncode(location ?? string.Empty)}";
        }

        private static string BuildOutlookCalendarLink(string subject, string details, string? location, DateTime start, DateTime end)
        {
            return "https://outlook.office.com/calendar/0/deeplink/compose?path=%2Fcalendar%2Faction%2Fcompose&rru=addevent" +
                   $"&subject={HttpUtility.UrlEncode(subject)}" +
                   $"&startdt={start.ToUniversalTime():o}" +
                   $"&enddt={end.ToUniversalTime():o}" +
                   $"&body={HttpUtility.UrlEncode(details)}" +
                   $"&location={HttpUtility.UrlEncode(location ?? string.Empty)}";
        }
    }
}
