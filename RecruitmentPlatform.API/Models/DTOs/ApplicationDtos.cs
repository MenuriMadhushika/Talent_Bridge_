using System.ComponentModel.DataAnnotations;
using RecruitmentPlatform.API.Models.Entities;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class CreateApplicationDto
    {
        [Required] public int JobPostingId { get; set; }
        public string? CoverLetter { get; set; }
    }

    public class UpdateApplicationStatusDto
    {
        [Required] public ApplicationStatus Status { get; set; }
    }

    public class JobApplicationDto
    {
        public int Id { get; set; }
        public int JobPostingId { get; set; }
        public string JobTitle { get; set; } = string.Empty;
        public int CandidateProfileId { get; set; }
        public string CandidateName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public DateTime AppliedDate { get; set; }
        public string? CoverLetter { get; set; }
        public double? MatchScore { get; set; }
        public int InterviewCount { get; set; }
    }
}
