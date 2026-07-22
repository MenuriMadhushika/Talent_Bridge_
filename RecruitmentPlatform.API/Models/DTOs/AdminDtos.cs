using System.ComponentModel.DataAnnotations;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class AdminUserDto
    {
        public string Id { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? OrganizationName { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class UpdateUserRoleDto
    {
        [Required] public string Role { get; set; } = string.Empty;
    }

    public class RecruitmentAnalyticsDto
    {
        public int TotalCandidates { get; set; }
        public int TotalRecruiters { get; set; }
        public int TotalHiringManagers { get; set; }
        public int TotalAdmins { get; set; }
        public int TotalOrganizations { get; set; }
        public int TotalDepartments { get; set; }

        public int OpenPostings { get; set; }
        public int DraftPostings { get; set; }
        public int ClosedPostings { get; set; }

        public int TotalApplications { get; set; }
        public Dictionary<string, int> ApplicationsByStatus { get; set; } = new();

        public int InterviewsScheduled { get; set; }
        public int TotalHires { get; set; }
        public double AverageMatchScore { get; set; }
    }

    /// <summary>One month's worth of hiring-trend activity (hiring trend analysis).</summary>
    public class HiringTrendPointDto
    {
        /// <summary>Calendar month this point covers, e.g. "2026-06".</summary>
        public string Month { get; set; } = string.Empty;
        public int PostingsOpened { get; set; }
        public int ApplicationsReceived { get; set; }
        public int Hires { get; set; }
    }

    public class HiringTrendsDto
    {
        public int Months { get; set; }
        public List<HiringTrendPointDto> Points { get; set; } = new();
    }
}
