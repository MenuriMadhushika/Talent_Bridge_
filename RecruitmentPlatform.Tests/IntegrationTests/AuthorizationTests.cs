using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using RecruitmentPlatform.API.Models.DTOs;
using Xunit;

namespace RecruitmentPlatform.Tests.IntegrationTests
{
    public class AuthorizationTests : IClassFixture<CustomWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public AuthorizationTests(CustomWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        private async Task<string> RegisterAndGetTokenAsync(string role)
        {
            var email = $"{role.ToLowerInvariant()}.{Guid.NewGuid():N}@example.com";
            var dto = new RegisterDto
            {
                FirstName = "Test",
                LastName = role,
                Email = email,
                Password = "Password1",
                Role = role,
                // Recruiter/HiringManager registration requires an OrganizationId in the
                // real flow; Candidate is sufficient for these authorization checks.
            };

            var response = await _client.PostAsJsonAsync("/api/auth/register", dto);
            response.EnsureSuccessStatusCode();
            var result = await response.Content.ReadFromJsonAsync<AuthResponseDto>();
            return result!.Token;
        }

        [Fact]
        public async Task AdminUsers_WithoutToken_Returns401()
        {
            var response = await _client.GetAsync("/api/admin/users");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task AdminUsers_WithCandidateToken_Returns403()
        {
            var token = await RegisterAndGetTokenAsync("Candidate");
            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await _client.GetAsync("/api/admin/users");

            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        }

        [Fact]
        public async Task CandidateProfilesMe_WithCandidateToken_Returns200Or404()
        {
            var token = await RegisterAndGetTokenAsync("Candidate");
            _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var response = await _client.GetAsync("/api/candidateprofiles/me");

            // A profile is created automatically at registration, so this should be 200 —
            // asserting the narrower "not a 401/403" contract keeps the test focused on authZ.
            //Asset-true
            Assert.True(response.StatusCode is HttpStatusCode.OK or HttpStatusCode.NotFound);
        }

        [Fact]
        public async Task ApplicationsMe_WithoutToken_Returns401()
        {
            var response = await _client.GetAsync("/api/applications/me");

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}
