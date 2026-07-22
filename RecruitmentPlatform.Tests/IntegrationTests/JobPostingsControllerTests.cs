using System.Net;
using System.Net.Http.Json;
using RecruitmentPlatform.API.Models.DTOs;
using Xunit;

namespace RecruitmentPlatform.Tests.IntegrationTests
{
    public class JobPostingsControllerTests : IClassFixture<CustomWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public JobPostingsControllerTests(CustomWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task GetOpenPostings_IsPubliclyAccessibleWithoutAToken()
        {
            var response = await _client.GetAsync("/api/jobpostings");

            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        [Fact]
        public async Task GetOpenPostings_OnFreshDatabase_ReturnsEmptyList()
        {
            var postings = await _client.GetFromJsonAsync<List<JobPostingDto>>("/api/jobpostings");

            Assert.NotNull(postings);
            Assert.Empty(postings!);
        }

        [Fact]
        public async Task GetById_UnknownId_Returns404()
        {
            var response = await _client.GetAsync("/api/jobpostings/999999");

            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        }

        [Fact]
        public async Task Create_WithoutAuthentication_Returns401()
        {
            var response = await _client.PostAsJsonAsync("/api/jobpostings", new CreateJobPostingDto
            {
                Title = "Senior Engineer",
                Description = "Build things.",
                DepartmentId = 1
            });

            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }
    }
}
