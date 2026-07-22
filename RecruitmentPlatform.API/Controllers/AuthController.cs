using Microsoft.AspNetCore.Mvc;
using RecruitmentPlatform.API.Models.DTOs;
using RecruitmentPlatform.API.Services;

namespace RecruitmentPlatform.API.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly IAuthService _authService;

        public AuthController(IAuthService authService)
        {
            _authService = authService;
        }

        /// <summary>Register a new Candidate, Recruiter, or Hiring Manager account.</summary>
        [HttpPost("register")]
        [ProducesResponseType(typeof(AuthResponseDto), 200)]
        [ProducesResponseType(400)]
        public async Task<IActionResult> Register([FromBody] RegisterDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var (succeeded, error, result) = await _authService.RegisterAsync(dto);
            if (!succeeded) return BadRequest(new { error });

            return Ok(result);
        }

        /// <summary>Authenticate and receive a JWT bearer token.</summary>
        [HttpPost("login")]
        [ProducesResponseType(typeof(AuthResponseDto), 200)]
        [ProducesResponseType(401)]
        public async Task<IActionResult> Login([FromBody] LoginDto dto)
        {
            if (!ModelState.IsValid) return BadRequest(ModelState);

            var (succeeded, error, result) = await _authService.LoginAsync(dto);
            if (!succeeded) return Unauthorized(new { error });

            return Ok(result);
        }
    }
}
