using Microsoft.AspNetCore.Http;

namespace RecruitmentPlatform.API.Services
{
    public interface IFileStorageService
    {
        /// <summary>Save an uploaded file to disk under wwwroot/uploads/{subfolder}
        /// and return a URL path the frontend can use to download/preview it.</summary>
        Task<(string storageUrl, string fileName)> SaveAsync(IFormFile file, string subfolder);
    }

    // Stores files on local disk under wwwroot/uploads, serving them via
    // ASP.NET Core static files. This is the practical substitute for the
    // "Cloud Storage Integration" requirement (secure storage for resumes /
    // certifications / supporting documents): without an AWS/Azure account
    // configured there's no real bucket to write to, so this keeps the same
    // contract (IFileStorageService.SaveAsync -> a URL) that a real
    // S3/Azure Blob implementation would fulfil, making the swap later a
    // one-file change rather than a rewrite of every call site.
    public class LocalFileStorageService : IFileStorageService
    {
        private readonly string _webRootPath;

        public LocalFileStorageService(IWebHostEnvironment env)
        {
            _webRootPath = env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot");
        }

        public async Task<(string storageUrl, string fileName)> SaveAsync(IFormFile file, string subfolder)
        {
            var uploadsDir = Path.Combine(_webRootPath, "uploads", subfolder);
            Directory.CreateDirectory(uploadsDir);

            var safeName = Path.GetFileNameWithoutExtension(file.FileName);
            safeName = string.Concat(safeName.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_')).Trim();
            if (string.IsNullOrWhiteSpace(safeName)) safeName = "file";

            var extension = Path.GetExtension(file.FileName);
            var storedFileName = $"{safeName}-{Guid.NewGuid():N}{extension}";
            var fullPath = Path.Combine(uploadsDir, storedFileName);

            using (var stream = new FileStream(fullPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var storageUrl = $"/uploads/{subfolder}/{storedFileName}";
            return (storageUrl, file.FileName);
        }
    }
}