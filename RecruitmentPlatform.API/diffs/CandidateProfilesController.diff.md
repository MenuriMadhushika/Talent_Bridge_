# Controllers/CandidateProfilesController.cs — 2 changes

## Change 1 — use the async AI parser instead of the sync keyword call

FIND:
```csharp
            string? parsedSkills = null;
            string? parsedSummary = null;
            if (Path.GetExtension(fileName).Equals(".txt", StringComparison.OrdinalIgnoreCase))
            {
                using var reader = new StreamReader(file.OpenReadStream());
                var text = await reader.ReadToEndAsync();
                (parsedSkills, parsedSummary) = _resumeParsingService.Parse(text);
            }
```

REPLACE WITH:
```csharp
            string? parsedSkills = null;
            string? parsedSummary = null;
            if (Path.GetExtension(fileName).Equals(".txt", StringComparison.OrdinalIgnoreCase))
            {
                using var reader = new StreamReader(file.OpenReadStream());
                var text = await reader.ReadToEndAsync();
                (parsedSkills, parsedSummary) = await _resumeParsingService.ParseAsync(text);
            }
```

## Change 2 — let candidates set a phone number (for SMS notifications) in UpdateMyProfile

FIND:
```csharp
        [HttpPut("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateCandidateProfileDto dto)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound("Candidate profile not found for this account.");

            profile.Headline = dto.Headline;
            profile.Summary = dto.Summary;
            profile.Location = dto.Location;
            profile.YearsOfExperience = dto.YearsOfExperience;
            profile.Skills = dto.Skills;
            profile.Education = dto.Education;

            _unitOfWork.CandidateProfiles.Update(profile);
            await _unitOfWork.SaveChangesAsync();

            var reloaded = await LoadProfileByUserId(CurrentUserId);
            return Ok(ToDto(reloaded!));
        }
```

REPLACE WITH:
```csharp
        [HttpPut("me")]
        [Authorize(Roles = Roles.Candidate)]
        public async Task<IActionResult> UpdateMyProfile([FromBody] UpdateCandidateProfileDto dto)
        {
            var profile = await _unitOfWork.CandidateProfiles.SingleOrDefaultAsync(p => p.UserId == CurrentUserId);
            if (profile is null) return NotFound("Candidate profile not found for this account.");

            profile.Headline = dto.Headline;
            profile.Summary = dto.Summary;
            profile.Location = dto.Location;
            profile.YearsOfExperience = dto.YearsOfExperience;
            profile.Skills = dto.Skills;
            profile.Education = dto.Education;

            _unitOfWork.CandidateProfiles.Update(profile);

            // Phone number lives on the Identity user, not the profile —
            // this is what NotificationService uses for the SMS channel.
            var user = await _userManager.FindByIdAsync(CurrentUserId);
            if (user is not null && dto.PhoneNumber != user.PhoneNumber)
            {
                user.PhoneNumber = dto.PhoneNumber;
                await _userManager.UpdateAsync(user);
            }

            await _unitOfWork.SaveChangesAsync();

            var reloaded = await LoadProfileByUserId(CurrentUserId);
            return Ok(ToDto(reloaded!));
        }
```

## Change 3 — include phone number when returning the profile

FIND the `ToDto` method for `CandidateProfile -> CandidateProfileDto` and add:
```csharp
PhoneNumber = profile.User.PhoneNumber,
```
to the object initializer (matches the new field added to `CandidateProfileDto` below).
