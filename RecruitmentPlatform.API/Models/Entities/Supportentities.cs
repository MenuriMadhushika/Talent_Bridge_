namespace RecruitmentPlatform.API.Models.Entities
{
    // Records who did what, to what, and when — satisfies the "audit logging"
    // security requirement. Written by AuditService, never edited afterward.
    public class AuditLog
    {
        public int Id { get; set; }

        public string UserId { get; set; } = string.Empty;
        public ApplicationUser? User { get; set; }

        public string Action { get; set; } = string.Empty;        // e.g. "ApplicationStatusChanged"
        public string EntityType { get; set; } = string.Empty;    // e.g. "JobApplication"
        public string? EntityId { get; set; }                     // e.g. "42"
        public string? Details { get; set; }                      // free-text summary

        public DateTime OccurredAt { get; set; } = DateTime.UtcNow;
    }

    // In-app notification center. This is the practical substitute for the
    // "Email notifications / SMS notifications" requirement: without a
    // configured SMTP/Twilio account there's nowhere real to send email or
    // SMS, so every place that WOULD trigger one instead writes a
    // Notification row the recipient sees in the app. Swapping in a real
    // email/SMS provider later is a matter of also calling that provider
    // from INotificationService — the call sites don't change.
    public class Notification
    {
        public int Id { get; set; }

        public string UserId { get; set; } = string.Empty;
        public ApplicationUser? User { get; set; }

        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool IsRead { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }

    // "Communication with applicants" — a simple message thread scoped to a
    // single application, visible to the candidate and to
    // recruiters/hiring managers/admins.
    public class ApplicationMessage
    {
        public int Id { get; set; }

        public int JobApplicationId { get; set; }
        public JobApplication JobApplication { get; set; } = null!;

        public string SenderUserId { get; set; } = string.Empty;
        public ApplicationUser Sender { get; set; } = null!;

        public string Body { get; set; } = string.Empty;
        public DateTime SentAt { get; set; } = DateTime.UtcNow;
    }
}