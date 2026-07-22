using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.Extensions.Options;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Services;
using Xunit;

namespace RecruitmentPlatform.Tests.UnitTests
{
    public class TokenServiceTests
    {
        private static JwtTokenService CreateSut() =>
            new(Options.Create(new JwtSettings
            {
                Secret = "UnitTestSuperSecretKeyThatIsLongEnough32Chars!!",
                Issuer = "TestIssuer",
                Audience = "TestAudience",
                ExpiryMinutes = 60
            }));

        private static ApplicationUser CreateUser() => new()
        {
            Id = "user-123",
            Email = "candidate@example.com",
            FirstName = "Ada",
            LastName = "Lovelace"
        };

        [Fact]
        public void GenerateToken_ReturnsNonEmptyToken()
        {
            var sut = CreateSut();
            var (token, _) = sut.GenerateToken(CreateUser(), new List<string> { Roles.Candidate });

            Assert.False(string.IsNullOrWhiteSpace(token));
        }

        [Fact]
        public void GenerateToken_ExpiresAtRespectsConfiguredExpiryMinutes()
        {
            var sut = CreateSut();
            var before = DateTime.UtcNow;
            var (_, expiresAt) = sut.GenerateToken(CreateUser(), new List<string> { Roles.Candidate });
            var after = DateTime.UtcNow;

            Assert.InRange(expiresAt, before.AddMinutes(60), after.AddMinutes(60).AddSeconds(5));
        }

        [Fact]
        public void GenerateToken_EmbedsUserIdEmailAndRoleClaims()
        {
            var sut = CreateSut();
            var user = CreateUser();
            var (token, _) = sut.GenerateToken(user, new List<string> { Roles.Recruiter, Roles.Admin });

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

            Assert.Equal(user.Id, jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Sub).Value);
            Assert.Equal(user.Email, jwt.Claims.Single(c => c.Type == JwtRegisteredClaimNames.Email).Value);

            var roleClaims = jwt.Claims.Where(c => c.Type == ClaimTypes.Role).Select(c => c.Value).ToList();
            Assert.Contains(Roles.Recruiter, roleClaims);
            Assert.Contains(Roles.Admin, roleClaims);
        }

        [Fact]
        public void GenerateToken_SetsConfiguredIssuerAndAudience()
        {
            var sut = CreateSut();
            var (token, _) = sut.GenerateToken(CreateUser(), new List<string> { Roles.Candidate });

            var jwt = new JwtSecurityTokenHandler().ReadJwtToken(token);

            Assert.Equal("TestIssuer", jwt.Issuer);
            Assert.Equal("TestAudience", jwt.Audiences.Single());
        }
    }
}
