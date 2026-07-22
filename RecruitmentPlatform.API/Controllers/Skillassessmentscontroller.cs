using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruitmentPlatform.API.Models.DTOs;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;

namespace RecruitmentPlatform.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    /// <summary>
/// Manages candidate skill self-assessments and proficiency scores, allowing candidates 
/// to track their skill profile and recruiters/staff to evaluate candidate capabilities during application reviews.
/// </summary>
    public class SkillAssessmentsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;

        public SkillAssessmentsController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        private string CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

        /// <summary>Candidate: record a self-assessed skill score.</summary>
        [HttpPost("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> AddForMe([FromBody] CreateSkillAssessmentDto dto)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound("Candidate profile not found for this account.");

            if (!Enum.TryParse<ProficiencyLevel>(dto.Proficiency, true, out var proficiency))
                return BadRequest(new { error = "Proficiency must be one of: Beginner, Intermediate, Advanced, Expert." });

            var assessment = new SkillAssessment
            {
                CandidateProfileId = profile.Id,
                SkillName = dto.SkillName,
                Proficiency = proficiency,
                Score = dto.Score
            };

            await _unitOfWork.SkillAssessments.AddAsync(assessment);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetForCandidate), new { candidateProfileId = profile.Id }, ToDto(assessment));
        }

        /// <summary>Candidate: view their own skill assessments.</summary>
        [HttpGet("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> GetMine()
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound();

            var assessments = await _unitOfWork.SkillAssessments.FindAsync(a => a.CandidateProfileId == profile.Id);
            return Ok(assessments.Select(ToDto));
        }

        /// <summary>Recruiter/HiringManager/Admin: view a specific candidate's
        /// skill assessments (e.g. while reviewing an application).</summary>
        [HttpGet("candidate/{candidateProfileId:int}")]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> GetForCandidate(int candidateProfileId)
        {
            var assessments = await _unitOfWork.SkillAssessments.FindAsync(a => a.CandidateProfileId == candidateProfileId);
            return Ok(assessments.Select(ToDto));
        }

        private static SkillAssessmentDto ToDto(SkillAssessment a) => new()
        {
            Id = a.Id,
            SkillName = a.SkillName,
            Proficiency = a.Proficiency.ToString(),
            Score = a.Score,
            AssessedAt = a.AssessedAt
        };
    }
}
