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
/// Manages candidate profiles, resume management, candidate discovery for recruiters, 
/// and data privacy compliance features (GDPR/CCPA export and account anonymization).
/// </summary>
    public class CandidateProfilesController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IFileStorageService _fileStorageService;
        private readonly IResumeParsingService _resumeParsingService;
        private readonly IResumeTextExtractionService _resumeTextExtractionService;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IAuditService _auditService;

        public CandidateProfilesController(
            IUnitOfWork unitOfWork,
            IFileStorageService fileStorageService,
            IResumeParsingService resumeParsingService,
            IResumeTextExtractionService resumeTextExtractionService,
            UserManager<ApplicationUser> userManager,
            IAuditService auditService)
        {
            _unitOfWork = unitOfWork;
            _fileStorageService = fileStorageService;
            _resumeParsingService = resumeParsingService;
            _resumeTextExtractionService = resumeTextExtractionService;
            _userManager = userManager;
            _auditService = auditService;
        }

        private string CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

        /// <summary>Candidate: get their own profile.</summary>
        [HttpGet("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> GetMyProfile()
        {
            var profile = await LoadProfileByUserId(CurrentUserId);
            if (profile is null) return NotFound();
            return Ok(ToDto(profile));
        }

        /// <summary>Candidate: create or update their own profile (upsert, since it's
        /// seeded minimally at registration and filled in afterward).</summary>
        [HttpPut("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateCandidateProfileDto dto)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound("Candidate profile not found for this account.");

            profile.Headline = dto.Headline;
            profile.Summary = dto.Summary;
            profile.Location = dto.Location;
            profile.YearsOfExperience = dto.YearsOfExperience;
            profile.Skills = dto.Skills;
            profile.Education = dto.Education;

            _unitOfWork.CandidateProfiles.Update(profile);
            await _unitOfWork.SaveChangesAsync();

            var reloaded = await LoadProfileByUserId(CurrentUserId);
            return Ok(ToDto(reloaded!));
        }

        /// <summary>Candidate: export all personal data this platform holds about them,
        /// as a single JSON document (data privacy / "right to access" compliance).</summary>
        [HttpGet("me/export")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> ExportMyData()
        {
            var profile = await _unitOfWork.CandidateProfiles.Query()
                .Include(p => p.User)
                .Include(p => p.Resumes)
                .Include(p => p.Applications).ThenInclude(a => a.JobPosting)
                .Include(p => p.Applications).ThenInclude(a => a.Interviews)
                .Include(p => p.Applications).ThenInclude(a => a.Evaluations)
                .SingleOrDefaultAsync(p => p.UserId == CurrentUserId);

            if (profile is null) return NotFound();

            var export = new CandidateDataExportDto
            {
                ExportedAtUtc = DateTime.UtcNow,
                Account = new CandidateDataExportDto.AccountSection
                {
                    FirstName = profile.User.FirstName,
                    LastName = profile.User.LastName,
                    Email = profile.User.Email ?? string.Empty,
                    AccountCreatedAt = profile.User.CreatedAt
                },
                Profile = new CandidateDataExportDto.ProfileSection
                {
                    Headline = profile.Headline,
                    Summary = profile.Summary,
                    Location = profile.Location,
                    YearsOfExperience = profile.YearsOfExperience,
                    Skills = profile.Skills,
                    Education = profile.Education
                },
                Resumes = profile.Resumes.Select(r => new CandidateDataExportDto.ResumeSection
                {
                    FileName = r.FileName,
                    UploadedAt = r.UploadedAt,
                    ParsedSkills = r.ParsedSkills,
                    ParsedExperienceSummary = r.ParsedExperienceSummary,
                    IsPrimary = r.IsPrimary
                }).ToList(),
                Applications = profile.Applications.Select(a => new CandidateDataExportDto.ApplicationSection
                {
                    JobTitle = a.JobPosting?.Title ?? string.Empty,
                    Status = a.Status.ToString(),
                    AppliedDate = a.AppliedDate,
                    CoverLetter = a.CoverLetter,
                    MatchScore = a.MatchScore,
                    InterviewCount = a.Interviews.Count,
                    EvaluationCount = a.Evaluations.Count
                }).ToList()
            };

            await _auditService.LogAsync(CurrentUserId, "CandidateDataExported", "CandidateProfile", profile.Id.ToString());
            await _unitOfWork.SaveChangesAsync();

            return Ok(export);
        }

        /// <summary>Candidate: delete/anonymize their own account (data privacy /
        /// "right to erasure" compliance). Personal identifiers on the account and
        /// profile are scrubbed and the account is deactivated; historical application
        /// records are kept (status/dates only, no name/contact info) since recruiters
        /// and hiring managers may have a legitimate record-keeping need for them.
        /// Note: because auth uses stateless JWTs, any token issued before deletion
        /// remains technically valid until it expires — there is no server-side session
        /// to revoke. The account itself is deactivated, so a fresh login is rejected.</summary>
        [HttpDelete("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> DeleteMyAccount()
        {
            var user = await _userManager.FindByIdAsync(CurrentUserId);
            if (user is null) return NotFound();

            var profile = await _unitOfWork.CandidateProfiles.Query()
                .Include(p => p.Resumes)
                .SingleOrDefaultAsync(p => p.UserId == CurrentUserId);

            // Scrub personal identifiers from the profile; keep the row (and its
            // application history) so counts/analytics stay consistent.
            if (profile is not null)
            {
                profile.Headline = null;
                profile.Summary = null;
                profile.Location = null;
                profile.Education = string.Empty;
                profile.Skills = string.Empty;

                foreach (var resume in profile.Resumes.ToList())
                    _unitOfWork.Resumes.Remove(resume);

                _unitOfWork.CandidateProfiles.Update(profile);
            }

            var anonymizedEmail = $"deleted-{Guid.NewGuid():N}@deleted.local";
            user.FirstName = "Deleted";
            user.LastName = "User";
            user.IsActive = false;
            await _userManager.SetEmailAsync(user, anonymizedEmail);
            await _userManager.SetUserNameAsync(user, anonymizedEmail);
            await _userManager.UpdateSecurityStampAsync(user); // invalidates password reset tokens, etc.

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return BadRequest(new { error = string.Join("; ", result.Errors.Select(e => e.Description)) });

            await _auditService.LogAsync(CurrentUserId, "AccountDeletionRequested", "ApplicationUser", CurrentUserId,
                "Self-service account deletion (data scrubbed, account deactivated).");
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Recruiter/HiringManager/Admin: view any candidate's profile
        /// (e.g. when reviewing an application or searching talent).</summary>
        [HttpGet("{id:int}")]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> GetById(int id)
        {
            var profile = await _unitOfWork.CandidateProfiles.Query()
                .Include(p => p.User)
                .Include(p => p.Resumes)
                .Include(p => p.Applications)
                .SingleOrDefaultAsync(p => p.Id == id);

            if (profile is null) return NotFound();
            return Ok(ToDto(profile));
        }

        /// <summary>Recruiter: search/filter the candidate pool.</summary>
        [HttpGet]
        [Authorize(Roles = $"{Roles.Recruiter},{Roles.HiringManager},{Roles.Admin}")]
        public async Task<IActionResult> Search([FromQuery] CandidateSearchQuery query)
        {
            var candidates = _unitOfWork.CandidateProfiles.Query()
                .Include(p => p.User)
                .Include(p => p.Resumes)
                .Include(p => p.Applications)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(query.Keyword))
            {
                candidates = candidates.Where(p =>
                    p.Skills.Contains(query.Keyword) ||
                    (p.Headline != null && p.Headline.Contains(query.Keyword)));
            }

            if (query.MinYearsOfExperience.HasValue)
                candidates = candidates.Where(p => p.YearsOfExperience >= query.MinYearsOfExperience.Value);

            if (!string.IsNullOrWhiteSpace(query.Location))
                candidates = candidates.Where(p => p.Location != null && p.Location.Contains(query.Location));

            var results = await candidates.ToListAsync();
            return Ok(results.Select(ToDto));
        }

        /// <summary>Candidate: list their own uploaded resumes.</summary>
        [HttpGet("me/resumes")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> GetMyResumes()
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound();

            var resumes = await _unitOfWork.Resumes.FindAsync(r => r.CandidateProfileId == profile.Id);
            return Ok(resumes.Select(ToResumeDto));
        }

        /// <summary>Candidate: register a resume that has already been uploaded to cloud
        /// storage (this endpoint stores the resulting metadata; the AI resume-parsing
        /// service fills in ParsedSkills/ParsedExperienceSummary asynchronously).</summary>
        [HttpPost("me/resumes")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> AddResume([FromBody] CreateResumeDto dto)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound("Candidate profile not found for this account.");

            if (dto.IsPrimary)
            {
                var existing = await _unitOfWork.Resumes.FindAsync(r => r.CandidateProfileId == profile.Id && r.IsPrimary);
                foreach (var r in existing)
                {
                    r.IsPrimary = false;
                    _unitOfWork.Resumes.Update(r);
                }
            }

            var resume = new Resume
            {
                CandidateProfileId = profile.Id,
                FileName = dto.FileName,
                StorageUrl = dto.StorageUrl,
                IsPrimary = dto.IsPrimary
            };

            await _unitOfWork.Resumes.AddAsync(resume);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMyResumes), ToResumeDto(resume));
        }

        /// <summary>Candidate: upload an actual resume file (stored on disk
        /// under wwwroot/uploads/resumes — see LocalFileStorageService, the
        /// stand-in for cloud storage). Text is extracted from .txt/.pdf/.docx
        /// files (see IResumeTextExtractionService) and sent to the AI
        /// resume-parsing service so ParsedSkills/ParsedExperienceSummary are
        /// populated immediately instead of staying null forever.</summary>
        [HttpPost("me/resumes/upload")]
        [Authorize(Roles = Roles.Candidate)]
        [RequestSizeLimit(10 * 1024 * 1024)] // 10 MB
        public async Task<IActionResult> UploadResume(IFormFile file, [FromForm] bool isPrimary = false, CancellationToken ct = default)
        {
            if (file is null || file.Length == 0) return BadRequest("No file was uploaded.");

            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound("Candidate profile not found for this account.");

            var (storageUrl, fileName) = await _fileStorageService.SaveAsync(file, "resumes");

            string? parsedSkills = null;
            string? parsedSummary = null;
            var extractedText = await _resumeTextExtractionService.ExtractTextAsync(file, ct);
            if (!string.IsNullOrWhiteSpace(extractedText))
            {
                (parsedSkills, parsedSummary) = await _resumeParsingService.ParseAsync(extractedText, ct);
            }

            if (isPrimary)
            {
                var existing = await _unitOfWork.Resumes.FindAsync(r => r.CandidateProfileId == profile.Id && r.IsPrimary);
                foreach (var r in existing)
                {
                    r.IsPrimary = false;
                    _unitOfWork.Resumes.Update(r);
                }
            }

            var resume = new Resume
            {
                CandidateProfileId = profile.Id,
                FileName = fileName,
                StorageUrl = storageUrl,
                IsPrimary = isPrimary,
                ParsedSkills = parsedSkills,
                ParsedExperienceSummary = parsedSummary
            };

            await _unitOfWork.Resumes.AddAsync(resume);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMyResumes), ToResumeDto(resume));
        }

        /// <summary>Candidate: mark one of their resumes as primary.</summary>
        [HttpPut("me/resumes/{resumeId:int}/set-primary")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> SetPrimaryResume(int resumeId)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound();

            var target = await _unitOfWork.Resumes.GetByIdAsync(resumeId);
            if (target is null || target.CandidateProfileId != profile.Id) return NotFound();

            var others = await _unitOfWork.Resumes.FindAsync(r => r.CandidateProfileId == profile.Id && r.IsPrimary);
            foreach (var r in others)
            {
                r.IsPrimary = false;
                _unitOfWork.Resumes.Update(r);
            }

            target.IsPrimary = true;
            _unitOfWork.Resumes.Update(target);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Candidate: delete one of their own resumes.</summary>
        [HttpDelete("me/resumes/{resumeId:int}")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> DeleteResume(int resumeId)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound();

            var target = await _unitOfWork.Resumes.GetByIdAsync(resumeId);
            if (target is null || target.CandidateProfileId != profile.Id) return NotFound();

            _unitOfWork.Resumes.Remove(target);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        private Task<CandidateProfile?> LoadProfileByUserId(string userId) =>
            _unitOfWork.CandidateProfiles.Query()
                .Include(p => p.User)
                .Include(p => p.Resumes)
                .Include(p => p.Applications)
                .SingleOrDefaultAsync(p => p.UserId == userId);

        private static CandidateProfileDto ToDto(CandidateProfile p) => new()
        {
            Id = p.Id,
            FullName = $"{p.User?.FirstName} {p.User?.LastName}".Trim(),
            Headline = p.Headline,
            Summary = p.Summary,
            Location = p.Location,
            YearsOfExperience = p.YearsOfExperience,
            Skills = p.Skills,
            Education = p.Education,
            ResumeCount = p.Resumes?.Count ?? 0,
            ApplicationCount = p.Applications?.Count ?? 0
        };

        private static ResumeDto ToResumeDto(Resume r) => new()
        {
            Id = r.Id,
            FileName = r.FileName,
            StorageUrl = r.StorageUrl,
            UploadedAt = r.UploadedAt,
            ParsedSkills = r.ParsedSkills,
            ParsedExperienceSummary = r.ParsedExperienceSummary,
            IsPrimary = r.IsPrimary
        };
    }
}
