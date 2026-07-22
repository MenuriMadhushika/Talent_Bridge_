import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { jobPostingsApi } from "../../api/jobPostings";
import { applicationsApi } from "../../api/applications";
import { PostingStatusBadge } from "../../components/StatusBadge";

const DRAFT_PREFIX = "jobApplicationDraft:";

function readDraft(id) {
    try {
        return localStorage.getItem(DRAFT_PREFIX + id) || "";
    } catch {
        return ""; // storage unavailable (private mode, etc.) — fail quietly
    }
}

function writeDraft(id, value) {
    try {
        if (value) localStorage.setItem(DRAFT_PREFIX + id, value);
        else localStorage.removeItem(DRAFT_PREFIX + id);
    } catch {
        // ignore — draft persistence is a convenience, not a requirement
    }
}

function clearDraft(id) {
    try {
        localStorage.removeItem(DRAFT_PREFIX + id);
    } catch {
        // ignore
    }
}

// ---- Skeleton -----------------------------------------------------------

function SkeletonJobDetail() {
    return (
        <div aria-busy="true" aria-live="polite">
            <div className="jdp-skeleton jdp-skeleton-back" />
            <div className="card">
                <div className="row-between">
                    <div style={{ flex: 1 }}>
                        <div className="jdp-skeleton jdp-skeleton-h1" />
                        <div className="jdp-skeleton jdp-skeleton-sub" />
                    </div>
                    <div className="jdp-skeleton jdp-skeleton-badge" />
                </div>
                <div className="row" style={{ marginTop: 14, gap: 8 }}>
                    <div className="jdp-skeleton jdp-skeleton-tag" />
                    <div className="jdp-skeleton jdp-skeleton-tag" />
                    <div className="jdp-skeleton jdp-skeleton-tag" />
                </div>
                <hr className="divider" />
                <div className="jdp-skeleton jdp-skeleton-line" />
                <div className="jdp-skeleton jdp-skeleton-line" />
                <div className="jdp-skeleton jdp-skeleton-line" style={{ width: "70%" }} />
            </div>
        </div>
    );
}

const CopyIcon = ({ copied }) =>
    copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 6L9 17l-5-5" />
        </svg>
    ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
    );

// ---- Main component -----------------------------------------------------

export default function JobDetailPage() {
    const { jobId: id } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [coverLetter, setCoverLetter] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [busy, setBusy] = useState(false);
    const [draftRestored, setDraftRestored] = useState(false);
    const [copied, setCopied] = useState(false);

    const requestId = useRef(0);
    const textareaRef = useRef(null);
    const draftTimer = useRef(null);
    const copyTimer = useRef(null);

    useEffect(() => {
        const reqId = ++requestId.current;
        setJob(null);
        setError("");
        jobPostingsApi
            .getById(id)
            .then((res) => {
                if (requestId.current !== reqId) return;
                setJob(res);
                const draft = readDraft(id);
                if (draft) {
                    setCoverLetter(draft);
                    setDraftRestored(true);
                }
            })
            .catch((err) => {
                if (requestId.current !== reqId) return;
                setError(err.message);
            });
        return () => {
            requestId.current += 1;
            clearTimeout(draftTimer.current);
            clearTimeout(copyTimer.current);
        };
    }, [id]);

    // Debounced draft autosave — skip once the application has been submitted.
    useEffect(() => {
        if (!job || success) return;
        clearTimeout(draftTimer.current);
        draftTimer.current = setTimeout(() => writeDraft(id, coverLetter), 500);
        return () => clearTimeout(draftTimer.current);
    }, [coverLetter, id, job, success]);

    // Warn on navigating away with an unsubmitted, non-empty cover letter.
    useEffect(() => {
        function onBeforeUnload(e) {
            if (coverLetter.trim() && !success) {
                e.preventDefault();
                e.returnValue = "";
            }
        }
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [coverLetter, success]);

    function autoResize() {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 480)}px`;
    }

    useEffect(autoResize, [coverLetter]);

    async function handleApply(e) {
        e.preventDefault();
        setError("");
        setBusy(true);
        try {
            await applicationsApi.create({ jobPostingId: Number(id), coverLetter });
            setSuccess("Application submitted. You can track its status from My Applications.");
            clearDraft(id);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function handleCopyLink() {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setCopied(true);
            clearTimeout(copyTimer.current);
            copyTimer.current = setTimeout(() => setCopied(false), 2000);
        } catch {
            // clipboard unavailable — silently skip rather than break the page
        }
    }

    const skills = useMemo(
        () => (job?.requiredSkills || "").split(",").map((s) => s.trim()).filter(Boolean),
        [job]
    );
    const wordCount = useMemo(
        () => (coverLetter.trim() ? coverLetter.trim().split(/\s+/).length : 0),
        [coverLetter]
    );

    if (!job && !error) return <SkeletonJobDetail />;
    if (error && !job) {
        return (
            <div>
                <Link to="/jobs" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← Back to search</Link>
                <div className="form-error jdp-error">
                    {error}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate(0)}>
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div>
            <style>{JDP_STYLES}</style>

            <div className="jdp-topbar">
                <Link to="/jobs" className="btn btn-ghost btn-sm">← Back to search</Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleCopyLink}>
                    <CopyIcon copied={copied} /> {copied ? "Link copied" : "Copy link"}
                </button>
            </div>

            <div className="card">
                <div className="row-between">
                    <div>
                        <h1 style={{ marginBottom: 6 }}>{job.title}</h1>
                        <p style={{ margin: 0 }}>{job.departmentName} · {job.location || "Remote"} {job.isRemote && "· Remote"}</p>
                    </div>
                    <PostingStatusBadge status={job.status} />
                </div>

                {job.salaryMin != null && job.salaryMax != null && (
                    <p style={{ marginTop: 10 }}>${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()} / year</p>
                )}

                {skills.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                        {skills.map((s) => (
                            <span className="tag" key={s}>{s}</span>
                        ))}
                    </div>
                )}

                <hr className="divider" />
                <h3>About the role</h3>
                <p style={{ whiteSpace: "pre-wrap" }}>{job.description}</p>
            </div>

            <div className="card">
                <h3>Apply to this role</h3>
                {error && <div className="form-error">{error}</div>}
                {success ? (
                    <div className="form-success">{success}</div>
                ) : (
                    <form onSubmit={handleApply}>
                        {draftRestored && (
                            <div className="jdp-draft-notice" role="status">
                                Restored your unsent draft from earlier.
                            </div>
                        )}
                        <div className="field">
                            <label htmlFor="coverLetter">Cover letter (optional)</label>
                            <textarea
                                id="coverLetter"
                                ref={textareaRef}
                                placeholder="Tell the team why you're a fit for this role…"
                                value={coverLetter}
                                onChange={(e) => {
                                    setCoverLetter(e.target.value);
                                    setDraftRestored(false);
                                }}
                                className="jdp-textarea"
                            />
                            <div className="jdp-field-footer">
                                <span>{wordCount} word{wordCount === 1 ? "" : "s"}</span>
                                {coverLetter && !success && <span className="jdp-draft-status">Draft saved</span>}
                            </div>
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={busy || job.status !== "Open"}>
                            {busy ? "Submitting…" : job.status === "Open" ? "Submit application" : "This posting is closed"}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const JDP_STYLES = `
  .jdp-topbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
  .jdp-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

  .jdp-draft-notice {
    font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-bottom: 12px;
    border: 1px solid rgba(127,127,127,0.3); background: rgba(127,127,127,0.08);
  }

  .jdp-textarea { min-height: 120px; resize: none; overflow: hidden; transition: height 0.1s ease; }

  .jdp-field-footer {
    display: flex; justify-content: space-between; font-size: 12px; opacity: 0.6; margin-top: 4px;
  }
  .jdp-draft-status { opacity: 0.75; }

  .jdp-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: jdp-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes jdp-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .jdp-skeleton-back { height: 28px; width: 120px; margin-bottom: 16px; }
  .jdp-skeleton-h1 { height: 24px; width: 60%; margin-bottom: 10px; }
  .jdp-skeleton-sub { height: 14px; width: 40%; }
  .jdp-skeleton-badge { height: 22px; width: 70px; border-radius: 999px; }
  .jdp-skeleton-tag { height: 22px; width: 80px; border-radius: 999px; }
  .jdp-skeleton-line { height: 13px; width: 100%; margin-bottom: 8px; }

  @media (prefers-reduced-motion: reduce) {
    .jdp-skeleton, .jdp-textarea { animation: none !important; transition: none !important; }
  }
`;