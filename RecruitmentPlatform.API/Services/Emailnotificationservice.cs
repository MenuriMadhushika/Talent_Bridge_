using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace RecruitmentPlatform.API.Services
{
    public interface IEmailSender
    {
        /// <summary>Send an email. Returns false (never throws) on failure so
        /// callers can treat email as best-effort and not block on it — same
        /// contract as ISmsSender.</summary>
        Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken ct = default);
    }

    public class EmailSettings
    {
        public bool Enabled { get; set; } = false;
        public string SmtpHost { get; set; } = string.Empty;
        public int SmtpPort { get; set; } = 587;
        public string SmtpUsername { get; set; } = string.Empty;
        public string SmtpPassword { get; set; } = string.Empty;
        public bool UseSsl { get; set; } = true;
        public string FromAddress { get; set; } = string.Empty;
        public string FromName { get; set; } = "Talent Bridge";
    }

    // Sends email via plain SMTP (System.Net.Mail, built into .NET — no
    // SendGrid/Twilio SDK dependency needed) using credentials from
    // EmailSettings. Covers "Email notifications" / "interview reminders" /
    // "application status updates" from the scenario spec, alongside the
    // existing SMS channel in SmsNotificationService and in-app rows in
    // NotificationService. Works with any standard SMTP provider (SES SMTP
    // interface, SendGrid SMTP relay, Office365, Gmail app passwords, etc.)
    // by pointing SmtpHost/SmtpPort/credentials at it — no code change needed
    // to switch providers.
    public class SmtpEmailSender : IEmailSender
    {
        private readonly ILogger<SmtpEmailSender> _logger;
        private readonly EmailSettings _settings;

        public SmtpEmailSender(IOptions<EmailSettings> settings, ILogger<SmtpEmailSender> logger)
        {
            _settings = settings.Value;
            _logger = logger;
        }

        public async Task<bool> SendAsync(string toEmail, string subject, string body, CancellationToken ct = default)
        {
            if (!_settings.Enabled || string.IsNullOrWhiteSpace(_settings.SmtpHost))
            {
                _logger.LogInformation(
                    "Email disabled/unconfigured — would have sent to {Email}: {Subject}", toEmail, subject);
                return false;
            }

            if (string.IsNullOrWhiteSpace(toEmail))
            {
                _logger.LogWarning("Email send skipped — recipient address is empty.");
                return false;
            }

            try
            {
                using var client = new SmtpClient(_settings.SmtpHost, _settings.SmtpPort)
                {
                    EnableSsl = _settings.UseSsl,
                    Credentials = string.IsNullOrWhiteSpace(_settings.SmtpUsername)
                        ? null
                        : new NetworkCredential(_settings.SmtpUsername, _settings.SmtpPassword)
                };

                using var message = new MailMessage
                {
                    From = new MailAddress(_settings.FromAddress, _settings.FromName),
                    Subject = subject,
                    Body = body,
                    IsBodyHtml = false
                };
                message.To.Add(toEmail);

                await client.SendMailAsync(message, ct);
                return true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Email send failed for {Email}", toEmail);
                return false;
            }
        }
    }
}
