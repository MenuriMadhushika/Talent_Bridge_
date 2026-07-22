namespace RecruitmentPlatform.API.Models.Entities
{
    // Fixed role names used for ASP.NET Identity roles + [Authorize(Roles = "...")]
    public static class Roles
    {
        public const string Candidate = "Candidate";
        public const string Recruiter = "Recruiter";
        public const string HiringManager = "HiringManager";
        public const string Admin = "Admin";
    }

    public enum JobPostingStatus
    {
        Draft = 0,
        Open = 1,
        Closed = 2,
        Archived = 3
    }

    public enum ApplicationStatus
    {
        Submitted = 0,
        UnderReview = 1,
        Shortlisted = 2,
        InterviewScheduled = 3,
        Interviewed = 4,
        Offered = 5,
        Rejected = 6,
        Withdrawn = 7,
        Hired = 8
    }

    public enum InterviewStatus
    {
        Scheduled = 0,
        Completed = 1,
        Cancelled = 2,
        NoShow = 3
    }

    public enum ProficiencyLevel
    {
        Beginner = 0,
        Intermediate = 1,
        Advanced = 2,
        Expert = 3
    }
}
