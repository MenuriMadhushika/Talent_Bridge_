using System.Security.Claims;
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
/// Manages two-way application communication threads between job candidates 
/// and recruitment staff, including automated in-app notifications for incoming messages.
/// </summary>
    public class MessagesController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly INotificationService _notificationService;

        public MessagesController(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager, INotificationService notificationService)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
            _notificationService = notificationService;
        }

        private string CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

        /// <summary>Post a message on an application thread. The candidate who
        /// owns the application, or any recruiter/hiring manager/admin, may
        /// post. The other side is notified in-app.</summary>
        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateApplicationMessageDto dto)
        {
            var application = await _unitOfWork.JobApplications.Query()
                .Include(a => a.JobPosting).ThenInclude(j => j.RecruiterProfile)
                .Include(a => a.CandidateProfile)
                .SingleOrDefaultAsync(a => a.Id == dto.JobApplicationId);

            if (application is null) return NotFound("Application not found.");

            var isCandidateOwner = User.IsInRole(Roles.Candidate) && application.CandidateProfile.UserId == CurrentUserId;
            var isStaff = User.IsInRole(Roles.Recruiter) || User.IsInRole(Roles.HiringManager) || User.IsInRole(Roles.Admin);
            if (!isCandidateOwner && !isStaff) return Forbid();

            var message = new ApplicationMessage
            {
                JobApplicationId = dto.JobApplicationId,
                SenderUserId = CurrentUserId,
                Body = dto.Body
            };

            await _unitOfWork.ApplicationMessages.AddAsync(message);

            // Notify the other side of the conversation.
            var recruiterUserId = application.JobPosting?.RecruiterProfile?.UserId;
            var candidateUserId = application.CandidateProfile.UserId;
            var recipientId = isCandidateOwner ? recruiterUserId : candidateUserId;

            if (!string.IsNullOrEmpty(recipientId) && recipientId != CurrentUserId)
            {
                await _notificationService.NotifyAsync(
                    recipientId,
                    "New message about your application",
                    $"You have a new message regarding \"{application.JobPosting?.Title}\".");
            }

            await _unitOfWork.SaveChangesAsync();

            var sender = await _userManager.FindByIdAsync(CurrentUserId);
            var senderRoles = sender is null ? new List<string>() : (await _userManager.GetRolesAsync(sender)).ToList();

            return CreatedAtAction(nameof(GetForApplication), new { jobApplicationId = dto.JobApplicationId },
                ToDto(message, sender, senderRoles.FirstOrDefault() ?? string.Empty));
        }

        /// <summary>Full message thread for an application. Candidates may
        /// only view their own; staff may view any.</summary>
        [HttpGet]
        public async Task<IActionResult> GetForApplication([FromQuery] int jobApplicationId)
        {
            var application = await _unitOfWork.JobApplications.Query()
                .Include(a => a.CandidateProfile)
                .SingleOrDefaultAsync(a => a.Id == jobApplicationId);
            if (application is null) return NotFound();

            var isCandidateOwner = User.IsInRole(Roles.Candidate) && application.CandidateProfile.UserId == CurrentUserId;
            var isStaff = User.IsInRole(Roles.Recruiter) || User.IsInRole(Roles.HiringManager) || User.IsInRole(Roles.Admin);
            if (!isCandidateOwner && !isStaff) return Forbid();

            var messages = await _unitOfWork.ApplicationMessages.Query()
                .Include(m => m.Sender)
                .Where(m => m.JobApplicationId == jobApplicationId)
                .OrderBy(m => m.SentAt)
                .ToListAsync();

            var results = new List<ApplicationMessageDto>();
            foreach (var m in messages)
            {
                var roles = await _userManager.GetRolesAsync(m.Sender);
                results.Add(ToDto(m, m.Sender, roles.FirstOrDefault() ?? string.Empty));
            }

            return Ok(results);
        }

        private static ApplicationMessageDto ToDto(ApplicationMessage m, ApplicationUser? sender, string senderRole) => new()
        {
            Id = m.Id,
            JobApplicationId = m.JobApplicationId,
            SenderUserId = m.SenderUserId,
            SenderName = sender is null ? "Unknown" : $"{sender.FirstName} {sender.LastName}".Trim(),
            SenderRole = senderRole,
            Body = m.Body,
            SentAt = m.SentAt
        };
    }
}
