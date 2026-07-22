using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
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
/// Manages candidate job applications across their lifecycle.
/// Supports candidate submission/withdrawal and recruiter/hiring manager review pipelines, 
/// candidate-job match scoring, and automated candidate notifications.
/// </summary>
    public class ApplicationsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMatchingService _matchingService;
        private readonly IAuditService _auditService;
        private readonly INotificationService _notificationService;

        public ApplicationsController(
            IUnitOfWork unitOfWork,
            IMatchingService matchingService,
            IAuditService auditService,
            INotificationService notificationService)
        {
            _unitOfWork = unitOfWork;
            _matchingService = matchingService;
            _auditService = auditService;
            _notificationService = notificationService;
        }

        private string CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

        /// <summary>Candidate: apply to an open job posting.</summary>
        [HttpPost]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> Create([FromBody] CreateApplicationDto dto)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound("Candidate profile not found for this account.");

            var posting = await _unitOfWork.JobPostings.GetByIdAsync(dto.JobPostingId);
            if (posting is null) return NotFound("Job posting not found.");
            if (posting.Status != JobPostingStatus.Open) return BadRequest("This job posting is not open for applications.");

            var alreadyApplied = await _unitOfWork.JobApplications.SingleOrDefaultAsync(a =>
                a.JobPostingId == dto.JobPostingId && a.CandidateProfileId == profile.Id);
            if (alreadyApplied is not null) return Conflict("You have already applied to this job posting.");

            var application = new JobApplication
            {
                JobPostingId = dto.JobPostingId,
                CandidateProfileId = profile.Id,
                CoverLetter = dto.CoverLetter,
                Status = ApplicationStatus.Submitted,
                // AI-powered candidate-job matching: scored at application time
                // so recruiters can immediately rank/screen the pipeline.
                MatchScore = _matchingService.ComputeMatchScore(profile.Skills, posting.RequiredSkills)
            };

            await _unitOfWork.JobApplications.AddAsync(application);
            await _auditService.LogAsync(CurrentUserId, "ApplicationSubmitted", "JobApplication", null, $"Job posting #{dto.JobPostingId}");
            await _unitOfWork.SaveChangesAsync();

            var reloaded = await LoadById(application.Id);
            return CreatedAtAction(nameof(GetById), new { id = application.Id }, ToDto(reloaded!));
        }

        /// <summary>Candidate: application tracking dashboard - all of their own applications.</summary>
        [HttpGet("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> GetMyApplications()
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound();

            var applications = await _unitOfWork.JobApplications.Query()
                .Include(a => a.JobPosting)
                .Include(a => a.CandidateProfile).ThenInclude(c => c.User)
                .Include(a => a.Interviews)
                .Where(a => a.CandidateProfileId == profile.Id)
                .OrderByDescending(a => a.AppliedDate)
                .ToListAsync();

            return Ok(applications.Select(ToDto));
        }

        /// <summary>Recruiter/HiringManager/Admin: review applications. Pass
        /// jobPostingId for a single posting's pipeline (recruiter "review and
        /// shortlist" screen), or omit it and filter by status alone for the
        /// hiring manager's cross-posting review queue (e.g. all Shortlisted
        /// candidates awaiting a decision).</summary>
        [HttpGet]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> GetForPosting([FromQuery] int? jobPostingId, [FromQuery] ApplicationStatus? status)
        {
            var query = _unitOfWork.JobApplications.Query()
                .Include(a => a.JobPosting)
                .Include(a => a.CandidateProfile).ThenInclude(c => c.User)
                .Include(a => a.Interviews)
                .AsQueryable();

            if (jobPostingId.HasValue)
                query = query.Where(a => a.JobPostingId == jobPostingId.Value);

            if (status.HasValue)
                query = query.Where(a => a.Status == status.Value);

            var applications = await query
                .OrderByDescending(a => a.MatchScore ?? 0)
                .ThenByDescending(a => a.AppliedDate)
                .ToListAsync();

            return Ok(applications.Select(ToDto));
        }

        /// <summary>Get a single application. Candidates may only view their own;
        /// recruiters/hiring managers/admins may view any.</summary>
        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetById(int id)
        {
            var application = await LoadById(id);
            if (application is null) return NotFound();

            if (User.IsInRole(Roles.Candidate))
            {
                var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
                if (profile is null || application.CandidateProfileId != profile.Id) return Forbid();
            }

            return Ok(ToDto(application));
        }

        /// <summary>Recruiter/HiringManager: move an application through the pipeline
        /// (e.g. UnderReview -> Shortlisted -> InterviewScheduled -> Offered/Rejected/Hired).</summary>
        [HttpPut("{id:int}/status")]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> UpdateStatus(int id, [FromBody] UpdateApplicationStatusDto dto)
        {
            var application = await _unitOfWork.JobApplications.Query()
                .Include(a => a.JobPosting)
                .Include(a => a.CandidateProfile)
                .SingleOrDefaultAsync(a => a.Id == id);
            if (application is null) return NotFound();

            application.Status = dto.Status;
            _unitOfWork.JobApplications.Update(application);

            await _notificationService.NotifyAsync(
                application.CandidateProfile.UserId,
                "Application status updated",
                $"Your application for \"{application.JobPosting?.Title}\" is now {dto.Status}.");

            await _auditService.LogAsync(CurrentUserId, "ApplicationStatusChanged", "JobApplication", id.ToString(), dto.Status.ToString());

            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Candidate: withdraw their own application.</summary>
        [HttpPut("{id:int}/withdraw")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> Withdraw(int id)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound();

            var application = await _unitOfWork.JobApplications.GetByIdAsync(id);
            if (application is null) return NotFound();
            if (application.CandidateProfileId != profile.Id) return Forbid();

            application.Status = ApplicationStatus.Withdrawn;
            _unitOfWork.JobApplications.Update(application);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        private Task<JobApplication?> LoadById(int id) =>
            _unitOfWork.JobApplications.Query()
                .Include(a => a.JobPosting)
                .Include(a => a.CandidateProfile).ThenInclude(c => c.User)
                .Include(a => a.Interviews)
                .SingleOrDefaultAsync(a => a.Id == id);

        private static JobApplicationDto ToDto(JobApplication a) => new()
        {
            Id = a.Id,
            JobPostingId = a.JobPostingId,
            JobTitle = a.JobPosting?.Title ?? string.Empty,
            CandidateProfileId = a.CandidateProfileId,
            CandidateName = $"{a.CandidateProfile?.User?.FirstName} {a.CandidateProfile?.User?.LastName}".Trim(),
            Status = a.Status.ToString(),
            AppliedDate = a.AppliedDate,
            CoverLetter = a.CoverLetter,
            MatchScore = a.MatchScore,
            InterviewCount = a.Interviews?.Count ?? 0
        };
    }
}
