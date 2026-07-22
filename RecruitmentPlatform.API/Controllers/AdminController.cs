using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Hosting;
using RecruitmentPlatform.API.Models.DTOs;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;
using RecruitmentPlatform.API.Services;
using System.Security.Claims;

namespace RecruitmentPlatform.API.Controllers
{
    [ApiController]
    [Route("api/admin")]
    [Authorize(Roles = Roles.Admin)]
    public class AdminController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly IAuditService _auditService;

        private static readonly string[] AssignableRoles =
        {
            Roles.Candidate, Roles.Recruiter, Roles.HiringManager, Roles.Admin
        };

        public AdminController(IUnitOfWork unitOfWork, UserManager<ApplicationUser> userManager, IAuditService auditService)
        {
            _unitOfWork = unitOfWork;
            _userManager = userManager;
            _auditService = auditService;
        }

        private string CurrentUserId =>
    User.FindFirst(ClaimTypes.NameIdentifier)?.Value ??
    User.FindFirst("sub")?.Value ??
    string.Empty;
        /// <summary>Admin: list all platform users with their role, organization, and status.</summary>
        [HttpGet("users")]
        public async Task<IActionResult> GetUsers([FromQuery] string? role)
        {
            var users = await _userManager.Users
                .Include(u => u.Organization)
                .OrderBy(u => u.LastName)
                .ToListAsync();

            var results = new List<AdminUserDto>();
            foreach (var user in users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                var userRole = roles.FirstOrDefault() ?? string.Empty;

                if (!string.IsNullOrWhiteSpace(role) && !string.Equals(userRole, role, StringComparison.OrdinalIgnoreCase))
                    continue;

                results.Add(new AdminUserDto
                {
                    Id = user.Id,
                    FullName = $"{user.FirstName} {user.LastName}".Trim(),
                    Email = user.Email ?? string.Empty,
                    Role = userRole,
                    OrganizationName = user.Organization?.Name,
                    IsActive = user.IsActive,
                    CreatedAt = user.CreatedAt
                });
            }

            return Ok(results);
        }
// test admin fuction
//
        /// <summary>Admin: activate or deactivate a user account (e.g. offboarding a recruiter).</summary>
        /// <summary>
/// Admin: Toggle account active status to enable or disable user platform access.
/// </summary>
        [HttpPut("users/{id}/toggle-active")]
        public async Task<IActionResult> ToggleActive(string id)
        {
            var user = await _userManager.FindByIdAsync(id);
            if (user is null) return NotFound();

            user.IsActive = !user.IsActive;
            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return BadRequest(new { error = string.Join("; ", result.Errors.Select(e => e.Description)) });

            await _auditService.LogAsync(CurrentUserId, "UserActiveStatusToggled", "ApplicationUser", id, $"IsActive={user.IsActive}");
            await _unitOfWork.SaveChangesAsync();

            return Ok(new { user.Id, user.IsActive });
        }

        /// <summary>Admin: reassign a user's role (role & permission management).</summary>
        [HttpPut("users/{id}/role")]
        public async Task<IActionResult> ChangeRole(string id, [FromBody] UpdateUserRoleDto dto)
        {
            if (!AssignableRoles.Contains(dto.Role))
                return BadRequest(new { error = $"Unknown role '{dto.Role}'." });

            var user = await _userManager.FindByIdAsync(id);
            if (user is null) return NotFound();

            var currentRoles = await _userManager.GetRolesAsync(user);
            var removeResult = await _userManager.RemoveFromRolesAsync(user, currentRoles);
            if (!removeResult.Succeeded)
                return BadRequest(new { error = string.Join("; ", removeResult.Errors.Select(e => e.Description)) });

            var addResult = await _userManager.AddToRoleAsync(user, dto.Role);
            if (!addResult.Succeeded)
                return BadRequest(new { error = string.Join("; ", addResult.Errors.Select(e => e.Description)) });

            await _auditService.LogAsync(CurrentUserId, "UserRoleChanged", "ApplicationUser", id, $"NewRole={dto.Role}");
            await _unitOfWork.SaveChangesAsync();

            return NoContent();
        }

        /// <summary>Admin: platform-wide recruitment analytics dashboard.</summary>
        [HttpGet("analytics")]
        public async Task<IActionResult> GetAnalytics()
        {
            var candidateCount = (await _userManager.GetUsersInRoleAsync(Roles.Candidate)).Count;
            var recruiterCount = (await _userManager.GetUsersInRoleAsync(Roles.Recruiter)).Count;
            var hiringManagerCount = (await _userManager.GetUsersInRoleAsync(Roles.HiringManager)).Count;
            var adminCount = (await _userManager.GetUsersInRoleAsync(Roles.Admin)).Count;

            var postings = await _unitOfWork.JobPostings.Query().ToListAsync();
            var applications = await _unitOfWork.JobApplications.Query().ToListAsync();
            var interviews = await _unitOfWork.Interviews.Query().ToListAsync();

            var analytics = new RecruitmentAnalyticsDto
            {
                TotalCandidates = candidateCount,
                TotalRecruiters = recruiterCount,
                TotalHiringManagers = hiringManagerCount,
                TotalAdmins = adminCount,
                TotalOrganizations = await _unitOfWork.Organizations.Query().CountAsync(),
                TotalDepartments = await _unitOfWork.Departments.Query().CountAsync(),

                OpenPostings = postings.Count(p => p.Status == JobPostingStatus.Open),
                DraftPostings = postings.Count(p => p.Status == JobPostingStatus.Draft),
                ClosedPostings = postings.Count(p => p.Status is JobPostingStatus.Closed or JobPostingStatus.Archived),

                TotalApplications = applications.Count,
                ApplicationsByStatus = applications
                    .GroupBy(a => a.Status.ToString())
                    .ToDictionary(g => g.Key, g => g.Count()),

                InterviewsScheduled = interviews.Count(i => i.Status == InterviewStatus.Scheduled),
                TotalHires = applications.Count(a => a.Status == ApplicationStatus.Hired),
                AverageMatchScore = applications.Any(a => a.MatchScore.HasValue)
                    ? Math.Round(applications.Where(a => a.MatchScore.HasValue).Average(a => a.MatchScore!.Value), 1)
                    : 0
            };

            return Ok(analytics);
        }

        /// <summary>Admin: monthly hiring trend analysis — postings opened, applications
        /// received, and hires, bucketed by calendar month, for the trend chart on the
        /// analytics dashboard.</summary>
        [HttpGet("analytics/trends")]
        public async Task<IActionResult> GetHiringTrends([FromQuery] int months = 6)
        {
            months = Math.Clamp(months, 1, 24);

            // Anchor to the first day of the current month (UTC), then walk back.
            var now = DateTime.UtcNow;
            var currentMonthStart = new DateTime(now.Year, now.Month, 1, 0, 0, 0, DateTimeKind.Utc);
            var rangeStart = currentMonthStart.AddMonths(-(months - 1));

            var postings = await _unitOfWork.JobPostings.Query()
                .Where(p => p.PostedDate >= rangeStart)
                .Select(p => p.PostedDate)
                .ToListAsync();

            var applications = await _unitOfWork.JobApplications.Query()
                .Where(a => a.AppliedDate >= rangeStart)
                .Select(a => new { a.AppliedDate, a.Status })
                .ToListAsync();

            var points = new List<HiringTrendPointDto>();
            for (var i = 0; i < months; i++)
            {
                var monthStart = rangeStart.AddMonths(i);
                var monthEnd = monthStart.AddMonths(1);

                points.Add(new HiringTrendPointDto
                {
                    Month = monthStart.ToString("yyyy-MM"),
                    PostingsOpened = postings.Count(d => d >= monthStart && d < monthEnd),
                    ApplicationsReceived = applications.Count(a => a.AppliedDate >= monthStart && a.AppliedDate < monthEnd),
                    // Hire date isn't tracked separately from applied date in this schema,
                    // so hires are attributed to the month the application was submitted.
                    Hires = applications.Count(a => a.AppliedDate >= monthStart && a.AppliedDate < monthEnd
                        && a.Status == ApplicationStatus.Hired)
                });
            }

            return Ok(new HiringTrendsDto { Months = months, Points = points });
        }

        /// <summary>Admin: recent audit trail — who did what, when.</summary>
        [HttpGet("audit-logs")]
        public async Task<IActionResult> GetAuditLogs([FromQuery] int take = 100)
        {
            var logs = await _unitOfWork.AuditLogs.Query()
                .Include(a => a.User)
                .OrderByDescending(a => a.OccurredAt)
                .Take(Math.Clamp(take, 1, 500))
                .ToListAsync();

            return Ok(logs.Select(a => new AuditLogDto
            {
                Id = a.Id,
                UserName = a.User is null ? "Unknown" : $"{a.User.FirstName} {a.User.LastName}".Trim(),
                Action = a.Action,
                EntityType = a.EntityType,
                EntityId = a.EntityId,
                Details = a.Details,
                OccurredAt = a.OccurredAt
            }));
        }

        /// <summary>Admin: basic system monitoring — DB connectivity, process
        /// uptime, and environment, surfaced on the admin dashboard.</summary>
        [HttpGet("system-health")]
        public async Task<IActionResult> GetSystemHealth([FromServices] IHostEnvironment env)
        {
            bool dbReachable;
            try
            {
                dbReachable = await _unitOfWork.Organizations.Query().AnyAsync() || true;
            }
            catch
            {
                dbReachable = false;
            }

            var health = new SystemHealthDto
            {
                Status = dbReachable ? "Healthy" : "Degraded",
                DatabaseReachable = dbReachable,
                Environment = env.EnvironmentName,
                ServerTimeUtc = DateTime.UtcNow,
                Uptime = DateTime.UtcNow - System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime(),
                TotalUsers = await _userManager.Users.CountAsync(),
                TotalAuditLogEntries = await _unitOfWork.AuditLogs.Query().CountAsync()
            };

            return Ok(health);
        }
    }
}
