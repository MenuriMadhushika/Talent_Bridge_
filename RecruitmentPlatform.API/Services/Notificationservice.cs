using Microsoft.AspNetCore.Identity;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;

namespace RecruitmentPlatform.API.Services
{
    public interface INotificationService
    {
        /// <summary>Queue an in-app notification for a user, and best-effort
        /// fan it out to email and SMS (if the user has a phone number on
        /// file). This is the trigger point for "Email notifications / SMS
        /// notifications / interview reminders / application status
        /// updates".</summary>
        ///Task notify
        Task NotifyAsync(string userId, string title, string message);
    }

    public class NotificationService : INotificationService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly ISmsSender _smsSender;
        private readonly IEmailSender _emailSender;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ILogger<NotificationService> _logger;

        public NotificationService(
            IUnitOfWork unitOfWork,
            ISmsSender smsSender,
            IEmailSender emailSender,
            UserManager<ApplicationUser> userManager,
            ILogger<NotificationService> logger)
        {
            _unitOfWork = unitOfWork;
            _smsSender = smsSender;
            _emailSender = emailSender;
            _userManager = userManager;
            _logger = logger;
        }

        public async Task NotifyAsync(string userId, string title, string message)
        {
            await _unitOfWork.Notifications.AddAsync(new Notification
            {
                UserId = userId,
                Title = title,
                Message = message
            });

            // Best-effort email + SMS fan-out: in-app notification is always
            // the source of truth, email/SMS are convenience channels and
            // must never block or fail the caller's transaction (e.g. an
            // application status update shouldn't fail to save just because
            // the SMTP server or Twilio is down).
            //
            // NOTE: in production, gate SMS on user.PhoneNumberConfirmed
            // (i.e. verify the number via an OTP flow) before texting it —
            // this prototype sends to any phone number on file. Email is
            // gated on EmailConfirmed since ASP.NET Identity registration
            // already establishes that.
            ///
            var user = await _userManager.FindByIdAsync(userId);
            if (user is null) return;

            try
            {
                if (!string.IsNullOrWhiteSpace(user.Email) && user.EmailConfirmed)
                {
                    await _emailSender.SendAsync(user.Email, title, message);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Email notification fan-out failed for user {UserId}", userId);
            }

            try
            {
                if (!string.IsNullOrWhiteSpace(user.PhoneNumber))
                {
                    await _smsSender.SendAsync(user.PhoneNumber, $"{title}: {message}");
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "SMS notification fan-out failed for user {UserId}", userId);
            }
        }
    }
}
