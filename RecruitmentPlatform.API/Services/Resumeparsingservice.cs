using System.Text.Json;

namespace RecruitmentPlatform.API.Services
{
    public interface IResumeParsingService
    {
        /// <summary>Kept for any synchronous call sites / unit tests. Prefer
        /// ParseAsync — a real AI call is I/O and must not be done sync-over-async.</summary>
        (string? skills, string? summary) Parse(string? resumeText);

        /// <summary>Extract a comma-separated skills list and a short summary
        /// from raw resume text. Returns (null, null) if text is empty.</summary>
        Task<(string? skills, string? summary)> ParseAsync(string? resumeText, CancellationToken ct = default);
    }

    // Keyword-matching resume parser: scans the resume text against a fixed
    // vocabulary of common tech/business skills. No external dependency, so
    // it also acts as the automatic fallback when the AI provider is
    // unconfigured or unreachable — see AiResumeParsingService below.
    //
    // Honest limitation: this only works on plain text. Extracting text
    // from PDF/DOCX would need an additional parsing library; this
    // prototype only auto-parses .txt uploads (or pasted text) and stores
    // other file types as-is without parsing.
    public class KeywordResumeParsingService : IResumeParsingService
    {
        private static readonly string[] KnownSkills =
        {
            "C#", ".NET", "ASP.NET", "Java", "Python", "JavaScript", "TypeScript",
            "React", "Angular", "Vue", "Node.js", "SQL", "SQL Server", "PostgreSQL",
            "MySQL", "MongoDB", "AWS", "Azure", "GCP", "Docker", "Kubernetes",
            "CI/CD", "Git", "REST", "GraphQL", "HTML", "CSS", "Agile", "Scrum",
            "Project Management", "Communication", "Leadership", "Data Analysis",
            "Machine Learning", "AI", "DevOps", "Testing", "QA", "Excel",
            "PowerPoint", "Sales", "Marketing", "Customer Service", "Negotiation",
        };

        public (string? skills, string? summary) Parse(string? resumeText)
        {
            if (string.IsNullOrWhiteSpace(resumeText)) return (null, null);

            var found = KnownSkills
                .Where(skill => resumeText.Contains(skill, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var skills = found.Count > 0 ? string.Join(", ", found) : null;

            var trimmed = resumeText.Trim();
            var summary = trimmed.Length <= 280 ? trimmed : trimmed[..280] + "…";

            return (skills, summary);
        }

        public Task<(string? skills, string? summary)> ParseAsync(string? resumeText, CancellationToken ct = default)
            => Task.FromResult(Parse(resumeText));
    }

    // Real AI-backed resume parser: sends the resume text to the configured
    // AI provider (see AiClient.cs / AiSettings) and asks for structured
    // skills + a professional summary. Falls back to the keyword parser if
    // the AI provider is disabled, unconfigured, unreachable, or returns
    // something that doesn't parse as valid JSON — resume upload must never
    // fail just because the AI provider had a bad moment.
    public class AiResumeParsingService : IResumeParsingService
    {
        private readonly IAiClient _ai;
        private readonly KeywordResumeParsingService _fallback = new();
        private readonly ILogger<AiResumeParsingService> _logger;

        private const string SystemPrompt =
            "You are a resume-parsing assistant for a recruitment platform. " +
            "Given raw resume text, extract the candidate's skills and a short " +
            "professional summary. Respond ONLY with raw JSON, no markdown code " +
            "fences, in exactly this shape: " +
            "{\"skills\": \"comma, separated, skills\", \"summary\": \"2-3 sentence summary\"}.";

        public AiResumeParsingService(IAiClient ai, ILogger<AiResumeParsingService> logger)
        {
            _ai = ai;
            _logger = logger;
        }

        public (string? skills, string? summary) Parse(string? resumeText) => _fallback.Parse(resumeText);

        public async Task<(string? skills, string? summary)> ParseAsync(string? resumeText, CancellationToken ct = default)
        {
            if (string.IsNullOrWhiteSpace(resumeText)) return (null, null);

            var raw = await _ai.CompleteAsync(SystemPrompt, resumeText, ct);
            if (string.IsNullOrWhiteSpace(raw)) return _fallback.Parse(resumeText);

            try
            {
                var cleaned = AiJson.StripFences(raw);
                using var doc = JsonDocument.Parse(cleaned);
                var skills = doc.RootElement.TryGetProperty("skills", out var s) ? s.GetString() : null;
                var summary = doc.RootElement.TryGetProperty("summary", out var sm) ? sm.GetString() : null;
                return (skills, summary);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "AI resume parse returned non-JSON output, falling back to keyword parser.");
                return _fallback.Parse(resumeText);
            }
        }
    }
}
