using System.ComponentModel.DataAnnotations;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class CreateEvaluationDto
    {
        [Required] public int JobApplicationId { get; set; }
        [Range(0, 100)] public int TechnicalScore { get; set; }
        [Range(0, 100)] public int CommunicationScore { get; set; }
        [Range(0, 100)] public int CultureFitScore { get; set; }
        public string? Comments { get; set; }
        public bool Recommended { get; set; }
    }

    public class EvaluationDto
    {
        public int Id { get; set; }
        public int JobApplicationId { get; set; }
        public string CandidateName { get; set; } = string.Empty;
        public string JobTitle { get; set; } = string.Empty;
        public string EvaluatorUserId { get; set; } = string.Empty;
        public string EvaluatorName { get; set; } = string.Empty;
        public int TechnicalScore { get; set; }
        public int CommunicationScore { get; set; }
        public int CultureFitScore { get; set; }
        public double OverallScore { get; set; }
        public string? Comments { get; set; }
        public bool Recommended { get; set; }
        public DateTime EvaluatedAt { get; set; }
    }
}
