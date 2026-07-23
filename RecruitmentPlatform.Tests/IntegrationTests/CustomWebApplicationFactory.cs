using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RecruitmentPlatform.API.Data;
using RecruitmentPlatform.API.Models.Entities;

namespace RecruitmentPlatform.Tests.IntegrationTests
{
    /// <summary>
    /// Boots the real ASP.NET Core pipeline (controllers,
    //auth, DI wiring) exactly as
    /// Program.cs configures it, but replaces the SQL Server DbContext registration
    /// with an isolated EF Core InMemory database per factory instance, and seeds
    /// the four Identity roles the app expects to already exist.
    /// </summary>
    public class CustomWebApplicationFactory : WebApplicationFactory<Program>
    {
        public string DatabaseName { get; } = $"TestDb_{Guid.NewGuid()}";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");

            builder.ConfigureServices(services =>
            {
                var descriptor = services.SingleOrDefault(
                    d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
                if (descriptor is not null) services.Remove(descriptor);

                services.AddDbContext<ApplicationDbContext>(options =>
                    options.UseInMemoryDatabase(DatabaseName));

                var provider = services.BuildServiceProvider();
                using var scope = provider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                db.Database.EnsureCreated();

                var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
                foreach (var role in new[] { Roles.Candidate, Roles.Recruiter, Roles.HiringManager, Roles.Admin })
                {
                    if (!roleManager.RoleExistsAsync(role).GetAwaiter().GetResult())
                        roleManager.CreateAsync(new IdentityRole(role)).GetAwaiter().GetResult();
                }
            });
        }
    }
}
