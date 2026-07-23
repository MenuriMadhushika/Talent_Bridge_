/*
 * OrganizationDtos.cs
 * -------------------
 * Data Transfer Objects (DTOs) for managing organizations and departments.
 * 
 * - CreateOrganizationDto & OrganizationDto: Models for creating new client organizations and viewing their details and summary counts.
 * - CreateDepartmentDto & DepartmentDto: Models for creating and viewing organizational sub-departments and associated job posting metrics.
 */

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
