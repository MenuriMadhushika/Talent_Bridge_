using RecruitmentPlatform.API.Services;
using Xunit;

namespace RecruitmentPlatform.Tests.UnitTests
{
    public class SkillMatchingServiceTests
    {
        private readonly SkillMatchingService _sut = new();

        [Fact]
        public void ComputeMatchScore_FullOverlap_Returns100()
        {
            var score = _sut.ComputeMatchScore("C#, SQL, Azure", "C#, SQL, Azure");
            Assert.Equal(100, score);
        }

        [Fact]
        public void ComputeMatchScore_NoOverlap_ReturnsZero()
        {
            var score = _sut.ComputeMatchScore("Photoshop, Illustrator", "C#, SQL");
            Assert.Equal(0, score);
        }

        [Fact]
        public void ComputeMatchScore_PartialOverlap_ReturnsProportionalScore()
        {
            // 2 of 4 required skills present -> 50%
            var score = _sut.ComputeMatchScore("C#, SQL", "C#, SQL, Azure, Docker");
            Assert.Equal(50, score);
        }

        [Fact]
        public void ComputeMatchScore_IsCaseInsensitiveAndTrimsWhitespace()
        {
            var score = _sut.ComputeMatchScore(" c# , sql ", "C#, SQL");
            Assert.Equal(100, score);
        }

        [Fact]
        public void ComputeMatchScore_ExtraCandidateSkillsAreIgnored()
        {
            // Candidate has more skills than required; score is based on required-skill coverage only.
            var score = _sut.ComputeMatchScore("C#, SQL, Photography, Cooking", "C#, SQL");
            Assert.Equal(100, score);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void ComputeMatchScore_NoRequiredSkills_ReturnsZero(string? requiredSkills)
        {
            var score = _sut.ComputeMatchScore("C#, SQL", requiredSkills);
            Assert.Equal(0, score);
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        public void ComputeMatchScore_NoCandidateSkills_ReturnsZero(string? candidateSkills)
        {
            var score = _sut.ComputeMatchScore(candidateSkills, "C#, SQL");
            Assert.Equal(0, score);
        }
    }
}
