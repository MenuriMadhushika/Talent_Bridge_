using Microsoft.AspNetCore.Identity;

namespace RecruitmentPlatform.API.Models.Entities
{
    // Extends ASP.NET Identity's built-in user so we get password hashing,
    // lockout, email confirmation, etc. "for free" and layer our own fields on top.
    public class ApplicationUser : IdentityUser
    {
        public string FirstName { get; set; } = string.Empty;
        public string LastName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public bool IsActive { get; set; } = true;

        // Optional link to an organization (recruiters / hiring managers / admins
        // belong to the consulting company or one of its client organizations)
        public int? OrganizationId { get; set; }
        public Organization? Organization { get; set; }

        // Navigation to role-specific profile (one of these will be non-null
        // depending on which role the user was registered as)
        public CandidateProfile? CandidateProfile { get; set; }
        public RecruiterProfile? RecruiterProfile { get; set; }
    }

    public class Organization
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Industry { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<Department> Departments { get; set; } = new List<Department>();
        public ICollection<ApplicationUser> Users { get; set; } = new List<ApplicationUser>();
    }

    public class Department
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;

        public int OrganizationId { get; set; }
        public Organization Organization { get; set; } = null!;

        public ICollection<JobPosting> JobPostings { get; set; } = new List<JobPosting>();
    }
}
