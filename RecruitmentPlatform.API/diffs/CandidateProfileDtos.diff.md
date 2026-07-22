# Models/DTOs/CandidateProfileDtos.cs — add PhoneNumber

FIND:
```csharp
    public class UpdateCandidateProfileDto
    {
        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public string? Location { get; set; }
        [Range(0, 60)] public int YearsOfExperience { get; set; }
        public string Skills { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
    }
```

REPLACE WITH:
```csharp
    public class UpdateCandidateProfileDto
    {
        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public string? Location { get; set; }
        [Range(0, 60)] public int YearsOfExperience { get; set; }
        public string Skills { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;

        // Used for the SMS notification channel (interview reminders,
        // application status updates). Optional — leave blank to opt out.
        [Phone] public string? PhoneNumber { get; set; }
    }
```
(add `using System.ComponentModel.DataAnnotations;` at the top if not already present — it already is in this file.)

---

FIND:
```csharp
    public class CandidateProfileDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public string? Location { get; set; }
        public int YearsOfExperience { get; set; }
        public string Skills { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
        public int ResumeCount { get; set; }
        public int ApplicationCount { get; set; }
    }
```

REPLACE WITH:
```csharp
    public class CandidateProfileDto
    {
        public int Id { get; set; }
        public string FullName { get; set; } = string.Empty;
        public string? Headline { get; set; }
        public string? Summary { get; set; }
        public string? Location { get; set; }
        public int YearsOfExperience { get; set; }
        public string Skills { get; set; } = string.Empty;
        public string Education { get; set; } = string.Empty;
        public string? PhoneNumber { get; set; }
        public int ResumeCount { get; set; }
        public int ApplicationCount { get; set; }
    }
```
