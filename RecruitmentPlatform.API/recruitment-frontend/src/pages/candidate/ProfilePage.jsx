import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { candidateProfilesApi } from "../../api/candidateProfiles";
import { EmptyState } from "../../components/States";
import { useAuth } from "../../context/AuthContext";

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

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---- Skeleton -------------------------------------------------------------

function SkeletonProfilePage() {
    return (
        <div aria-busy="true" aria-live="polite">
            <div className="card">
                <div className="prof-skeleton prof-skeleton-title" />
                <div className="prof-skeleton prof-skeleton-field" />
                <div className="grid-2">
                    <div className="prof-skeleton prof-skeleton-field" />
                    <div className="prof-skeleton prof-skeleton-field" />
                </div>
                <div className="prof-skeleton prof-skeleton-field" style={{ height: 70 }} />
            </div>
            <div className="card">
                <div className="prof-skeleton prof-skeleton-title" />
                <div className="prof-skeleton prof-skeleton-row" />
                <div className="prof-skeleton prof-skeleton-row" />
            </div>
        </div>
    );
}

// ---- Main component -----------------------------------------------------

export default function ProfilePage() {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [profile, setProfile] = useState(null);
    const [form, setForm] = useState(blankForm);
    const [savedForm, setSavedForm] = useState(blankForm);
    const [resumes, setResumes] = useState(null);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [fileName, setFileName] = useState("");
    const [fileSize, setFileSize] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [fileInputKey, setFileInputKey] = useState(0);
    const [exporting, setExporting] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const successTimer = useRef(null);

    async function loadAll() {
        try {
            const [p, r] = await Promise.all([candidateProfilesApi.getMe(), candidateProfilesApi.getMyResumes()]);
            setProfile(p);
            const f = formFromProfile(p);
            setForm(f);
            setSavedForm(f);
            setResumes(r);
        } catch (err) {
            setError(err.message);
        }
    }

    useEffect(() => {
        loadAll();
        return () => clearTimeout(successTimer.current);
    }, []);

    const isDirty = useMemo(() => !formsEqual(form, savedForm), [form, savedForm]);

    useEffect(() => {
        function onBeforeUnload(e) {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = "";
            }
        }
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [isDirty]);

    function updateField(patch) {
        setForm((prev) => ({ ...prev, ...patch }));
        if (success) setSuccess(""); // stale "Profile updated" shouldn't linger once you're editing again
    }

    function handleDiscard() {
        setForm(savedForm);
    }

    async function handleSave(e) {
        e.preventDefault();
        setError("");
        setSuccess("");
        setSavingProfile(true);
        try {
            const payload = { ...form, yearsOfExperience: Number(form.yearsOfExperience) };
            await candidateProfilesApi.updateMe(payload);
            setSavedForm(form);
            setSuccess("Profile updated.");
            clearTimeout(successTimer.current);
            successTimer.current = setTimeout(() => setSuccess(""), 4000);
        } catch (err) {
            setError(err.message);
        } finally {
            setSavingProfile(false);
        }
    }

    function handleFileChange(e) {
        const file = e.target.files?.[0];
        setFileName(file ? file.name : "");
        setFileSize(file ? file.size : null);
        setSelectedFile(file || null);
    }

    async function handleUpload(e) {
        e.preventDefault();
        if (!selectedFile) return;
        setUploading(true);
        setError("");
        try {
            // Sends the actual file to the AI-backed parsing endpoint (falls back
            // to local keyword parsing server-side if no AI provider is configured).
            await candidateProfilesApi.uploadResume(selectedFile, (resumes?.length ?? 0) === 0);
            setFileName("");
            setFileSize(null);
            setSelectedFile(null);
            setFileInputKey((k) => k + 1); // remount so the native file input clears its displayed filename
            await loadAll();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    }

    async function handleSetPrimary(id) {
        try {
            await candidateProfilesApi.setPrimaryResume(id);
            await loadAll();
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleDelete(id) {
        if (!confirm("Remove this resume?")) return;
        try {
            await candidateProfilesApi.deleteResume(id);
            await loadAll();
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleExportData() {
        setExporting(true);
        setError("");
        try {
            const data = await candidateProfilesApi.exportMyData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "my-talentbridge-data.json";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            setError(err.message);
        } finally {
            setExporting(false);
        }
    }

    async function handleDeleteAccount() {
        if (!confirm("Delete your account? This removes your personal details and resumes and can't be undone.")) return;
        if (!confirm("Are you absolutely sure? You will be signed out immediately.")) return;
        setDeleting(true);
        setError("");
        try {
            await candidateProfilesApi.deleteMyAccount();
            logout();
            navigate("/login", { replace: true });
        } catch (err) {
            setError(err.message);
            setDeleting(false);
        }
    }

    const skillChips = useMemo(
        () => form.skills.split(",").map((s) => s.trim()).filter(Boolean),
        [form.skills]
    );

    if (!profile && !error) return <SkeletonProfilePage />;

    return (
        <div>
            <style>{PROF_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Candidate portal</div>
                    <h1>My profile</h1>
                    <p>Keep this current — recruiters search skills and experience directly.</p>
                </div>
            </div>

            {error && (
                <div className="form-error prof-error" role="alert">
                    {error}
                    {!profile && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={loadAll}>
                            Retry
                        </button>
                    )}
                </div>
            )}

            {profile && (
                <div className="card">
                    <div className="prof-card-head">
                        <h3 style={{ margin: 0 }}>Profile details</h3>
                        {isDirty && <span className="prof-dirty-badge">Unsaved changes</span>}
                    </div>
                    {success && <div className="form-success">{success}</div>}
                    <form onSubmit={handleSave}>
                        <div className="field">
                            <label htmlFor="headline">Headline</label>
                            <input
                                id="headline"
                                placeholder="e.g. Senior Frontend Engineer"
                                value={form.headline}
                                onChange={(e) => updateField({ headline: e.target.value })}
                            />
                        </div>
                        <div className="grid-2">
                            <div className="field">
                                <label htmlFor="location">Location</label>
                                <input id="location" value={form.location} onChange={(e) => updateField({ location: e.target.value })} />
                            </div>
                            <div className="field">
                                <label htmlFor="years">Years of experience</label>
                                <input
                                    id="years"
                                    type="number"
                                    min="0"
                                    max="60"
                                    value={form.yearsOfExperience}
                                    onChange={(e) => updateField({ yearsOfExperience: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="summary">Summary</label>
                            <textarea id="summary" value={form.summary} onChange={(e) => updateField({ summary: e.target.value })} />
                            <div className="prof-field-footer">{form.summary.length} characters</div>
                        </div>
                        <div className="field">
                            <label htmlFor="skills">Skills</label>
                            <input
                                id="skills"
                                placeholder="Comma-separated, e.g. React, TypeScript, GraphQL"
                                value={form.skills}
                                onChange={(e) => updateField({ skills: e.target.value })}
                            />
                            {skillChips.length > 0 && (
                                <div className="prof-skill-chips">
                                    {skillChips.map((s, i) => (
                                        <span className="tag" key={`${s}-${i}`}>{s}</span>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="field">
                            <label htmlFor="education">Education</label>
                            <input id="education" value={form.education} onChange={(e) => updateField({ education: e.target.value })} />
                        </div>
                        <div className="row" style={{ gap: 10 }}>
                            <button className="btn btn-primary" type="submit" disabled={savingProfile || !isDirty}>
                                {savingProfile ? "Saving…" : "Save changes"}
                            </button>
                            {isDirty && (
                                <button className="btn btn-ghost" type="button" onClick={handleDiscard} disabled={savingProfile}>
                                    Discard changes
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

            {profile && (
                <div className="card">
                    <h3>Resumes</h3>
                    <form onSubmit={handleUpload} className="row" style={{ marginBottom: 8, alignItems: "center" }}>
                        <input key={fileInputKey} type="file" onChange={handleFileChange} />
                        <button className="btn btn-secondary btn-sm" type="submit" disabled={!fileName || uploading}>
                            {uploading ? "Adding…" : "Add resume"}
                        </button>
                    </form>
                    {fileName && (
                        <p className="prof-file-preview">
                            Selected: {fileName}{fileSize != null && ` (${formatFileSize(fileSize)})`}
                        </p>
                    )}

                    {resumes && resumes.length === 0 && (
                        <EmptyState title="No resumes yet" body="Add a resume so recruiters and the AI matching service can review your background." />
                    )}

                    <div className="stack">
                        {resumes?.map((r) => (
                            <div className="resume-row" key={r.id}>
                                <div>
                                    <div className="file">{r.fileName} {r.isPrimary && <span className="badge badge-teal" style={{ marginLeft: 8 }}>Primary</span>}</div>
                                    <div className="meta">Uploaded {new Date(r.uploadedAt).toLocaleDateString()}</div>
                                    {r.parsedSkills && (
                                        <div className="prof-parsed-skills">
                                            <span className="prof-parsed-label">AI-detected skills:</span> {r.parsedSkills}
                                        </div>
                                    )}
                                    {r.parsedExperienceSummary && (
                                        <div className="prof-parsed-summary">
                                            <span className="prof-parsed-label">AI summary:</span> {r.parsedExperienceSummary}
                                        </div>
                                    )}
                                    {!r.parsedSkills && !r.parsedExperienceSummary && (
                                        <div className="prof-parsed-empty">Not parsed (unsupported file type, or no text extracted)</div>
                                    )}
                                </div>
                                <div className="row">
                                    {!r.isPrimary && (
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleSetPrimary(r.id)}>Set primary</button>
                                    )}
                                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r.id)}>Remove</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {profile && (
                <div className="card">
                    <h3>Data &amp; privacy</h3>
                    <p className="prof-field-footer" style={{ textAlign: "left", marginTop: 0 }}>
                        Export everything this platform holds about you, or permanently delete your account.
                    </p>
                    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportData} disabled={exporting}>
                            {exporting ? "Preparing export…" : "Export my data"}
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={handleDeleteAccount} disabled={deleting}>
                            {deleting ? "Deleting…" : "Delete my account"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const PROF_STYLES = `
  .prof-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

  .prof-card-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
  .prof-dirty-badge {
    font-size: 12px; padding: 3px 9px; border-radius: 999px; opacity: 0.85;
    border: 1px solid rgba(201, 162, 39, 0.5); background: rgba(201, 162, 39, 0.12);
  }

  .prof-field-footer { font-size: 12px; opacity: 0.55; margin-top: 4px; text-align: right; }

  .prof-skill-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }

  .prof-file-preview { font-size: 13px; opacity: 0.7; margin: 0 0 14px; }

  .prof-parsed-skills, .prof-parsed-summary { font-size: 12.5px; opacity: 0.8; margin-top: 4px; max-width: 480px; }
  .prof-parsed-empty { font-size: 12px; opacity: 0.5; margin-top: 4px; font-style: italic; }
  .prof-parsed-label { font-weight: 600; opacity: 0.9; }

  .prof-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: prof-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes prof-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .prof-skeleton-title { height: 16px; width: 160px; margin-bottom: 14px; }
  .prof-skeleton-field { height: 38px; width: 100%; margin-bottom: 12px; }
  .prof-skeleton-row { height: 48px; width: 100%; margin-bottom: 10px; }

  @media (prefers-reduced-motion: reduce) {
    .prof-skeleton { animation: none !important; }
  }
`;