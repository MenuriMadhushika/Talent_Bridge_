using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruitmentPlatform.API.Models.DTOs;
using RecruitmentPlatform.API.Repositories;

namespace RecruitmentPlatform.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    /// <summary>
/// Manages user in-app notifications, including listing recent alerts,
/// tracking unread counts for UI notification badges, and marking items as read.
/// </summary>
    public class NotificationsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;

        public NotificationsController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        private string CurrentUserId =>
            User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub") ?? string.Empty;

        /// <summary>Current user's notifications, newest first.</summary>
        [HttpGet("me")]
        public async Task<IActionResult> GetMine()
        {
            var notifications = await _unitOfWork.Notifications.Query()
                .Where(n => n.UserId == CurrentUserId)
                .OrderByDescending(n => n.CreatedAt)
                .Take(50)
                .ToListAsync();

            return Ok(notifications.Select(n => new NotificationDto
            {
                Id = n.Id,
                Title = n.Title,
                Message = n.Message,
                IsRead = n.IsRead,
                CreatedAt = n.CreatedAt
            }));
        }

        /// <summary>Unread count, for a badge on the notification bell.</summary>
        [HttpGet("me/unread-count")]
        public async Task<IActionResult> GetUnreadCount()
        {
            var count = await _unitOfWork.Notifications.Query()
                .CountAsync(n => n.UserId == CurrentUserId && !n.IsRead);

            return Ok(new { count });
        }

        /// <summary>Mark a single notification as read.</summary>
        [HttpPut("{id:int}/read")]
        public async Task<IActionResult> MarkRead(int id)
        {
            var notification = await _unitOfWork.Notifications.GetByIdAsync(id);
            if (notification is null || notification.UserId != CurrentUserId) return NotFound();

            notification.IsRead = true;
            _unitOfWork.Notifications.Update(notification);
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Mark everything as read.</summary>
        [HttpPut("me/read-all")]
        public async Task<IActionResult> MarkAllRead()
        {
            var unread = await _unitOfWork.Notifications.FindAsync(n => n.UserId == CurrentUserId && !n.IsRead);
            foreach (var n in unread)
            {
                n.IsRead = true;
                _unitOfWork.Notifications.Update(n);
            }
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }
    }
}
