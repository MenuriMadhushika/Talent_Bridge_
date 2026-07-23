using System.Text;
using DocumentFormat.OpenXml.Packaging;
using DocumentFormat.OpenXml.Wordprocessing;
using Microsoft.AspNetCore.Http;
using UglyToad.PdfPig;

namespace RecruitmentPlatform.API.Services
{
    /// <summary>Extracts plain text from an uploaded resume file so it can be
    /// fed to the AI resume-parsing service. Previously only .
    ///txt uploads
    /// were parsed; PDF and DOCX resumes (the overwhelming majority in
    /// practice) were stored but never actually read. Unsupported/unreadable
    /// files return null so callers can store the file without a parse
    /// rather than fail the whole upload.</summary>
    public interface IResumeTextExtractionService
    {
        Task<string?> ExtractTextAsync(IFormFile file, CancellationToken ct = default);
    }

    public class ResumeTextExtractionService : IResumeTextExtractionService
    {
        private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
        {
            ".txt", ".pdf", ".docx"
        };

        private readonly ILogger<ResumeTextExtractionService> _logger;

        public ResumeTextExtractionService(ILogger<ResumeTextExtractionService> logger)
        {
            _logger = logger;
        }

        public async Task<string?> ExtractTextAsync(IFormFile file, CancellationToken ct = default)
        {
            var extension = Path.GetExtension(file.FileName);
            if (!SupportedExtensions.Contains(extension))
            {
                _logger.LogInformation(
                    "Resume {FileName} has unsupported extension {Extension} — storing without text extraction.",
                    file.FileName, extension);
                return null;
            }

            try
            {
                return extension.ToLowerInvariant() switch
                {
                    ".txt" => await ExtractTxtAsync(file, ct),
                    ".pdf" => ExtractPdf(file),
                    ".docx" => ExtractDocx(file),
                    _ => null
                };
            }
            catch (Exception ex)
            {
                // A malformed/corrupt/password-protected file must not fail
                // the upload — just skip parsing for this one.
                _logger.LogWarning(ex, "Failed to extract text from resume {FileName}", file.FileName);
                return null;
            }
        }

        private static async Task<string> ExtractTxtAsync(IFormFile file, CancellationToken ct)
        {
            using var stream = file.OpenReadStream();
            using var reader = new StreamReader(stream);
            return await reader.ReadToEndAsync(ct);
        }

        private static string ExtractPdf(IFormFile file)
        {
            using var stream = file.OpenReadStream();
            using var document = PdfDocument.Open(stream);

            var sb = new StringBuilder();
            foreach (var page in document.GetPages())
            {
                sb.AppendLine(page.Text);
            }
            return sb.ToString();
        }

        private static string ExtractDocx(IFormFile file)
        {
            using var stream = file.OpenReadStream();
            using var wordDoc = WordprocessingDocument.Open(stream, false);

            var body = wordDoc.MainDocumentPart?.Document?.Body;
            if (body is null) return string.Empty;

            var sb = new StringBuilder();
            foreach (var paragraph in body.Elements<Paragraph>())
            {
                sb.AppendLine(paragraph.InnerText);
            }
            return sb.ToString();
        }
    }
}
