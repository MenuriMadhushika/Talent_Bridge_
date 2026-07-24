using System.Text.Json;

namespace RecruitmentPlatform.API.Services
{
    /// <summary>Result of an AI-backed candidate/job match: not just a
    /// score, but the reasoning a recruiter would want when screening —
    /// which required skills the candidate has and which they're missing.</summary>
    public record CandidateMatchResult(double Score, string? Explanation, List<string> MatchedSkills, List<string> MissingSkills);

    public interface IMatchingService
    {
        /// <summary>Kept for any synchronous call sites / unit tests. Prefer
        /// ComputeMatchAsync — a real AI call is I/O and must not be done sync-over-async.</summary>
        double ComputeMatchScore(string? candidateSkills, string? requiredSkills);

        /// <summary>Score how well a candidate's skills match a job posting's
        /// required skills (0-100), with an explanation for recruiters.</summary>
        Task<CandidateMatchResult> ComputeMatchAsync(string? candidateSkills, string? requiredSkills, CancellationToken ct = default);
    }

    // Lightweight, dependency-free skill-overlap matcher. No external
    // dependency, so it also acts as the automatic fallback when the AI
    // provider is unconfigured or unreachable — see AiMatchingService below.
    //skillmatchingservice
    public class SkillMatchingService : IMatchingService
    {
        public double ComputeMatchScore(string? candidateSkills, string? requiredSkills)
        {
            var required = Normalize(requiredSkills);
            if (required.Count == 0) return 0;

            var candidate = Normalize(candidateSkills);
            var overlap = required.Intersect(candidate).Count();

            var score = (double)overlap / required.Count * 100;
            return Math.Round(score, 1);
        }

        public Task<CandidateMatchResult> ComputeMatchAsync(string? candidateSkills, string? requiredSkills, CancellationToken ct = default)
        {
            var required = Normalize(requiredSkills);
            var candidate = Normalize(candidateSkills);
            var matched = required.Intersect(candidate).ToList();
            var missing = required.Except(candidate).ToList();

            return Task.FromResult(new CandidateMatchResult(
                ComputeMatchScore(candidateSkills, requiredSkills), null, matched, missing));
        }

        private static HashSet<string> Normalize(string? value) =>
            (value ?? string.Empty)
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(s => s.ToLowerInvariant())
                .ToHashSet();
    }

    // Real AI-backed candidate-job matching: sends both skill sets to the
    // configured AI provider and asks for a score plus a short rationale,
    // which is far more useful to a recruiter screening a pipeline than a
    // bare percentage. Falls back to plain skill-overlap scoring if the AI
    // provider is disabled, unconfigured, unreachable, or returns
    // something that doesn't parse — application submission must never
    // fail just because the AI provider had a bad moment.
    //Aimatchingservice
    public class AiMatchingService : IMatchingService
    {
        private readonly IAiClient _ai;
        private readonly SkillMatchingService _fallback = new();
        private readonly ILogger<AiMatchingService> _logger;

        private const string SystemPrompt =
            "You are a candidate-job matching engine for a recruitment platform. " +
            "Given a candidate's skills and a job's required skills, respond ONLY " +
            "with raw JSON, no markdown code fences, in exactly this shape: " +
            "{\"score\": 0-100 number, \"matchedSkills\": [\"...\"], \"missingSkills\": [\"...\"], " +
            "\"explanation\": \"1-2 sentence rationale for a recruiter\"}.";

        public AiMatchingService(IAiClient ai, ILogger<AiMatchingService> logger)
        {
            _ai = ai;
            _logger = logger;
        }

        public double ComputeMatchScore(string? candidateSkills, string? requiredSkills) =>
            _fallback.ComputeMatchScore(candidateSkills, requiredSkills);

        public async Task<CandidateMatchResult> ComputeMatchAsync(string? candidateSkills, string? requiredSkills, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(requiredSkills))
                return new CandidateMatchResult(0, null, new List<string>(), new List<string>());

            var userPrompt = $"Candidate skills: {candidateSkills}\nRequired skills: {requiredSkills}";
            var raw = await _ai.CompleteAsync(SystemPrompt, userPrompt, ct);

            if (string.IsNullOrWhiteSpace(raw))
                return await _fallback.ComputeMatchAsync(candidateSkills, requiredSkills, ct);

            try
            {
                var cleaned = AiJson.StripFences(raw);
                using var doc = JsonDocument.Parse(cleaned);

                var score = doc.RootElement.GetProperty("score").GetDouble();
                var matched = doc.RootElement.TryGetProperty("matchedSkills", out var m)
                    ? m.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => s != "").ToList()
                    : new List<string>();
                var missing = doc.RootElement.TryGetProperty("missingSkills", out var mi)
                    ? mi.EnumerateArray().Select(x => x.GetString() ?? "").Where(s => s != "").ToList()
                    : new List<string>();
                var explanation = doc.RootElement.TryGetProperty("explanation", out var e) ? e.GetString() : null;

                return new CandidateMatchResult(Math.Round(score, 1), explanation, matched, missing);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "AI match response was not valid JSON, falling back to skill-overlap scoring.");
                return await _fallback.ComputeMatchAsync(candidateSkills, requiredSkills, ct);
            }
        }
    }
}

