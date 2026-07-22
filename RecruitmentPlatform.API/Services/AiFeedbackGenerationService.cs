using RecruitmentPlatform.API.Models.Entities;

namespace RecruitmentPlatform.API.Services
{
    /// <summary>Automated candidate feedback generation, driven by the same
    /// AI provider as resume parsing/matching. Turns a hiring manager's raw
    /// evaluation notes into a short, professional message a recruiter can
    /// send straight to the candidate.</summary>
    public interface IFeedbackGenerationService
    {
        Task<string> GenerateCandidateFeedbackAsync(
            string candidateName, string jobTitle, ApplicationStatus status,
            string? evaluatorNotes, CancellationToken ct = default);
    }

    public class AiFeedbackGenerationService : IFeedbackGenerationService
    {
        private readonly IAiClient _ai;

        private const string SystemPrompt =
            "You write brief, professional, candid but kind candidate feedback " +
            "for a recruitment platform. 3-4 sentences, plain text only, no headers " +
            "or markdown, addressed generically (no 'Dear X' salutation needed).";

        public AiFeedbackGenerationService(IAiClient ai)
        {
            _ai = ai;
        }

        public async Task<string> GenerateCandidateFeedbackAsync(
            string candidateName, string jobTitle, ApplicationStatus status,
            string? evaluatorNotes, CancellationToken ct = default)
        {
            var userPrompt =
                $"Candidate: {candidateName}\n" +
                $"Role: {jobTitle}\n" +
                $"Decision: {status}\n" +
                $"Evaluator notes: {evaluatorNotes ?? "(none provided)"}\n" +
                "Write the feedback message to send to the candidate.";

            var raw = await _ai.CompleteAsync(SystemPrompt, userPrompt, ct);

            // Never leave a recruiter with nothing to send just because the
            // AI provider is unconfigured or had an outage.
            return string.IsNullOrWhiteSpace(raw)
                ? $"Thank you for applying for the {jobTitle} position. After careful review, " +
                  $"we're updating your application status to: {status}."
                : raw.Trim();
        }
    }
}
