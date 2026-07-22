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
    public class JobPostingsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMatchingService _matchingService;
        private readonly IAuditService _auditService;

        public JobPostingsController(IUnitOfWork unitOfWork, IMatchingService matchingService, IAuditService auditService)
        {
            _unitOfWork = unitOfWork;
            _matchingService = matchingService;
            _auditService = auditService;
        }

        /// <summary>Public: browse open job postings (candidate job search).</summary>
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetOpenPostings([FromQuery] string? keyword)
        {
            var query = _unitOfWork.JobPostings.Query()
                .Include(j => j.Department)
                .Include(j => j.Applications)
                .Where(j => j.Status == JobPostingStatus.Open);

            if (!string.IsNullOrWhiteSpace(keyword))
            {
                query = query.Where(j =>
                    j.Title.Contains(keyword) ||
                    j.RequiredSkills.Contains(keyword));
            }

            var postings = await query.OrderByDescending(j => j.PostedDate).ToListAsync();
            return Ok(postings.Select(j => ToDto(j)));
        }

        /// <summary>Candidate: AI-powered job recommendations — open postings
        /// ranked by skill overlap with the candidate's own profile.</summary>
        [HttpGet("recommended")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> GetRecommended()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == userId);
            if (profile is null) return Ok(Array.Empty<JobPostingDto>());

            var postings = await _unitOfWork.JobPostings.Query()
                .Include(j => j.Department)
                .Include(j => j.Applications)
                .Where(j => j.Status == JobPostingStatus.Open)
                .ToListAsync();

            var recommended = postings
                .Select(j => new { Posting = j, Score = _matchingService.ComputeMatchScore(profile.Skills, j.RequiredSkills) })
                .Where(x => x.Score > 0)
                .OrderByDescending(x => x.Score)
                .Take(6)
                .Select(x => ToDto(x.Posting, x.Score));

            return Ok(recommended);
        }

        [HttpGet("{id:int}")]
        [AllowAnonymous]
        public async Task<IActionResult> GetById(int id)
        {
            var posting = await _unitOfWork.JobPostings.Query()
                .Include(j => j.Department)
                .Include(j => j.Applications)
                .SingleOrDefaultAsync(j => j.Id == id);

            if (posting is null) return NotFound();
            return Ok(ToDto(posting));
        }

        /// <summary>Recruiter only: create a new job posting under their department.</summary>
        [HttpPost]
        [Authorize(Roles = Roles.Recruiter)]
        public async Task<IActionResult> Create([FromBody] CreateJobPostingDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var recruiterProfile = await _unitOfWork.RecruiterProfiles.SingleOrDefaultAsync(r => r.UserId == userId);
            if (recruiterProfile is null) return Forbid();

            var posting = new JobPosting
            {
                Title = dto.Title,
                Description = dto.Description,
                RequiredSkills = dto.RequiredSkills,
                Location = dto.Location,
                IsRemote = dto.IsRemote,
                SalaryMin = dto.SalaryMin,
                SalaryMax = dto.SalaryMax,
                DepartmentId = dto.DepartmentId,
                ClosingDate = dto.ClosingDate,
                RecruiterProfileId = recruiterProfile.Id,
                Status = JobPostingStatus.Open
            };

            await _unitOfWork.JobPostings.AddAsync(posting);
            await _auditService.LogAsync(userId ?? string.Empty, "JobPostingCreated", "JobPosting", null, dto.Title);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = posting.Id }, ToDto(posting));
        }

        /// <summary>Recruiter only: edit a posting they own. Allowed for
        /// Draft/Open postings — closed/archived postings are read-only.</summary>
        [HttpPut("{id:int}")]
        [Authorize(Roles = Roles.Recruiter)]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateJobPostingDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var posting = await _unitOfWork.JobPostings.Query()
                .Include(j => j.Department)
                .Include(j => j.Applications)
                .SingleOrDefaultAsync(j => j.Id == id);
            if (posting is null) return NotFound();

            var recruiterProfile = await _unitOfWork.RecruiterProfiles.SingleOrDefaultAsync(r => r.UserId == userId);
            if (recruiterProfile is null || posting.RecruiterProfileId != recruiterProfile.Id)
                return Forbid();

            if (posting.Status is JobPostingStatus.Closed or JobPostingStatus.Archived)
                return BadRequest(new { error = "Closed or archived postings can't be edited." });

            posting.Title = dto.Title;
            posting.Description = dto.Description;
            posting.RequiredSkills = dto.RequiredSkills;
            posting.Location = dto.Location;
            posting.IsRemote = dto.IsRemote;
            posting.SalaryMin = dto.SalaryMin;
            posting.SalaryMax = dto.SalaryMax;
            posting.DepartmentId = dto.DepartmentId;
            posting.ClosingDate = dto.ClosingDate;

            _unitOfWork.JobPostings.Update(posting);
            await _auditService.LogAsync(userId ?? string.Empty, "JobPostingUpdated", "JobPosting", id.ToString(), dto.Title);
            await _unitOfWork.SaveChangesAsync();

            return Ok(ToDto(posting));
        }

        /// <summary>Recruiter only: close a posting they own.</summary>
        [HttpPut("{id:int}/close")]
        [Authorize(Roles = Roles.Recruiter)]
        public async Task<IActionResult> Close(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
            var posting = await _unitOfWork.JobPostings.GetByIdAsync(id);
            if (posting is null) return NotFound();

            var recruiterProfile = await _unitOfWork.RecruiterProfiles.SingleOrDefaultAsync(r => r.UserId == userId);
            if (recruiterProfile is null || posting.RecruiterProfileId != recruiterProfile.Id)
                return Forbid();

            posting.Status = JobPostingStatus.Closed;
            _unitOfWork.JobPostings.Update(posting);
            await _auditService.LogAsync(userId ?? string.Empty, "JobPostingClosed", "JobPosting", id.ToString());
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        private static JobPostingDto ToDto(JobPosting j, double? matchScore = null) => new()
        {
            Id = j.Id,
            Title = j.Title,
            Description = j.Description,
            RequiredSkills = j.RequiredSkills,
            Location = j.Location,
            IsRemote = j.IsRemote,
            SalaryMin = j.SalaryMin,
            SalaryMax = j.SalaryMax,
            Status = j.Status.ToString(),
            PostedDate = j.PostedDate,
            ClosingDate = j.ClosingDate,
            DepartmentName = j.Department?.Name ?? string.Empty,
            ApplicationCount = j.Applications?.Count ?? 0,
            MatchScore = matchScore
        };
    }
}