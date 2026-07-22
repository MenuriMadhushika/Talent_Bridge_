using System.ComponentModel.DataAnnotations;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class CreateJobPostingDto
    {
        [Required] public string Title { get; set; } = string.Empty;
        [Required] public string Description { get; set; } = string.Empty;
        public string RequiredSkills { get; set; } = string.Empty;
        public string? Location { get; set; }
        public bool IsRemote { get; set; }
        public decimal? SalaryMin { get; set; }
        public decimal? SalaryMax { get; set; }
        [Required] public int DepartmentId { get; set; }
        public DateTime? ClosingDate { get; set; }
    }

    public class JobPostingDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string RequiredSkills { get; set; } = string.Empty;
        public string? Location { get; set; }
        public bool IsRemote { get; set; }
        public decimal? SalaryMin { get; set; }
        public decimal? SalaryMax { get; set; }
        public string Status { get; set; } = string.Empty;
        public DateTime PostedDate { get; set; }
        public DateTime? ClosingDate { get; set; }
        public string DepartmentName { get; set; } = string.Empty;
        public int ApplicationCount { get; set; }

        // Populated only by the AI job-recommendation endpoint.
        public double? MatchScore { get; set; }
    }
}
