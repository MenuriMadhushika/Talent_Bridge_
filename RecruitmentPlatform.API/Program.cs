using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using RecruitmentPlatform.API.Data;
using RecruitmentPlatform.API.Models.Entities;
using RecruitmentPlatform.API.Repositories;
using RecruitmentPlatform.API.Services;

var builder = WebApplication.CreateBuilder(args);

// ---------- Configuration ----------
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
builder.Services.Configure<AiSettings>(builder.Configuration.GetSection("AiSettings"));
builder.Services.Configure<SmsSettings>(builder.Configuration.GetSection("SmsSettings"));
builder.Services.Configure<EmailSettings>(builder.Configuration.GetSection("EmailSettings"));

// ---------- Database ----------
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// test
// ---------- Identity ----------
builder.Services.AddIdentity<ApplicationUser, IdentityRole>(options =>
{
    options.Password.RequiredLength = 8;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = true;
    options.Password.RequireDigit = true;
    options.User.RequireUniqueEmail = true;
})
.AddEntityFrameworkStores<ApplicationDbContext>()
.AddDefaultTokenProviders();

// ---------- JWT Authentication ----------
var jwtSettings = builder.Configuration.GetSection("JwtSettings").Get<JwtSettings>()
    ?? throw new InvalidOperationException("JwtSettings not configured");

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtSettings.Issuer,
        ValidAudience = jwtSettings.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.Secret)),
        ClockSkew = TimeSpan.FromMinutes(2)
    };
});

builder.Services.AddAuthorization();

//service
//repository
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();
builder.Services.AddScoped<IResumeTextExtractionService, ResumeTextExtractionService>();

builder.Services.AddHttpClient<IAiClient, OpenAiClient>();

builder.Services.AddScoped<IResumeParsingService, AiResumeParsingService>();
builder.Services.AddScoped<IMatchingService, AiMatchingService>();
builder.Services.AddScoped<IFeedbackGenerationService, AiFeedbackGenerationService>();

builder.Services.AddHttpClient<ISmsSender, TwilioSmsSender>();
builder.Services.AddScoped<IEmailSender, SmtpEmailSender>();

// ---------- CORS (Critical for Frontend) ----------
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
        policy.WithOrigins(
            "http://localhost:5173",      // Vite default
            "http://127.0.0.1:5173",
            "https://localhost:5173"
        )
        .AllowAnyHeader()
        .AllowAnyMethod()
        .AllowCredentials());
});

// ---------- MVC + Swagger ----------
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Talent Bridge API",
        Version = "v1"
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer {token}'"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// ---------- Database Migration + Role Seeding ----------
// Skipped in the "Testing" environment: the integration test host swaps in
// an InMemory database (see RecruitmentPlatform.Tests/CustomWebApplicationFactory),
// which doesn't support relational migrations.
if (!app.Environment.IsEnvironment("Testing"))
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();

    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
    foreach (var role in new[] { Roles.Candidate, Roles.Recruiter, Roles.HiringManager, Roles.Admin })
    {
        if (!await roleManager.RoleExistsAsync(role))
            await roleManager.CreateAsync(new IdentityRole(role));
    }

    // ---------- Default organization + admin seeding ----------
    // Admin accounts can't be self-registered (see AuthService), so a default
    // organization/department structure and a first Admin login are seeded
    // here to make the Admin portal reachable immediately after first run.
    var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    var defaultOrg = (await unitOfWork.Organizations.FindAsync(o => o.Name == "Talent Bridge Corp")).FirstOrDefault();
    if (defaultOrg is null)
    {
        defaultOrg = new Organization { Name = "Talent Bridge Corp", Industry = "Human Resources Consulting" };
        await unitOfWork.Organizations.AddAsync(defaultOrg);
        await unitOfWork.SaveChangesAsync();
    }

    var hasDepartments = (await unitOfWork.Departments.FindAsync(d => d.OrganizationId == defaultOrg.Id)).Any();
    if (!hasDepartments)
    {
        foreach (var name in new[] { "Human Resources", "Engineering", "Sales & Marketing" })
            await unitOfWork.Departments.AddAsync(new Department { Name = name, OrganizationId = defaultOrg.Id });

        await unitOfWork.SaveChangesAsync();
    }

    const string adminEmail = "admin@talentbridge.com";
    var adminUser = await userManager.FindByEmailAsync(adminEmail);
    if (adminUser is null)
    {
        adminUser = new ApplicationUser
        {
            UserName = adminEmail,
            Email = adminEmail,
            EmailConfirmed = true,
            FirstName = "Platform",
            LastName = "Administrator",
            OrganizationId = defaultOrg.Id
        };

        var createResult = await userManager.CreateAsync(adminUser, "Admin@12345");
        if (createResult.Succeeded)
            await userManager.AddToRoleAsync(adminUser, Roles.Admin);
    }
}

// ---------- Static file storage (uploaded resumes/documents) ----------
var webRootPath = string.IsNullOrEmpty(app.Environment.WebRootPath)
    ? Path.Combine(app.Environment.ContentRootPath, "wwwroot")
    : app.Environment.WebRootPath;
Directory.CreateDirectory(Path.Combine(webRootPath, "uploads"));
if (app.Environment.WebRootPath != webRootPath)
{
    app.Environment.WebRootPath = webRootPath;
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseStaticFiles();

// IMPORTANT: CORS must be before Authentication/Authorization
app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Exposed so RecruitmentPlatform.Tests can boot this app via WebApplicationFactory<Program>.
public partial class Program { }
