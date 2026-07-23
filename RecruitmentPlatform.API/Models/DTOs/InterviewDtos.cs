/*
 * InterviewDtos.cs
 * ----------------
 * Data Transfer Objects (DTOs) for interview scheduling, management, and calendar integration workflows.
 * 
 * - CreateInterviewDto: Input model for scheduling new candidate interviews with optional calendar provider preference.
 * - UpdateInterviewDto: Input model for updating interview schedules, statuses, feedback, and scores.
 * - InterviewDto: Read model presenting scheduled interview details along with deep links for Google and Outlook calendars.
 */

using System.ComponentModel.DataAnnotations;
using RecruitmentPlatform.API.Models.Entities;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class CreateInterviewDto
    {
        [Required] public int JobApplicationId { get; set; }

        // Defaults to the current (recruiter/hiring manager) user if omitted,
        // but can name a different interviewer (e.g. a recruiter scheduling
        // on behalf of a hiring manager).
        public string? InterviewerUserId { get; set; }

        [Required] public DateTime ScheduledAt { get; set; }
        public int DurationMinutes { get; set; } = 30;
        public string? Location { get; set; }

        // "Outlook" | "Google" — which calendar the interviewer prefers;
        // purely informational, both deep links are always returned.
        public string? CalendarProvider { get; set; }
    }

    public class UpdateInterviewDto
    {
        public DateTime? ScheduledAt { get; set; }
        public int? DurationMinutes { get; set; }
        public string? Location { get; set; }
        public InterviewStatus? Status { get; set; }
        public string? Feedback { get; set; }
        [Range(0, 100)] public int? Score { get; set; }
    }

    public class InterviewDto
    {
        public int Id { get; set; }
        public int JobApplicationId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public string CandidateName { get; set; } = string.Empty;
        public string InterviewerUserId { get; set; } = string.Empty;
        public string InterviewerName { get; set; } = string.Empty;
        public DateTime ScheduledAt { get; set; }
        public int DurationMinutes { get; set; }
        public string? Location { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Feedback { get; set; }
        public int? Score { get; set; }

        // Calendar integration: one-click "add to calendar" deep links
        // (no OAuth/app registration required for either provider).
        public string GoogleCalendarLink { get; set; } = string.Empty;
        public string OutlookCalendarLink { get; set; } = string.Empty;
    }
}
