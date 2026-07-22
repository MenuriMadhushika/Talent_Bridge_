# appsettings.json

FIND:
```json
  "JwtSettings": {
    "Secret": "SuperSecretKeyForTalentBridge2026_AtLeast32CharactersLong!!!",
    "Issuer": "RecruitmentPlatform.API",
    "Audience": "RecruitmentPlatform.Client",
    "ExpiryMinutes": 120
  },
```

REPLACE WITH:
```json
  "JwtSettings": {
    "Secret": "SuperSecretKeyForTalentBridge2026_AtLeast32CharactersLong!!!",
    "Issuer": "RecruitmentPlatform.API",
    "Audience": "RecruitmentPlatform.Client",
    "ExpiryMinutes": 120
  },
  "AiSettings": {
    "Enabled": true,
    "Model": "claude-sonnet-4-6",
    "ApiKey": ""
  },
  "SmsSettings": {
    "Enabled": false,
    "AccountSid": "",
    "AuthToken": "",
    "FromNumber": ""
  },
```

IMPORTANT: don't commit real values for `AiSettings:ApiKey` / `SmsSettings:AccountSid` /
`SmsSettings:AuthToken` to source control. Set them instead via:

```
dotnet user-secrets set "AiSettings:ApiKey" "sk-ant-..."
dotnet user-secrets set "SmsSettings:AccountSid" "AC..."
dotnet user-secrets set "SmsSettings:AuthToken" "..."
dotnet user-secrets set "SmsSettings:FromNumber" "+1..."
```
or environment variables (`AiSettings__ApiKey`, etc.) in whatever hosting environment you deploy to.
Leaving `AiSettings:Enabled` / `SmsSettings:Enabled` as `false`/no-key keeps both features
gracefully degrading to the original local logic — nothing breaks if you don't set keys yet.
