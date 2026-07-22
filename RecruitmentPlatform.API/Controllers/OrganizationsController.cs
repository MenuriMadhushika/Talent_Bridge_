using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RecruitmentPlatform.API.Models.DTOs;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;

namespace RecruitmentPlatform.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class OrganizationsController : ControllerBase
    {
        private readonly IUnitOfWork _unitOfWork;

        public OrganizationsController(IUnitOfWork unitOfWork)
        {
            _unitOfWork = unitOfWork;
        }

        /// <summary>Public: list organizations. Used by the registration screen
        /// (recruiters/hiring managers pick their employer) and by admins.</summary>
        [HttpGet]
        [AllowAnonymous]
        public async Task<IActionResult> GetAll()
        {
            var orgs = await _unitOfWork.Organizations.Query()
                .Include(o => o.Departments)
                .Include(o => o.Users)
                .OrderBy(o => o.Name)
                .ToListAsync();

            return Ok(orgs.Select(ToDto));
        }

        /// <summary>Public: list departments for an organization. Used when
        /// creating a job posting or registering as a recruiter/hiring manager.</summary>
        [HttpGet("{id:int}/departments")]
        [AllowAnonymous]
        public async Task<IActionResult> GetDepartments(int id)
        {
            var departments = await _unitOfWork.Departments.Query()
                .Include(d => d.Organization)
                .Include(d => d.JobPostings)
                .Where(d => d.OrganizationId == id)
                .OrderBy(d => d.Name)
                .ToListAsync();

            return Ok(departments.Select(d => ToDepartmentDto(d)));
        }

        /// <summary>Admin: create a new client organization.</summary>
        [HttpPost]
        [Authorize(Roles = Roles.Admin)]
        public async Task<IActionResult> Create([FromBody] CreateOrganizationDto dto)
        {
            var org = new Organization { Name = dto.Name, Industry = dto.Industry };
            await _unitOfWork.Organizations.AddAsync(org);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetAll), ToDto(org));
        }

        /// <summary>Admin: add a department under an organization.</summary>
        [HttpPost("{id:int}/departments")]
        [Authorize(Roles = Roles.Admin)]
        public async Task<IActionResult> CreateDepartment(int id, [FromBody] CreateDepartmentDto dto)
        {
            var org = await _unitOfWork.Organizations.GetByIdAsync(id);
            if (org is null) return NotFound("Organization not found.");

            var department = new Department { Name = dto.Name, OrganizationId = id };
            await _unitOfWork.Departments.AddAsync(department);
            await _unitOfWork.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDepartments), new { id }, ToDepartmentDto(department, org.Name));
        }

        private static OrganizationDto ToDto(Organization o) => new()
        {
            Id = o.Id,
            Name = o.Name,
            Industry = o.Industry,
            CreatedAt = o.CreatedAt,
            DepartmentCount = o.Departments?.Count ?? 0,
            UserCount = o.Users?.Count ?? 0
        };

        private static DepartmentDto ToDepartmentDto(Department d, string? organizationName = null) => new()
        {
            Id = d.Id,
            Name = d.Name,
            OrganizationId = d.OrganizationId,
            OrganizationName = organizationName ?? d.Organization?.Name ?? string.Empty,
            JobPostingCount = d.JobPostings?.Count ?? 0
        };
    }
}
