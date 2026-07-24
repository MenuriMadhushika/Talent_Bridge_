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
/// Handles post-interview candidate evaluations, including scoring across technical, 
/// communication, and culture fit dimensions, updating application pipeline states, 
/// and retrieving evaluation histories for recruiters and hiring managers.
/// </summary>
    public class EvaluationsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IAuditService _auditService;

        public EvaluationsController(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager, IAuditService auditService)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
            _auditService = auditService;
        }

        private string CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

        /// <summary>Hiring manager: score and record a candidate evaluation
        /// (technical / communication / culture fit) after interviews wrap up.</summary>
        [HttpPost]
        [Authorize(Roles = $"{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> Create([FromBody] CreateEvaluationDto dto)
        {
            var application = await _unitOfWork.JobApplications.Query()
                .Include(a => a.JobPosting)
                .Include(a => a.CandidateProfile).ThenInclude(c => c.User)
                .SingleOrDefaultAsync(a => a.Id == dto.JobApplicationId);

            if (application is null) return NotFound("Application not found.");

            var evaluation = new Evaluation
            {
                JobApplicationId = dto.JobApplicationId,
                EvaluatorUserId = CurrentUserId,
                TechnicalScore = dto.TechnicalScore,
                CommunicationScore = dto.CommunicationScore,
                CultureFitScore = dto.CultureFitScore,
                Comments = dto.Comments,
                Recommended = dto.Recommended
            };

            await _unitOfWork.Evaluations.AddAsync(evaluation);
            await _auditService.LogAsync(CurrentUserId, "EvaluationSubmitted", "Evaluation", null,
                $"Application #{dto.JobApplicationId}, recommended={dto.Recommended}");

            // An application that's been evaluated should read as "Interviewed"
            // at minimum, so it doesn't linger in earlier pipeline stages.
            if (application.Status < ApplicationStatus.Interviewed)
            {
                application.Status = ApplicationStatus.Interviewed;
                _unitOfWork.JobApplications.Update(application);
            }

            await _unitOfWork.SaveChangesAsync();

            var evaluator = await _userManager.FindByIdAsync(CurrentUserId);
            return CreatedAtAction(nameof(GetForApplication), new { jobApplicationId = dto.JobApplicationId },
                ToDto(evaluation, application, evaluator!));
        }

        /// <summary>Recruiter/HiringManager/Admin: all evaluations recorded for an application.</summary>
        [HttpGet]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> GetForApplication([FromQuery] int jobApplicationId)
        {
            var evaluations = await _unitOfWork.Evaluations.Query()
                .Include(e => e.EvaluatorUser)
                .Include(e => e.JobApplication).ThenInclude(a => a.JobPosting)
                .Include(e => e.JobApplication).ThenInclude(a => a.CandidateProfile).ThenInclude(c => c.User)
                .Where(e => e.JobApplicationId == jobApplicationId)
                .OrderByDescending(e => e.EvaluatedAt)
                .ToListAsync();

            return Ok(evaluations.Select(e => ToDto(e, e.JobApplication, e.EvaluatorUser)));
        }

        private static EvaluationDto ToDto(Evaluation e, JobApplication application, ApplicationUser evaluator) => new()
        {
            Id = e.Id,
            JobApplicationId = e.JobApplicationId,
            CandidateName = $"{application.CandidateProfile?.User?.FirstName} {application.CandidateProfile?.User?.LastName}".Trim(),
            JobTitle = application.JobPosting?.Title ?? string.Empty,
            EvaluatorUserId = e.EvaluatorUserId,
            EvaluatorName = $"{evaluator.FirstName} {evaluator.LastName}".Trim(),
            TechnicalScore = e.TechnicalScore,
            CommunicationScore = e.CommunicationScore,
            CultureFitScore = e.CultureFitScore,
            OverallScore = Math.Round((e.TechnicalScore + e.CommunicationScore + e.CultureFitScore) / 3.0, 1),
            Comments = e.Comments,
            Recommended = e.Recommended,
            EvaluatedAt = e.EvaluatedAt
        };
    }
}
