using RecruitmentPlatform.API.Data;
using RecruitmentPlatform.API.Models.Entities;

namespace RecruitmentPlatform.API.Repositories
{
    // Unit of Work: exposes one repository per aggregate and a single
    // SaveChangesAsync so a controller/
    //service can make several repository
    // calls that commit together as one atomic database transaction.
    public interface IUnitOfWork : IDisposable
    {
        IRepository<Organization> Organizations { get; }
        IRepository<Department> Departments { get; }
        IRepository<CandidateProfile> CandidateProfiles { get; }
        IRepository<RecruiterProfile> RecruiterProfiles { get; }
        IRepository<Resume> Resumes { get; }
        IRepository<SkillAssessment> SkillAssessments { get; }
        IRepository<JobPosting> JobPostings { get; }
        IRepository<JobApplication> JobApplications { get; }
        IRepository<Interview> Interviews { get; }
        IRepository<Evaluation> Evaluations { get; }
        IRepository<AuditLog> AuditLogs { get; }
        IRepository<Notification> Notifications { get; }
        IRepository<ApplicationMessage> ApplicationMessages { get; }

        Task<int> SaveChangesAsync();
    }

    public class UnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _context;

        // Lazily instantiated so we only pay for repositories actually used
        private IRepository<Organization>? _organizations;
        private IRepository<Department>? _departments;
        private IRepository<CandidateProfile>? _candidateProfiles;
        private IRepository<RecruiterProfile>? _recruiterProfiles;
        private IRepository<Resume>? _resumes;
        private IRepository<SkillAssessment>? _skillAssessments;
        private IRepository<JobPosting>? _jobPostings;
        private IRepository<JobApplication>? _jobApplications;
        private IRepository<Interview>? _interviews;
        private IRepository<Evaluation>? _evaluations;
        private IRepository<AuditLog>? _auditLogs;
        private IRepository<Notification>? _notifications;
        private IRepository<ApplicationMessage>? _applicationMessages;

        public UnitOfWork(ApplicationDbContext context)
        {
            _context = context;
        }

        public IRepository<Organization> Organizations => _organizations ??= new Repository<Organization>(_context);
        public IRepository<Department> Departments => _departments ??= new Repository<Department>(_context);
        public IRepository<CandidateProfile> CandidateProfiles => _candidateProfiles ??= new Repository<CandidateProfile>(_context);
        public IRepository<RecruiterProfile> RecruiterProfiles => _recruiterProfiles ??= new Repository<RecruiterProfile>(_context);
        public IRepository<Resume> Resumes => _resumes ??= new Repository<Resume>(_context);
        public IRepository<SkillAssessment> SkillAssessments => _skillAssessments ??= new Repository<SkillAssessment>(_context);
        public IRepository<JobPosting> JobPostings => _jobPostings ??= new Repository<JobPosting>(_context);
        public IRepository<JobApplication> JobApplications => _jobApplications ??= new Repository<JobApplication>(_context);
        public IRepository<Interview> Interviews => _interviews ??= new Repository<Interview>(_context);
        public IRepository<Evaluation> Evaluations => _evaluations ??= new Repository<Evaluation>(_context);
        public IRepository<AuditLog> AuditLogs => _auditLogs ??= new Repository<AuditLog>(_context);
        public IRepository<Notification> Notifications => _notifications ??= new Repository<Notification>(_context);
        public IRepository<ApplicationMessage> ApplicationMessages => _applicationMessages ??= new Repository<ApplicationMessage>(_context);

        public async Task<int> SaveChangesAsync() => await _context.SaveChangesAsync();

        public void Dispose()
        {
            _context.Dispose();
            GC.SuppressFinalize(this);
        }
    }
}

