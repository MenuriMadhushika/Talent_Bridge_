# Talent Bridge — AI-Powered Recruitment & Talent Management Platform

A recruitment lifecycle platform: candidate/recruiter/hiring-manager/admin portals
backed by an ASP.NET Core Web API, built against the brief in `Scenario.docx`.

## Project layout

```
RecruitmentPlatform.API/          ASP.NET Core 8 Web API (Controllers, Services, Repositories, EF Core)
RecruitmentPlatform.API/recruitment-frontend/   React 18 + Vite SPA
RecruitmentPlatform.Tests/        xUnit unit + integration tests
RecruitmentPlatform.API/RecruitmentPlatform.postman_collection.json   Postman collection
```

## Running it

**Backend**
```
cd RecruitmentPlatform.API
dotnet ef database update   # applies migrations to your local SQL Server (see appsettings.json)
dotnet run
```
Swagger UI is available at `/swagger` when running in Development.

**Configuring the OpenAI integration**
Resume parsing, candidate-job matching, and feedback generation call OpenAI's Chat
Completions API (`Services/AiClient.cs`). Never put a real API key in `appsettings.json` —
it's in source control. Set it one of these ways instead:

```
# Option 1: .NET user secrets (this project already has a UserSecretsId)
dotnet user-secrets set "AiSettings:ApiKey" "sk-..."

# Option 2: environment variable (double underscore maps to the nested key)
export AiSettings__ApiKey="sk-..."
```
If no key is configured (or the OpenAI call fails/times out), every AI service
automatically falls back to its local, dependency-free equivalent (keyword skill
matching, skill-overlap scoring, a templated feedback message) — the platform keeps
working, just without AI-generated results, and nothing throws or breaks the request.

**Configuring email and SMS notifications**
Every call to `INotificationService.NotifyAsync` (application status changes, interview
scheduling, etc.) writes an in-app `Notification` row, then best-effort fans out to
email (`Services/EmailNotificationService.cs`, plain SMTP via `System.Net.Mail` — works
with any SMTP provider: SES, SendGrid's SMTP relay, Office365, Gmail app passwords) and
SMS (`Services/SmsNotificationService.cs`, Twilio's REST API). Both are disabled by
default and silently no-op (logging what *would* have been sent) until configured:

```
dotnet user-secrets set "EmailSettings:Enabled" "true"
dotnet user-secrets set "EmailSettings:SmtpHost" "smtp.your-provider.com"
dotnet user-secrets set "EmailSettings:SmtpUsername" "..."
dotnet user-secrets set "EmailSettings:SmtpPassword" "..."
dotnet user-secrets set "EmailSettings:FromAddress" "no-reply@yourdomain.com"

dotnet user-secrets set "SmsSettings:Enabled" "true"
dotnet user-secrets set "SmsSettings:AccountSid" "AC..."
dotnet user-secrets set "SmsSettings:AuthToken" "..."
dotnet user-secrets set "SmsSettings:FromNumber" "+1..."
```
Neither channel ever blocks or fails the triggering request — a failed send is logged
and swallowed, same pattern as the AI fallback above.

**Frontend**
```
cd RecruitmentPlatform.API/recruitment-frontend
cp .env.example .env         # if not already present — points VITE_API_BASE_URL at the API
npm install
npm run dev
```

**Tests**
```
dotnet test RecruitmentPlatform.Tests
```
Integration tests boot the real ASP.NET pipeline via `WebApplicationFactory<Program>` against
an isolated EF Core InMemory database per test class (see `IntegrationTests/CustomWebApplicationFactory.cs`),
so they don't touch your local SQL Server instance and don't need it running.

**API testing (Postman)**
Import `RecruitmentPlatform.API/RecruitmentPlatform.postman_collection.json`, set the
`baseUrl` collection variable to your running API's HTTPS URL, and run the "Auth" folder
first (it captures tokens into collection variables that the rest of the requests reuse).

## What's fully implemented

- Candidate / Recruiter / Hiring Manager / Admin portals, end to end
- JWT authentication + role-based access control (RBAC)
- Candidate profile, resume upload/management, job search & application
- Job posting CRUD, candidate search, application review/shortlisting, messaging
- Interview scheduling, evaluation & scoring, hiring decisions
- **AI-backed resume parsing, candidate-job matching, and feedback generation**,
  calling OpenAI's Chat Completions API (see `Services/AiClient.cs`), with an
  automatic local fallback (keyword matching / skill-overlap scoring / a templated
  message) if no API key is configured or the call fails — see "Configuring the
  OpenAI integration" above
- Resume text extraction from `.txt`, `.pdf`, and `.docx` uploads
  (`Services/ResumeTextExtractionService.cs`) feeding the AI parser
- **Email and SMS notification fan-out** (`Services/EmailNotificationService.cs`,
  `Services/SmsNotificationService.cs`) triggered from every in-app `Notification`,
  with an automatic no-op fallback (logged only) if unconfigured — see "Configuring
  email and SMS notifications" above
- Recruitment analytics dashboard, including monthly hiring-trend analysis
- Audit logging of sensitive admin/account actions
- Self-service data export and account deletion (data-privacy basics — see below)
- Automated tests (xUnit unit + integration) and a Postman collection

## Known limitations / stubbed integrations

| Area | Current state | To make it real |
|---|---|---|
| **AI resume parsing / matching / feedback** | Real OpenAI calls, but require `AiSettings:ApiKey` to be configured locally (see above) — otherwise it silently uses the local fallback | Set the API key via user secrets or an env var |
| **Resume formats** | `.txt`, `.pdf`, `.docx` are parsed; `.doc` (legacy Word), images, and scanned/OCR-only PDFs are stored but not parsed | Add a legacy-`.doc` converter and/or an OCR step for scanned PDFs |
| **Email / SMS notifications** | Real SMTP/Twilio calls, but require `EmailSettings`/`SmsSettings` to be configured locally (see above) — otherwise they silently no-op (logged, not sent) | Set the credentials via user secrets or an env var |
| **Calendar integration** | Generates "Add to Google Calendar"/"Add to Outlook" links the user clicks manually | Real OAuth against Microsoft Graph / Google Calendar APIs to read availability and create events automatically |
| **Cloud storage** | Resumes saved to local disk (`wwwroot/uploads`) via `LocalFileStorageService` | Swap in an `IFileStorageService` implementation backed by Azure Blob/S3 |
| **Usability testing** | Not performed in this environment (needs real users) | Run a moderated usability pass and fold findings back into the UI |

## Data privacy notes

- `GET /api/candidateprofiles/me/export` — a candidate can download everything the
  platform holds about them as JSON.
- `DELETE /api/candidateprofiles/me` — a candidate can scrub their personal data
  (name, contact info, resumes) and deactivate their account. Application history is
  kept in anonymized form (status/dates only) since recruiters may have a legitimate
  record-keeping need for it.
- Because auth is stateless JWT, a token issued before deletion remains technically
  valid until it naturally expires (there's no server-side session to revoke) — but the
  account is deactivated, so re-authenticating afterward is rejected.
- All admin actions and self-service deletions are recorded via `IAuditService`.

