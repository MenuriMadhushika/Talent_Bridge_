using Microsoft.AspNetCore.Identity;
using RecruitmentPlatform.API.Models.DTOs;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;

namespace RecruitmentPlatform.API.Services
{
    public interface IAuthService
    {
        Task<(bool succeeded, string? error, AuthResponseDto? result)> RegisterAsync(RegisterDto dto);
        Task<(bool succeeded, string? error, AuthResponseDto? result)> LoginAsync(LoginDto dto);
    }

    // Orchestrates ASP.NET Identity (for credential storage/hashing) with our
    // own domain profiles (CandidateProfile / RecruiterProfile) and the
    // Unit of Work so profile creation is atomic with the Identity user creation.
    //authservice
    public class AuthService : IAuthService
    {
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly ITokenService _tokenService;
        private readonly IUnitOfWork _unitOfWork;

        private static readonly string[] AllowedSelfRegisterRoles =
        {
            Roles.Candidate, Roles.Recruiter, Roles.HiringManager
        };

        public AuthService(UserManager<ApplicationUser> userManager, ITokenService tokenService, IUnitOfWork unitOfWork)
        {
            _userManager = userManager;
            _tokenService = tokenService;
            _unitOfWork = unitOfWork;
        }

        public async Task<(bool, string?, AuthResponseDto?)> RegisterAsync(RegisterDto dto)
        {
            // Clients may send the role in any casing (e.g. "candidate"); match it
            // case-insensitively and normalize to the canonical stored casing so the
            // rest of this method and ASP.NET Identity role assignment stay consistent.
            //role
            var role = AllowedSelfRegisterRoles.FirstOrDefault(r => string.Equals(r, dto.Role, StringComparison.OrdinalIgnoreCase));
            if (role is null)
                return (false, "Admin accounts cannot be self-registered. Contact a system administrator.", null);

            if (role != Roles.Candidate && dto.OrganizationId is null)
                return (false, "OrganizationId is required for Recruiter and HiringManager accounts.", null);

            var existing = await _userManager.FindByEmailAsync(dto.Email);
            if (existing is not null)
                return (false, "An account with this email already exists.", null);

            var user = new ApplicationUser
            {
                UserName = dto.Email,
                Email = dto.Email,
                FirstName = dto.FirstName,
                LastName = dto.LastName,
                OrganizationId = role == Roles.Candidate ? null : dto.OrganizationId,
                // There's no confirm-email link/endpoint implemented in this
                // prototype, so gating notification emails on EmailConfirmed
                // (see NotificationService) would otherwise mean email never
                // sends for any self-registered user. Treat registration as
                // sufficient trust for now, same as the seeded demo user in
                // Program.cs.
                EmailConfirmed = true
            };

            var createResult = await _userManager.CreateAsync(user, dto.Password);
            if (!createResult.Succeeded)
                return (false, string.Join("; ", createResult.Errors.Select(e => e.Description)), null);

            await _userManager.AddToRoleAsync(user, role);

            // Create the role-specific profile in the same logical operation.
            if (role == Roles.Candidate)
            {
                await _unitOfWork.CandidateProfiles.AddAsync(new CandidateProfile { UserId = user.Id });
            }
            else if (role == Roles.Recruiter)
            {
                await _unitOfWork.RecruiterProfiles.AddAsync(new RecruiterProfile { UserId = user.Id });
            }
            await _unitOfWork.SaveChangesAsync();

            var roles = await _userManager.GetRolesAsync(user);
            var (token, expiresAt) = _tokenService.GenerateToken(user, roles);
            var orgName = await GetOrganizationNameAsync(user.OrganizationId);

            return (true, null, ToAuthResponse(user, token, expiresAt, roles.First(), orgName));
        }

        public async Task<(bool, string?, AuthResponseDto?)> LoginAsync(LoginDto dto)
        {
            var user = await _userManager.FindByEmailAsync(dto.Email);
            if (user is null || !user.IsActive)
                return (false, "Invalid credentials.", null);

            var passwordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
            if (!passwordValid)
                return (false, "Invalid credentials.", null);

            var roles = await _userManager.GetRolesAsync(user);
            var (token, expiresAt) = _tokenService.GenerateToken(user, roles);
            var orgName = await GetOrganizationNameAsync(user.OrganizationId);

            return (true, null, ToAuthResponse(user, token, expiresAt, roles.FirstOrDefault() ?? string.Empty, orgName));
        }

        private async Task<string?> GetOrganizationNameAsync(int? organizationId)
        {
            if (organizationId is null) return null;
            var org = await _unitOfWork.Organizations.GetByIdAsync(organizationId.Value);
            return org?.Name;
        }

        private static AuthResponseDto ToAuthResponse(ApplicationUser user, string token, DateTime expiresAt, string role, string? organizationName) => new()
        {
            Token = token,
            ExpiresAt = expiresAt,
            UserId = user.Id,
            Email = user.Email ?? string.Empty,
            FullName = $"{user.FirstName} {user.LastName}",
            Role = role,
            OrganizationId = user.OrganizationId,
            OrganizationName = organizationName
        };
    }
}
