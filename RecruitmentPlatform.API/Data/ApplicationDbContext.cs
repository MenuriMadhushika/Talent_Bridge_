/*
 * ApplicationDbContext.cs
 * -----------------------
 * Main EF Core Database Context for the Recruitment Platform.
 * 
 * - Inherits from IdentityDbContext to manage core authentication (AspNetUsers, AspNetRoles, etc.).
 * - Defines DbSets for all application domain entities (Organizations, Profiles, Jobs, Applications, etc.).
 * - Configures Fluent API entity mappings, unique indexes, decimal precision, and cascading delete behaviors in OnModelCreating.
 */

using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RecruitmentPlatform.API.Models.Entities;

namespace RecruitmentPlatform.API.Data
{
    // IdentityDbContext<ApplicationUser> gives us AspNetUsers, AspNetRoles,
    // AspNetUserRoles etc. for free, wired up to our custom user type.
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options) { }

        public DbSet<Organization> Organizations => Set<Organization>();
        public DbSet<Department> Departments => Set<Department>();
        public DbSet<CandidateProfile> CandidateProfiles => Set<CandidateProfile>();
        public DbSet<RecruiterProfile> RecruiterProfiles => Set<RecruiterProfile>();
        public DbSet<Resume> Resumes => Set<Resume>();
        public DbSet<SkillAssessment> SkillAssessments => Set<SkillAssessment>();
        public DbSet<JobPosting> JobPostings => Set<JobPosting>();
        public DbSet<JobApplication> JobApplications => Set<JobApplication>();
        public DbSet<Interview> Interviews => Set<Interview>();
        public DbSet<Evaluation> Evaluations => Set<Evaluation>();
        public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
        public DbSet<Notification> Notifications => Set<Notification>();
        public DbSet<ApplicationMessage> ApplicationMessages => Set<ApplicationMessage>();

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder); // must run first for Identity tables

            // --- Organization / Department ---
            builder.Entity<Department>()
                .HasOne(d => d.Organization)
                .WithMany(o => o.Departments)
                .HasForeignKey(d => d.OrganizationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ApplicationUser>()
                .HasOne(u => u.Organization)
                .WithMany(o => o.Users)
                .HasForeignKey(u => u.OrganizationId)
                .OnDelete(DeleteBehavior.SetNull);

            // --- Candidate ---
            builder.Entity<CandidateProfile>()
                .HasOne(c => c.User)
                .WithOne(u => u.CandidateProfile)
                .HasForeignKey<CandidateProfile>(c => c.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<Resume>()
                .HasOne(r => r.CandidateProfile)
                .WithMany(c => c.Resumes)
                .HasForeignKey(r => r.CandidateProfileId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<SkillAssessment>()
                .HasOne(s => s.CandidateProfile)
                .WithMany(c => c.SkillAssessments)
                .HasForeignKey(s => s.CandidateProfileId)
                .OnDelete(DeleteBehavior.Cascade);

            // --- Recruiter ---
            builder.Entity<RecruiterProfile>()
                .HasOne(r => r.User)
                .WithOne(u => u.RecruiterProfile)
                .HasForeignKey<RecruiterProfile>(r => r.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<RecruiterProfile>()
                .HasOne(r => r.Department)
                .WithMany()
                .HasForeignKey(r => r.DepartmentId)
                .OnDelete(DeleteBehavior.SetNull);

            // --- Job posting ---
            builder.Entity<JobPosting>()
                .HasOne(j => j.RecruiterProfile)
                .WithMany(r => r.JobPostings)
                .HasForeignKey(j => j.RecruiterProfileId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<JobPosting>()
                .HasOne(j => j.Department)
                .WithMany(d => d.JobPostings)
                .HasForeignKey(j => j.DepartmentId)
                .OnDelete(DeleteBehavior.Restrict);

            // --- Application ---
            builder.Entity<JobApplication>()
                .HasOne(a => a.JobPosting)
                .WithMany(j => j.Applications)
                .HasForeignKey(a => a.JobPostingId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<JobApplication>()
                .HasOne(a => a.CandidateProfile)
                .WithMany(c => c.Applications)
                .HasForeignKey(a => a.CandidateProfileId)
                .OnDelete(DeleteBehavior.Cascade);

            // A candidate can only apply once per job posting
            builder.Entity<JobApplication>()
                .HasIndex(a => new { a.JobPostingId, a.CandidateProfileId })
                .IsUnique();

            // --- Interview ---
            builder.Entity<Interview>()
                .HasOne(i => i.JobApplication)
                .WithMany(a => a.Interviews)
                .HasForeignKey(i => i.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<Interview>()
                .HasOne(i => i.InterviewerUser)
                .WithMany()
                .HasForeignKey(i => i.InterviewerUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // --- Evaluation ---
            builder.Entity<Evaluation>()
                .HasOne(e => e.JobApplication)
                .WithMany(a => a.Evaluations)
                .HasForeignKey(e => e.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<Evaluation>()
                .HasOne(e => e.EvaluatorUser)
                .WithMany()
                .HasForeignKey(e => e.EvaluatorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // --- Audit log / notifications / application messages ---
            builder.Entity<AuditLog>()
                .HasOne(a => a.User)
                .WithMany()
                .HasForeignKey(a => a.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.Entity<Notification>()
                .HasOne(n => n.User)
                .WithMany()
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ApplicationMessage>()
                .HasOne(m => m.JobApplication)
                .WithMany()
                .HasForeignKey(m => m.JobApplicationId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Entity<ApplicationMessage>()
                .HasOne(m => m.Sender)
                .WithMany()
                .HasForeignKey(m => m.SenderUserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Decimal precision for salary fields
            builder.Entity<JobPosting>().Property(j => j.SalaryMin).HasPrecision(12, 2);
            builder.Entity<JobPosting>().Property(j => j.SalaryMax).HasPrecision(12, 2);
        }
    }
}
