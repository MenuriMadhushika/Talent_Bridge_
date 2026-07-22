using System.ComponentModel.DataAnnotations;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class UpdateCandidateProfileDto
    {
        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public string? Location { get; set; }
        [Range(0, 60)] public int YearsOfExperience { get; set; }
        public string Skills { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
    }

    public class CandidateProfileDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public string? Location { get; set; }
        public int YearsOfExperience { get; set; }
        public string Skills { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
        public int ResumeCount { get; set; }
        public int ApplicationCount { get; set; }
    }

    // File bytes are handled separately (multipart upload -> cloud storage);
    // this DTO carries the resulting metadata once the file has been stored.
    public class CreateResumeDto
    {
        [Required] public string FileName { get; set; } = string.Empty;
        [Required] public string StorageUrl { get; set; } = string.Empty;
        public bool IsPrimary { get; set; }
    }

    public class ResumeDto
    {
        public int Id { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string StorageUrl { get; set; } = string.Empty;
        public DateTime UploadedAt { get; set; }
        public string? ParsedSkills { get; set; }
        public string? ParsedExperienceSummary { get; set; }
        public bool IsPrimary { get; set; }
    }

    // Recruiter-facing candidate search filters
    public class CandidateSearchQuery
    {
        public string? Keyword { get; set; }
        public int? MinYearsOfExperience { get; set; }
        public string? Location { get; set; }
    }

    /// <summary>Everything the platform holds about one candidate, for the
    /// self-service "export my data" data-privacy endpoint.</summary>
    public class CandidateDataExportDto
    {
        public DateTime ExportedAtUtc { get; set; }
        public AccountSection Account { get; set; } = new();
        public ProfileSection Profile { get; set; } = new();
        public List<ResumeSection> Resumes { get; set; } = new();
        public List<ApplicationSection> Applications { get; set; } = new();

        public class AccountSection
        {
            public string FirstName { get; set; } = string.Empty;
            public string LastName { get; set; } = string.Empty;
            public string Email { get; set; } = string.Empty;
            public DateTime AccountCreatedAt { get; set; }
        }

        public class ProfileSection
        {
            public string? Headline { get; set; }
            public string? Summary { get; set; }
            public string? Location { get; set; }
            public int YearsOfExperience { get; set; }
            public string Skills { get; set; } = string.Empty;
            public string Education { get; set; } = string.Empty;
        }

        public class ResumeSection
        {
            public string FileName { get; set; } = string.Empty;
            public DateTime UploadedAt { get; set; }
            public string? ParsedSkills { get; set; }
            public string? ParsedExperienceSummary { get; set; }
            public bool IsPrimary { get; set; }
        }

        public class ApplicationSection
        {
            public string JobTitle { get; set; } = string.Empty;
            public string Status { get; set; } = string.Empty;
            public DateTime AppliedDate { get; set; }
            public string? CoverLetter { get; set; }
            public double? MatchScore { get; set; }
            public int InterviewCount { get; set; }
            public int EvaluationCount { get; set; }
        }
    }
}
