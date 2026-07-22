using System.ComponentModel.DataAnnotations;

namespace RecruitmentPlatform.API.Models.DTOs
{
    public class CreateOrganizationDto
    {
        [Required] public string Name { get; set; } = string.Empty;
        public string Industry { get; set; } = string.Empty;
    }

    public class OrganizationDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Industry { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public int DepartmentCount { get; set; }
        public int UserCount { get; set; }
    }

    public class CreateDepartmentDto
    {
        [Required] public string Name { get; set; } = string.Empty;
    }

    public class DepartmentDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public int OrganizationId { get; set; }
        public string OrganizationName { get; set; } = string.Empty;
        public int JobPostingCount { get; set; }
    }
}
