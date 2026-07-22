using System.Net;
using System.Net.Http.Json;
using RecruitmentPlatform.API.Models.DTOs;
using Xunit;

namespace RecruitmentPlatform.Tests.IntegrationTests
{
    public class AuthControllerTests : IClassFixture<CustomWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public AuthControllerTests(CustomWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        private static RegisterDto NewCandidateDto(string email) => new()
        {
            FirstName = "Ada",
            LastName = "Lovelace",
            Email = email,
            Password = "Password1",
            Role = "Candidate"
        };

        [Fact]
        public async Task Register_NewCandidate_Returns200WithToken()
        {
            var dto = NewCandidateDto($"ada.{Guid.NewGuid():N}@example.com");

            var response = await _client.PostAsJsonAsync("/api/auth/register", dto);

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var result = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
            Assert.NotNull(result);
            Assert.False(string.IsNullOrWhiteSpace(result!.Token));
            Assert.Equal("Candidate", result.Role);
        }

        [Fact]
        public async Task Register_DuplicateEmail_Returns400()
        {
            var dto = NewCandidateDto($"dup.{Guid.NewGuid():N}@example.com");
            await _client.PostAsJsonAsync("/api/auth/register", dto);

            var response = await _client.PostAsJsonAsync("/api/auth/register", dto);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Register_AdminRole_IsRejected()
        {
            var dto = NewCandidateDto($"wannabeadmin.{Guid.NewGuid():N}@example.com");
            dto.Role = "Admin";

            var response = await _client.PostAsJsonAsync("/api/auth/register", dto);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Register_RecruiterWithoutOrganizationId_Returns400()
        {
            var dto = NewCandidateDto($"recruiter.{Guid.NewGuid():N}@example.com");
            dto.Role = "Recruiter";
            dto.OrganizationId = null;

            var response = await _client.PostAsJsonAsync("/api/auth/register", dto);

            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task Login_CorrectCredentials_Returns200WithToken()
        {
            var email = $"login.{Guid.NewGuid():N}@example.com";
            await _client.PostAsJsonAsync("/api/auth/register", NewCandidateDto(email));

            var response = await _client.PostAsJsonAsync("/api/auth/login",
                new LoginDto { Email = email, Password = "Password1" });

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var result = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
            Assert.NotNull(result);
            Assert.Equal(email, result!.Email);
        }

        [Fact]
        public async Task Login_WrongPassword_Returns401()
        {
            var email = $"wrongpw.{Guid.NewGuid():N}@example.com";
            await _client.PostAsJsonAsync("/api/auth/register", NewCandidateDto(email));

            var response = await _client.PostAsJsonAsync("/api/auth/login",
                new LoginDto { Email = email, Password = "NotThePassword1" });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Login_UnknownEmail_Returns401()
        {
            var response = await _client.PostAsJsonAsync("/api/auth/login",
                new LoginDto { Email = "nobody-here@example.com", Password = "Password1" });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}
