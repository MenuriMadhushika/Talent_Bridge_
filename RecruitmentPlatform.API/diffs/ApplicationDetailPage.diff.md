# src/pages/shared/ApplicationDetailPage.jsx

## 1. Show the AI's match explanation next to the ring

FIND:
```jsx
                <div className="row-between">
                    <div>
                        <div className="eyebrow">{application.jobTitle}</div>
                        <h1 style={{ marginBottom: 4 }}>{application.candidateName}</h1>
                        <p style={{ margin: 0 }}>Applied {new Date(application.appliedDate).toLocaleDateString()}</p>
                    </div>
                    <MatchRing score={application.matchScore} label="AI match" />
                </div>
```

REPLACE WITH:
```jsx
                <div className="row-between">
                    <div>
                        <div className="eyebrow">{application.jobTitle}</div>
                        <h1 style={{ marginBottom: 4 }}>{application.candidateName}</h1>
                        <p style={{ margin: 0 }}>Applied {new Date(application.appliedDate).toLocaleDateString()}</p>
                    </div>
                    <MatchRing score={application.matchScore} label="AI match" />
                </div>
                {application.matchExplanation && (
                    <p style={{ marginTop: 10, marginBottom: 0, fontSize: 14, opacity: 0.85 }}>
                        {application.matchExplanation}
                    </p>
                )}
```

## 2. Add a "Generate with AI" button above the Comments textarea in the evaluation form

First, add the import at the top of the file:
```jsx
import { evaluationsApi } from "../../api/evaluations";
```
(this import already exists — just add one function to `api/evaluations.js`, see below)

Add this to `src/api/evaluations.js`:
```js
export const evaluationsApi = {
  create: (dto) => api.post("/evaluations", dto),
  getForApplication: (jobApplicationId) => api.get(`/evaluations?jobApplicationId=${jobApplicationId}`),
  generateFeedback: (evaluationId) => api.post(`/evaluations/${evaluationId}/generate-feedback`),
};
```

Then in `ApplicationDetailPage.jsx`, add state near the other `useState` calls:
```jsx
const [generatingFeedback, setGeneratingFeedback] = useState(false);
const [lastEvaluationId, setLastEvaluationId] = useState(null);
```

Track the created evaluation's id — inside `handleEvaluate`, after `evaluationsApi.create(...)` resolves, do:
```jsx
setLastEvaluationId(created.id); // `created` = whatever evaluationsApi.create(...) returns
```

Add a handler function near the other handlers:
```jsx
async function handleGenerateFeedback() {
    if (!lastEvaluationId) return;
    setGeneratingFeedback(true);
    setError("");
    try {
        const { feedback } = await evaluationsApi.generateFeedback(lastEvaluationId);
        setEvalForm((prev) => ({ ...prev, comments: feedback }));
    } catch (err) {
        setError(err.message);
    } finally {
        setGeneratingFeedback(false);
    }
}
```

FIND:
```jsx
                        <div className="field">
                            <label htmlFor="comments">Comments</label>
                            <textarea id="comments" value={evalForm.comments} onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })} />
                        </div>
```

REPLACE WITH:
```jsx
                        <div className="field">
                            <div className="row-between" style={{ marginBottom: 4 }}>
                                <label htmlFor="comments" style={{ marginBottom: 0 }}>Comments</label>
                                {lastEvaluationId && (
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={handleGenerateFeedback}
                                        disabled={generatingFeedback}
                                    >
                                        {generatingFeedback ? "Generating…" : "✨ Generate with AI"}
                                    </button>
                                )}
                            </div>
                            <textarea id="comments" value={evalForm.comments} onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })} />
                        </div>
```

NOTE: the "Generate with AI" button only appears once an evaluation has been submitted (it
generates feedback *from* an existing evaluation's notes, then sends it to the candidate via
`send=true` — pass `?send=true` in `generateFeedback` if you want it to also notify the
candidate immediately, or leave it as a preview-only draft that a recruiter reviews first).
