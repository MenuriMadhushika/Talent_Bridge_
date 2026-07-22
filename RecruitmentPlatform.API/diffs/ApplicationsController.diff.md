# Controllers/ApplicationsController.cs

FIND:
```csharp
            var application = new JobApplication
            {
                JobPostingId = dto.JobPostingId,
                CandidateProfileId = profile.Id,
                CoverLetter = dto.CoverLetter,
                Status = ApplicationStatus.Submitted,
                // AI-powered candidate-job matching: scored at application time
                // so recruiters can immediately rank/screen the pipeline.
                MatchScore = _matchingService.ComputeMatchScore(profile.Skills, posting.RequiredSkills)
            };

            await _unitOfWork.JobApplications.AddAsync(application);
```

REPLACE WITH:
```csharp
            // AI-powered candidate-job matching: scored at application time
            // so recruiters can immediately rank/screen the pipeline, with a
            // short explanation of the fit rather than a bare percentage.
            var match = await _matchingService.ComputeMatchAsync(profile.Skills, posting.RequiredSkills);

            var application = new JobApplication
            {
                JobPostingId = dto.JobPostingId,
                CandidateProfileId = profile.Id,
                CoverLetter = dto.CoverLetter,
                Status = ApplicationStatus.Submitted,
                MatchScore = match.Score,
                MatchExplanation = match.Explanation
            };

            await _unitOfWork.JobApplications.AddAsync(application);
```
