# Program.cs

## 1. Add config bindings (near the existing JwtSettings binding)

FIND:
```csharp
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
```

REPLACE WITH:
```csharp
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));
builder.Services.Configure<AiSettings>(builder.Configuration.GetSection("AiSettings"));
builder.Services.Configure<SmsSettings>(builder.Configuration.GetSection("SmsSettings"));
```

## 2. Replace the service registrations

FIND:
```csharp
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IMatchingService, SkillMatchingService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();
builder.Services.AddSingleton<IResumeParsingService, KeywordResumeParsingService>();
```

REPLACE WITH:
```csharp
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IFileStorageService, LocalFileStorageService>();

// Shared AI client (real external AI provider — Anthropic by default)
builder.Services.AddHttpClient<IAiClient, AnthropicAiClient>();

// Real AI-backed resume parsing / candidate matching / feedback generation.
// Each service internally falls back to the old local logic if the AI
// provider is unconfigured or unreachable, so the app still runs end to
// end with AiSettings:Enabled = false or no API key set.
builder.Services.AddScoped<IResumeParsingService, AiResumeParsingService>();
builder.Services.AddScoped<IMatchingService, AiMatchingService>();
builder.Services.AddScoped<IFeedbackGenerationService, AiFeedbackGenerationService>();

// Real SMS integration (Twilio REST API over HttpClient)
builder.Services.AddHttpClient<ISmsSender, TwilioSmsSender>();
```

## 3. (Optional) enable Swagger to show the new AiSettings/SmsSettings sections in generated docs
No change needed — Swagger already picks up new DTOs/controllers automatically.
