using System.ComponentModel.DataAnnotations;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class RegisterDto
    {
        [Required] public string FirstName { get; set; } = string.Empty;
        [Required] public string LastName { get; set; } = string.Empty;
        [Required, EmailAddress] public string Email { get; set; } = string.Empty;
        [Required, MinLength(8)] public string Password { get; set; } = string.Empty;

        // Which portal the account is for: Candidate, Recruiter, HiringManager, Admin.
        // Admin accounts should realistically be created by an existing Admin,
        // not via public self-registration - enforce that in AuthService.
        [Required] public string Role { get; set; } = string.Empty;

        public int? OrganizationId { get; set; } // required for Recruiter/HiringManager/Admin
    }

    public class LoginDto
    {
        [Required, EmailAddress] public string Email { get; set; } = string.Empty;
        [Required] public string Password { get; set; } = string.Empty;
    }

    public class AuthResponseDto
    {
        public string Token { get; set; } = string.Empty;
        public DateTime ExpiresAt { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public int? OrganizationId { get; set; }
        public string? OrganizationName { get; set; }
    }
}
