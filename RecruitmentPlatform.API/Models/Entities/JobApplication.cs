namespace RecruitmentPlatform.API.Models.Entities
{
    public class JobApplication
    {
        public int Id { get; set; }

        public int JobPostingId { get; set; }
        public JobPosting JobPosting { get; set; } = null!;

        public int CandidateProfileId { get; set; }
        public CandidateProfile CandidateProfile { get; set; } = null!;

        public ApplicationStatus Status { get; set; } = ApplicationStatus.Submitted;
        public DateTime AppliedDate { get; set; } = DateTime.UtcNow;
        public string? CoverLetter { get; set; }

        // Populated by the AI candidate-job matching service (0-100)
        public double? MatchScore { get; set; }

        public ICollection<Interview> Interviews { get; set; } = new List<Interview>();
        public ICollection<Evaluation> Evaluations { get; set; } = new List<Evaluation>();
    }

    public class Interview
    {
        public int Id { get; set; }

        public int JobApplicationId { get; set; }
        public JobApplication JobApplication { get; set; } = null!;

        public string InterviewerUserId { get; set; } = string.Empty;
        public ApplicationUser InterviewerUser { get; set; } = null!;

        public DateTime ScheduledAt { get; set; }
        public int DurationMinutes { get; set; } = 30;
        public string? Location { get; set; } // physical address or meeting link
        public InterviewStatus Status { get; set; } = InterviewStatus.Scheduled;

        public string? Feedback { get; set; }
        public int? Score { get; set; } // 0-100

        // Set once synced with an external calendar provider
        public string? ExternalCalendarEventId { get; set; }
        public string? CalendarProvider { get; set; } // "Outlook" | "Google"
    }

    // Hiring-manager evaluation of a candidate, distinct from an individual
    // interview's feedback (a candidate can be evaluated after multiple interviews)
    public class Evaluation
    {
        public int Id { get; set; }

        public int JobApplicationId { get; set; }
        public JobApplication JobApplication { get; set; } = null!;

        public string EvaluatorUserId { get; set; } = string.Empty;
        public ApplicationUser EvaluatorUser { get; set; } = null!;

        public int TechnicalScore { get; set; }
        public int CommunicationScore { get; set; }
        public int CultureFitScore { get; set; }
        public string? Comments { get; set; }
        public bool Recommended { get; set; }

        public DateTime EvaluatedAt { get; set; } = DateTime.UtcNow;
    }
}
