using System.Text;
using DocumentFormat.OpenXml;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using RecruitmentPlatform.API.Services;
using Xunit;

namespace RecruitmentPlatform.Tests.UnitTests
{
    public class ResumeTextExtractionServiceTests
    {
        private readonly ResumeTextExtractionService _sut = new(NullLogger<ResumeTextExtractionService>.Instance);

        private static IFormFile MakeFormFile(byte[] content, string fileName)
        {
            var stream = new MemoryStream(content);
            return new FormFile(stream, 0, stream.Length, "file", fileName);
        }

        private static byte[] BuildDocxBytes(string paragraphText)
        {
            using var ms = new MemoryStream();
            using (var doc = WordprocessingDocument.Create(ms, WordprocessingDocumentType.Document))
            {
                var mainPart = doc.AddMainDocumentPart();
                mainPart.Document = new Document();
                var body = mainPart.Document.AppendChild(new Body());
                body.AppendChild(new Paragraph(new Run(new Text(paragraphText))));
                mainPart.Document.Save();
            }
            return ms.ToArray();
        }

        [Fact]
        public async Task ExtractTextAsync_TxtFile_ReturnsRawContent()
        {
            var bytes = Encoding.UTF8.GetBytes("Skilled in C#, React and SQL Server.");
            var file = MakeFormFile(bytes, "resume.txt");

            var text = await _sut.ExtractTextAsync(file);

            Assert.Equal("Skilled in C#, React and SQL Server.", text);
        }

        [Fact]
        public async Task ExtractTextAsync_DocxFile_ReturnsParagraphText()
        {
            var bytes = BuildDocxBytes("Experienced backend engineer skilled in ASP.NET and Azure.");
            var file = MakeFormFile(bytes, "resume.docx");

            var text = await _sut.ExtractTextAsync(file);

            Assert.NotNull(text);
            Assert.Contains("Experienced backend engineer", text);
            Assert.Contains("ASP.NET", text);
        }

        [Theory]
        [InlineData("resume.doc")]
        [InlineData("resume.png")]
        [InlineData("resume.zip")]
        public async Task ExtractTextAsync_UnsupportedExtension_ReturnsNull(string fileName)
        {
            var file = MakeFormFile(Encoding.UTF8.GetBytes("irrelevant"), fileName);

            var text = await _sut.ExtractTextAsync(file);

            Assert.Null(text);
        }

        [Fact]
        public async Task ExtractTextAsync_CorruptPdfBytes_ReturnsNullInsteadOfThrowing()
        {
            var file = MakeFormFile(Encoding.UTF8.GetBytes("not a real pdf"), "resume.pdf");

            var text = await _sut.ExtractTextAsync(file);

            Assert.Null(text);
        }
    }
}
