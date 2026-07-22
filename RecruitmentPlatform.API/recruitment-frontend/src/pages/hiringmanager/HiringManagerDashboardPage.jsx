import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applicationsApi } from "../../api/applications";
import { interviewsApi } from "../../api/interviews";

function formatUpdatedAt(date) {
    if (!date) return "";
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function relativeDay(date) {
    const now = new Date();
    const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / (1000 * 60 * 60 * 24));
    const time = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    if (diffDays === 0) return `Today, ${time}`;
    if (diffDays === 1) return `Tomorrow, ${time}`;
    if (diffDays > 1 && diffDays < 7) return `${date.toLocaleDateString(undefined, { weekday: "long" })}, ${time}`;
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// ---- Skeleton -------------------------------------------------------------

function SkeletonStatGrid() {
    return (
        <div className="stat-grid">
            {Array.from({ length: 3 }).map((_, i) => (
                <div className="stat-card" key={i}>
                    <div className="hmd-skeleton hmd-skeleton-value" />
                    <div className="hmd-skeleton hmd-skeleton-label" />
                </div>
            ))}
        </div>
    );
}

function SkeletonList({ rows = 3 }) {
    return (
        <div className="list" aria-busy="true" aria-live="polite">
            {Array.from({ length: rows }).map((_, i) => (
                <div className="list-item" key={i}>
                    <div style={{ flex: 1 }}>
                        <div className="hmd-skeleton hmd-skeleton-title" />
                        <div className="hmd-skeleton hmd-skeleton-meta" />
                    </div>
                    <div className="hmd-skeleton hmd-skeleton-badge" />
                </div>
            ))}
        </div>
    );
}

const RefreshIcon = ({ spinning }) => (
    <svg
        className={spinning ? "hmd-spin" : ""}
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
    </svg>
);

// ---- Main component -----------------------------------------------------

const URGENCY = { InterviewScheduled: 0, Shortlisted: 1 };

export default function HiringManagerDashboardPage() {
    const [pending, setPending] = useState(null);
    const [interviewed, setInterviewed] = useState(null);
    const [upcoming, setUpcoming] = useState(null);
    const [sectionErrors, setSectionErrors] = useState([]);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    const requestId = useRef(0);

    async function load(isManualRefresh = false) {
        const id = ++requestId.current;
        if (isManualRefresh) setRefreshing(true);
        setError("");

        const [shortlistedRes, scheduledRes, doneRes, mineRes] = await Promise.allSettled([
            applicationsApi.getForPosting(undefined, "Shortlisted"),
            applicationsApi.getForPosting(undefined, "InterviewScheduled"),
            applicationsApi.getForPosting(undefined, "Interviewed"),
            interviewsApi.getMine(),
        ]);

        if (requestId.current !== id) return;

        const errs = [];

        if (shortlistedRes.status === "fulfilled" || scheduledRes.status === "fulfilled") {
            const shortlisted = shortlistedRes.status === "fulfilled" ? shortlistedRes.value : [];
            const scheduled = scheduledRes.status === "fulfilled" ? scheduledRes.value : [];
            const merged = [...scheduled, ...shortlisted].sort(
                (a, b) => (URGENCY[a.status] ?? 9) - (URGENCY[b.status] ?? 9)
            );
            setPending(merged);
            if (shortlistedRes.status === "rejected") errs.push(`Shortlisted candidates: ${shortlistedRes.reason.message}`);
            if (scheduledRes.status === "rejected") errs.push(`Scheduled candidates: ${scheduledRes.reason.message}`);
        } else {
            errs.push(`Review queue: ${shortlistedRes.reason.message}`);
        }

        if (doneRes.status === "fulfilled") {
            setInterviewed(doneRes.value);
        } else {
            errs.push(`Interviewed candidates: ${doneRes.reason.message}`);
        }

        if (mineRes.status === "fulfilled") {
            setUpcoming(
                mineRes.value
                    .filter((i) => i.status === "Scheduled" && new Date(i.scheduledAt) > new Date())
                    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
            );
        } else {
            errs.push(`Upcoming interviews: ${mineRes.reason.message}`);
        }

        setSectionErrors(errs);
        if (errs.length === 0) setLastUpdated(new Date());
        if (isManualRefresh) setRefreshing(false);
    }

    useEffect(() => {
        load(false);
        return () => {
            requestId.current += 1;
        };
    }, []);

    const statusCounts = pending?.reduce((acc, a) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
    }, {});

    const stillLoading = pending === null && interviewed === null && upcoming === null && sectionErrors.length === 0;

    if (stillLoading && !error) {
        return (
            <div>
                <div className="page-head">
                    <div>
                        <div className="eyebrow">Hiring manager dashboard</div>
                        <h1>Welcome back</h1>
                        <p>Here's where the pipeline stands across every posting you're involved in.</p>
                    </div>
                </div>
                <SkeletonStatGrid />
                <div className="card"><h3>Candidates awaiting review</h3><SkeletonList /></div>
                <div className="card"><h3>Your upcoming interviews</h3><SkeletonList rows={2} /></div>
            </div>
        );
    }

    return (
        <div>
            <style>{HMD_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Hiring manager dashboard</div>
                    <h1>Welcome back</h1>
                    <p>Here's where the pipeline stands across every posting you're involved in.</p>
                </div>
                <div className="hmd-toolbar">
                    {lastUpdated && <span className="hmd-updated">Updated {formatUpdatedAt(lastUpdated)}</span>}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(true)} disabled={refreshing}>
                        <RefreshIcon spinning={refreshing} /> {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </div>

            {error && <div className="form-error">{error}</div>}
            {sectionErrors.length > 0 && (
                <div className="form-error hmd-section-errors" role="alert">
                    <div>Some data couldn't load:</div>
                    <ul>
                        {sectionErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => load()}>Retry</button>
                </div>
            )}

            <div className="stat-grid">
                <div className="stat-card accent">
                    <div className="stat-value">{pending?.length ?? "–"}</div>
                    <div className="stat-label">Awaiting your review</div>
                    {statusCounts && (statusCounts.InterviewScheduled || statusCounts.Shortlisted) && (
                        <div className="hmd-stat-breakdown">
                            {statusCounts.InterviewScheduled ? `${statusCounts.InterviewScheduled} scheduled` : ""}
                            {statusCounts.InterviewScheduled && statusCounts.Shortlisted ? " · " : ""}
                            {statusCounts.Shortlisted ? `${statusCounts.Shortlisted} shortlisted` : ""}
                        </div>
                    )}
                </div>
                <div className="stat-card">
                    <div className="stat-value">{interviewed?.length ?? "–"}</div>
                    <div className="stat-label">Interviewed, pending decision</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{upcoming?.length ?? "–"}</div>
                    <div className="stat-label">Upcoming interviews (yours)</div>
                </div>
            </div>

            <div className="card">
                <div className="section-title">
                    <h3>Candidates awaiting review</h3>
                    <Link to="/hiring-manager/review-queue" className="btn btn-secondary btn-sm">Open review queue</Link>
                </div>
                {pending && pending.length === 0 && <p>No candidates waiting on you right now — nice and clear.</p>}
                <div className="list">
                    {pending?.slice(0, 5).map((app) => (
                        <Link key={app.id} to={`/applications/${app.id}`} className="list-item" style={{ textDecoration: "none", color: "inherit" }}>
                            <div>
                                <div className="title">{app.candidateName}</div>
                                <div className="meta">{app.jobTitle}</div>
                            </div>
                            <span className="badge badge-teal">{app.status}</span>
                        </Link>
                    ))}
                </div>
                {pending && pending.length > 5 && (
                    <p className="hmd-more-hint">
                        +{pending.length - 5} more in the{" "}
                        <Link to="/hiring-manager/review-queue">review queue</Link>.
                    </p>
                )}
            </div>

            <div className="card">
                <h3>Your upcoming interviews</h3>
                {upcoming && upcoming.length === 0 && <p>Nothing on your calendar yet.</p>}
                <div className="list">
                    {upcoming?.map((iv) => (
                        <Link key={iv.id} to={`/applications/${iv.jobApplicationId}`} className="list-item" style={{ textDecoration: "none", color: "inherit" }}>
                            <div>
                                <div className="title">{iv.candidateName}</div>
                                <div className="meta">{iv.jobTitle}</div>
                            </div>
                            <div className="meta">{relativeDay(new Date(iv.scheduledAt))}</div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const HMD_STYLES = `
  .hmd-toolbar { display: flex; align-items: center; gap: 10px; }
  .hmd-updated { font-size: 12px; opacity: 0.65; }
  .hmd-spin { animation: hmd-spin 0.8s linear infinite; }
  @keyframes hmd-spin { to { transform: rotate(360deg); } }

  .hmd-stat-breakdown { font-size: 11px; opacity: 0.7; margin-top: 4px; }

  .hmd-section-errors ul { margin: 6px 0; padding-left: 18px; font-size: 13px; }

  .hmd-more-hint { font-size: 13px; opacity: 0.75; margin-top: 10px; }

  .hmd-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: hmd-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes hmd-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .hmd-skeleton-value { height: 22px; width: 40%; margin-bottom: 8px; }
  .hmd-skeleton-label { height: 12px; width: 70%; }
  .hmd-skeleton-title { height: 14px; width: 55%; margin-bottom: 8px; }
  .hmd-skeleton-meta { height: 12px; width: 40%; }
  .hmd-skeleton-badge { height: 20px; width: 90px; border-radius: 999px; }

  @media (prefers-reduced-motion: reduce) {
    .hmd-spin, .hmd-skeleton { animation: none !important; }
  }
`;