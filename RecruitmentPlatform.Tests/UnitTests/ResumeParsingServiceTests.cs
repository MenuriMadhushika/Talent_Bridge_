using RecruitmentPlatform.API.Services;
using Xunit;

namespace RecruitmentPlatform.Tests.UnitTests
{
    public class ResumeParsingServiceTests
    {
        private readonly KeywordResumeParsingService _sut = new();

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void Parse_EmptyInput_ReturnsNullSkillsAndSummary(string? input)
        {
            var (skills, summary) = _sut.Parse(input);

            Assert.Null(skills);
            Assert.Null(summary);
        }

        [Fact]
        public void Parse_FindsKnownSkillsCaseInsensitively()
        {
            var (skills, _) = _sut.Parse("Experienced with react, TypeScript and asp.net web apis.");

            Assert.NotNull(skills);
            Assert.Contains("React", skills);
            Assert.Contains("TypeScript", skills);
            Assert.Contains("ASP.NET", skills);
        }

        [Fact]
        public void Parse_NoKnownSkillsPresent_ReturnsNullSkills()
        {
            var (skills, summary) = _sut.Parse("I enjoy long walks on the beach.");

            Assert.Null(skills);
            Assert.NotNull(summary);
        }

        [Fact]
        public void Parse_ShortText_SummaryEqualsTrimmedInput()
        {
            var (_, summary) = _sut.Parse("  Short resume text.  ");

            Assert.Equal("Short resume text.", summary);
        }

        [Fact]
        public void Parse_LongText_SummaryIsTruncatedTo280CharsWithEllipsis()
        {
            var longText = new string('a', 400);

            var (_, summary) = _sut.Parse(longText);

            Assert.NotNull(summary);
            Assert.Equal(281, summary!.Length); // 280 chars + ellipsis character
            Assert.EndsWith("…", summary);
        }
    }
}
