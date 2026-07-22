namespace RecruitmentPlatform.API.Models.Entities
{
    public class JobPosting
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string RequiredSkills { get; set; } = string.Empty; // comma-separated
        public string? Location { get; set; }
        public bool IsRemote { get; set; }
        public decimal? SalaryMin { get; set; }
        public decimal? SalaryMax { get; set; }
        public JobPostingStatus Status { get; set; } = JobPostingStatus.Draft;

        public DateTime PostedDate { get; set; } = DateTime.UtcNow;
        public DateTime? ClosingDate { get; set; }

        public int RecruiterProfileId { get; set; }
        public RecruiterProfile RecruiterProfile { get; set; } = null!;

        public int DepartmentId { get; set; }
        public Department Department { get; set; } = null!;

        public ICollection<JobApplication> Applications { get; set; } = new List<JobApplication>();
    }
}
