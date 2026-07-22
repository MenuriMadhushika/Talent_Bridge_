# Models/Entities/JobApplication.cs

FIND:
```csharp
        // Populated by the AI candidate-job matching service (0-100)
        public double? MatchScore { get; set; }
```

REPLACE WITH:
```csharp
        // Populated by the AI candidate-job matching service (0-100)
        public double? MatchScore { get; set; }

        // Short AI-generated rationale for the score, shown to recruiters
        // ("Strong overlap in React/TypeScript, missing GraphQL experience.")
        public string? MatchExplanation { get; set; }
```

NOTE: after adding this, run a migration:
```
dotnet ef migrations add AddMatchExplanation
dotnet ef database update
```

---

# Models/DTOs/ApplicationDtos.cs

FIND:
```csharp
        public string? CoverLetter { get; set; }
        public double? MatchScore { get; set; }
        public int InterviewCount { get; set; }
    }
```

REPLACE WITH:
```csharp
        public string? CoverLetter { get; set; }
        public double? MatchScore { get; set; }
        public string? MatchExplanation { get; set; }
        public int InterviewCount { get; set; }
    }
```

Also update the `ToDto` mapping method in `ApplicationsController.cs` (wherever `MatchScore = a.MatchScore` is set)
to also include:
```csharp
MatchExplanation = a.MatchExplanation,
```
