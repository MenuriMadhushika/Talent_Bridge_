using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Options;

namespace RecruitmentPlatform.API.Services
{
    public interface ISmsSender
    {
        /// <summary>Send an SMS.
        /// Returns false (never throws) on failure so
        /// callers can treat SMS as best-effort and not block on it.</summary>
        Task<bool> SendAsync(string toPhoneNumber, string message, CancellationToken ct = default);
    }

    public class SmsSettings
    {
        public bool Enabled { get; set; } = false;
        public string AccountSid { get; set; } = string.Empty;
        public string AuthToken { get; set; } = string.Empty;
        public string FromNumber { get; set; } = string.Empty;
    }

    // Sends SMS via Twilio's REST API directly (Basic Auth over HttpClient),
    // avoiding a dependency on the Twilio NuGet SDK. Covers "SMS
    // notifications" / "interview reminders" / "application status updates"
    // from the scenario spec, alongside the existing in-app + (to be added)
    // email channels in NotificationService.
    public class TwilioSmsSender : ISmsSender
    {
        private readonly HttpClient _http;
        private readonly ILogger<TwilioSmsSender> _logger;
        private readonly SmsSettings _settings;
        private static bool _headersConfigured;

        public TwilioSmsSender(HttpClient http, IOptions<SmsSettings> settings, ILogger<TwilioSmsSender> logger)
        {
            _http = http;
            _settings = settings.Value;
            _logger = logger;

            if (!_headersConfigured)
            {
                _http.BaseAddress = new Uri("https://api.twilio.com/");
                if (!string.IsNullOrWhiteSpace(_settings.AccountSid))
                {
                    var authBytes = Encoding.ASCII.GetBytes($"{_settings.AccountSid}:{_settings.AuthToken}");
                    _http.DefaultRequestHeaders.Authorization =
                        new AuthenticationHeaderValue("Basic", Convert.ToBase64String(authBytes));
                }
                _headersConfigured = true;
            }
        }

        public async Task<bool> SendAsync(string toPhoneNumber, string message, CancellationToken ct = default)
        {
            if (!_settings.Enabled || string.IsNullOrWhiteSpace(_settings.AccountSid))
            {
                _logger.LogInformation("SMS disabled/unconfigured — would have sent to {Number}: {Message}", toPhoneNumber, message);
                return false;
            }

            var form = new Dictionary<string, string>
            {
                ["To"] = toPhoneNumber,
                ["From"] = _settings.FromNumber,
                ["Body"] = message
            };

            try
            {
                var response = await _http.PostAsync(
                    $"2010-04-01/Accounts/{_settings.AccountSid}/Messages.json",
                    new FormUrlEncodedContent(form), ct);

                if (!response.IsSuccessStatusCode)
                {
                    var body = await response.Content.ReadAsStringAsync(ct);
                    _logger.LogWarning("SMS send failed ({Status}): {Body}", response.StatusCode, body);
                    return false;
                }

                return true;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMS send threw an exception");
                return false;
            }
        }
    }
}
