using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;

namespace RecruitmentPlatform.API.Services
{
    public interface IAuditService
    {
        /// <summary>Record an auditable action. Does not call SaveChangesAsync
        /// itself — callers batch it with their own unit-of-work commit so a
        /// failed business operation doesn't leave an orphaned audit entry.</summary>
        Task LogAsync(string userId, string action, string entityType, string? entityId = null, string? details = null);
    }

    public class AuditService : IAuditService
    {
        private readonly IUnitOfWork _unitOfWork;

        public AuditService(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        public async Task LogAsync(string userId, string action, string entityType, string? entityId = null, string? details = null)
        {
            await _unitOfWork.AuditLogs.AddAsync(new AuditLog
            {
                UserId = userId,
                Action = action,
                EntityType = entityType,
                EntityId = entityId,
                Details = details
            });
        }
    }
}