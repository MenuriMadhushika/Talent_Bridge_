using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using RecruitmentPlatform.API.Services;
using Xunit;

namespace RecruitmentPlatform.Tests.UnitTests
{
    public class EmailNotificationServiceTests
    {
        private static SmtpEmailSender MakeSender(EmailSettings settings) =>
            new(Options.Create(settings), NullLogger<SmtpEmailSender>.Instance);

        [Fact]
        public async Task SendAsync_Disabled_ReturnsFalseWithoutThrowing()
        {
            var sut = MakeSender(new EmailSettings { Enabled = false });

            var result = await sut.SendAsync("candidate@example.com", "Subject", "Body");

            Assert.False(result);
        }

        [Fact]
        public async Task SendAsync_EnabledButNoSmtpHost_ReturnsFalseWithoutThrowing()
        {
            var sut = MakeSender(new EmailSettings { Enabled = true, SmtpHost = "" });

            var result = await sut.SendAsync("candidate@example.com", "Subject", "Body");

            Assert.False(result);
        }

        [Fact]
        public async Task SendAsync_EmptyRecipient_ReturnsFalseWithoutThrowing()
        {
            var sut = MakeSender(new EmailSettings { Enabled = true, SmtpHost = "smtp.example.com", FromAddress = "no-reply@talentbridge.com" });

            var result = await sut.SendAsync("", "Subject", "Body");

            Assert.False(result);
        }

        [Fact]
        public async Task SendAsync_ConfiguredButUnreachableHost_ReturnsFalseWithoutThrowing()
        {
            // Points at a host that won't resolve/connect in a test environment —
            // exercises the try/catch path to confirm SendAsync never throws,
            // it always degrades to false so callers can treat email as best-effort.
            var sut = MakeSender(new EmailSettings
            {
                Enabled = true,
                SmtpHost = "smtp.invalid.nonexistent-domain-for-testing.test",
                SmtpPort = 587,
                FromAddress = "no-reply@talentbridge.com"
            });

            var result = await sut.SendAsync("candidate@example.com", "Subject", "Body");

            Assert.False(result);
        }
    }
}
