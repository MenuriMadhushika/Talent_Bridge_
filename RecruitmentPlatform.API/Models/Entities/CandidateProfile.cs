namespace RecruitmentPlatform.API.Models.Entities
{
    public class CandidateProfile
    {
        public int Id { get; set; }

        public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public string? Location { get; set; }
        public int YearsOfExperience { get; set; }

        // Comma-separated for simplicity in this prototype; could be normalised
        // into a Skill/CandidateSkill many-to-many table for a production system.
        public string Skills { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;

        public ICollection<Resume> Resumes { get; set; } = new List<Resume>();
        public ICollection<SkillAssessment> SkillAssessments { get; set; } = new List<SkillAssessment>();
        public ICollection<JobApplication> Applications { get; set; } = new List<JobApplication>();
    }

    public class Resume
    {
        public int Id { get; set; }

        public int CandidateProfileId { get; set; }
        public CandidateProfile CandidateProfile { get; set; } = null!;

        public string FileName { get; set; } = string.Empty;
        public string StorageUrl { get; set; } = string.Empty; // path/URL in cloud storage
        public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

        // Populated by the AI resume-parsing service
        public string? ParsedSkills { get; set; }
        public string? ParsedExperienceSummary { get; set; }
        public bool IsPrimary { get; set; }
    }

    public class SkillAssessment
    {
        public int Id { get; set; }

        public int CandidateProfileId { get; set; }
        public CandidateProfile CandidateProfile { get; set; } = null!;

        public string SkillName { get; set; } = string.Empty;
        public ProficiencyLevel Proficiency { get; set; }
        public int Score { get; set; } // 0-100
        public DateTime AssessedAt { get; set; } = DateTime.UtcNow;
    }
}
