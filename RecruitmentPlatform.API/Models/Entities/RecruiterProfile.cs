namespace RecruitmentPlatform.API.Models.Entities
{
    public class RecruiterProfile
    {
        public int Id { get; set; }

        public string UserId { get; set; } = string.Empty;
        public ApplicationUser User { get; set; } = null!;

        public string? JobTitle { get; set; }
        public int? DepartmentId { get; set; }
        public Department? Department { get; set; }

        public ICollection<JobPosting> JobPostings { get; set; } = new List<JobPosting>();
    }
}
