# src/pages/candidate/ProfilePage.jsx

## 1. Include phone in the form shape

FIND:
```jsx
const blankForm = { headline: "", summary: "", location: "", yearsOfExperience: 0, skills: "", education: "" };

function formFromProfile(p) {
    return {
        headline: p.headline || "",
        summary: p.summary || "",
        location: p.location || "",
        yearsOfExperience: p.yearsOfExperience ?? 0, // was raw p.yearsOfExperience — undefined made the input uncontrolled
        skills: p.skills || "",
        education: p.education || "",
    };
}

function formsEqual(a, b) {
    return (
        a.headline === b.headline &&
        a.summary === b.summary &&
        a.location === b.location &&
        String(a.yearsOfExperience) === String(b.yearsOfExperience) &&
        a.skills === b.skills &&
        a.education === b.education
    );
}
```

REPLACE WITH:
```jsx
const blankForm = { headline: "", summary: "", location: "", yearsOfExperience: 0, skills: "", education: "", phoneNumber: "" };

function formFromProfile(p) {
    return {
        headline: p.headline || "",
        summary: p.summary || "",
        location: p.location || "",
        yearsOfExperience: p.yearsOfExperience ?? 0, // was raw p.yearsOfExperience — undefined made the input uncontrolled
        skills: p.skills || "",
        education: p.education || "",
        phoneNumber: p.phoneNumber || "",
    };
}

function formsEqual(a, b) {
    return (
        a.headline === b.headline &&
        a.summary === b.summary &&
        a.location === b.location &&
        String(a.yearsOfExperience) === String(b.yearsOfExperience) &&
        a.skills === b.skills &&
        a.education === b.education &&
        a.phoneNumber === b.phoneNumber
    );
}
```

## 2. Add the field to the form UI (right after the "Education" field, before the save/discard button row)

FIND:
```jsx
                        <div className="field">
                            <label htmlFor="education">Education</label>
                            <input id="education" value={form.education} onChange={(e) => updateField({ education: e.target.value })} />
                        </div>
                        <div className="row" style={{ gap: 10 }}>
```

REPLACE WITH:
```jsx
                        <div className="field">
                            <label htmlFor="education">Education</label>
                            <input id="education" value={form.education} onChange={(e) => updateField({ education: e.target.value })} />
                        </div>
                        <div className="field">
                            <label htmlFor="phoneNumber">Phone number</label>
                            <input
                                id="phoneNumber"
                                type="tel"
                                placeholder="+1 555 123 4567"
                                value={form.phoneNumber}
                                onChange={(e) => updateField({ phoneNumber: e.target.value })}
                            />
                            <div className="prof-field-footer" style={{ textAlign: "left" }}>
                                Optional — used to text you interview reminders and application status updates.
                            </div>
                        </div>
                        <div className="row" style={{ gap: 10 }}>
```
