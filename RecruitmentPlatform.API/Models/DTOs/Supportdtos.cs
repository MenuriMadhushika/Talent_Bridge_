///<<<<<<< feature/database-models
/*
 * MiscellaneousDtos.cs
 * --------------------
 * Data Transfer Objects (DTOs) for audit logging, notifications, messaging, skill assessments, job updates, and system health checks.
 * 
 * - AuditLogDto & NotificationDto: Read models for tracking user actions and delivering system notifications.
 * - CreateApplicationMessageDto & ApplicationMessageDto: Input and output models for candidate-recruiter application messaging.
 * - CreateSkillAssessmentDto & SkillAssessmentDto: Models for submitting and reading candidate technical skill evaluations.
 * - UpdateJobPostingDto: Input model for modifying existing job listing details.
 * - SystemHealthDto: Response model for admin/monitoring endpoints tracking database connectivity and server metrics.
 */

=======
///support
///>>>>>>> master
using System.ComponentModel.DataAnnotations;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class AuditLogDto
    {
        public int Id { get; set; }
        public string UserName { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string EntityType { get; set; } = string.Empty;
        public string? EntityId { get; set; }
        public string? Details { get; set; }
        public DateTime OccurredAt { get; set; }
    }

    public class NotificationDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class CreateApplicationMessageDto
    {
        [Required] public int JobApplicationId { get; set; }
        [Required] public string Body { get; set; } = string.Empty;
    }

    public class ApplicationMessageDto
    {
        public int Id { get; set; }
        public int JobApplicationId { get; set; }
        public string SenderUserId { get; set; } = string.Empty;
        public string SenderName { get; set; } = string.Empty;
        public string SenderRole { get; set; } = string.Empty;
        public string Body { get; set; } = string.Empty;
        public DateTime SentAt { get; set; }
    }

    public class CreateSkillAssessmentDto
    {
        [Required] public string SkillName { get; set; } = string.Empty;
        [Required] public string Proficiency { get; set; } = string.Empty; // Beginner/Intermediate/Advanced/Expert
        [Range(0, 100)] public int Score { get; set; }
    }

    public class SkillAssessmentDto
    {
        public int Id { get; set; }
        public string SkillName { get; set; } = string.Empty;
        public string Proficiency { get; set; } = string.Empty;
        public int Score { get; set; }
        public DateTime AssessedAt { get; set; }
    }

    public class UpdateJobPostingDto
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

    public class SystemHealthDto
    {
        public string Status { get; set; } = "Healthy";
        public bool DatabaseReachable { get; set; }
        public string Environment { get; set; } = string.Empty;
        public DateTime ServerTimeUtc { get; set; }
        public TimeSpan Uptime { get; set; }
        public int TotalUsers { get; set; }
        public int TotalAuditLogEntries { get; set; }
    }
}
///<<<<<<< feature/database-models
///=======

///>>>>>>> master
