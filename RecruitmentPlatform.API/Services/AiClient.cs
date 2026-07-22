using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Options;

namespace RecruitmentPlatform.API.Services
{
    /// <summary>Thin wrapper around a real external AI provider's completion
    /// endpoint. This implementation talks to OpenAI's Chat Completions API.
    /// Centralizes the HTTP call, auth header, and error handling so resume
    /// parsing, candidate matching, and feedback generation all share one
    /// client — callers (AiResumeParsingService, AiMatchingService,
    /// AiFeedbackGenerationService) never change, only this file does.</summary>
    public interface IAiClient
    {
        /// <summary>Send a single-turn prompt and get back the model's raw text response.
        /// Returns an empty string on any failure so callers can degrade gracefully
        /// instead of throwing and breaking resume upload / application submission.</summary>
        Task<string> CompleteAsync(string systemPrompt, string userPrompt, CancellationToken ct = default);
    }

    public class AiSettings
    {
        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "gpt-4o-mini";
        public bool Enabled { get; set; } = true;
    }

    public class OpenAiClient : IAiClient
    {
        private readonly HttpClient _http;
        private readonly ILogger<OpenAiClient> _logger;
        private readonly AiSettings _settings;
        private static bool _headersConfigured;

        public OpenAiClient(HttpClient http, IOptions<AiSettings> settings, ILogger<OpenAiClient> logger)
        {
            _http = http;
            _settings = settings.Value;
            _logger = logger;

            if (!_headersConfigured)
            {
                _http.BaseAddress = new Uri("https://api.openai.com/");
                if (!string.IsNullOrWhiteSpace(_settings.ApiKey))
                    _http.DefaultRequestHeaders.Add("Authorization", $"Bearer {_settings.ApiKey}");
                _headersConfigured = true;
            }
        }

        public async Task<string> CompleteAsync(string systemPrompt, string userPrompt, CancellationToken ct = default)
        {
            if (!_settings.Enabled || string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                _logger.LogInformation("AI provider disabled/unconfigured — caller should fall back to local logic.");
                return string.Empty;
            }

            var payload = new
            {
                model = _settings.Model,
                max_tokens = 1024,
                messages = new object[]
                {
                    new { role = "system", content = systemPrompt },
                    new { role = "user", content = userPrompt }
                }
            };

            using var content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

            try
            {
                var response = await _http.PostAsync("v1/chat/completions", content, ct);
                if (!response.IsSuccessStatusCode)
                {
                    var errBody = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("AI provider returned {Status}: {Body}", response.StatusCode, errBody);
                    return string.Empty;
                }

                var body = await response.Content.ReadAsStringAsync(ct);
                using var doc = JsonDocument.Parse(body);

                var choices = doc.RootElement.GetProperty("choices");
                if (choices.GetArrayLength() == 0) return string.Empty;

                return choices[0].GetProperty("message").GetProperty("content").GetString() ?? string.Empty;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AI provider call failed");
                return string.Empty;
            }
        }
    }

    /// <summary>Small shared helper for cleaning up JSON that AI models
    /// sometimes wrap in markdown code fences despite being told not to.</summary>
    public static class AiJson
    {
        public static string StripFences(string raw)
        {
            var text = raw.Trim();
            if (text.StartsWith("```"))
            {
                var firstNewline = text.IndexOf('\n');
                if (firstNewline >= 0) text = text[(firstNewline + 1)..];
                var lastFence = text.LastIndexOf("```", StringComparison.Ordinal);
                if (lastFence >= 0) text = text[..lastFence];
            }
            return text.Trim();
        }
    }
}