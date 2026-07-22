import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applicationsApi } from "../../api/applications";
import { EmptyState } from "../../components/States";
import { ApplicationStatusBadge } from "../../components/StatusBadge";
import MatchRing from "../../components/MatchRing";

const STATUS_OPTIONS = ["Shortlisted", "InterviewScheduled", "Interviewed", "Offered", "Hired", "Rejected"];

function splitWords(value = "") {
    return value.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function toCsv(apps) {
    const header = "Candidate,Job title,Status,Applied,Match score,Interviews";
    const lines = apps.map((a) =>
        [
            a.candidateName,
            a.jobTitle,
            a.status,
            new Date(a.appliedDate).toLocaleDateString(),
            a.matchScore != null ? `${a.matchScore}%` : "",
            a.interviewCount ?? 0,
        ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
    );
    return [header, ...lines].join("\n");
}

function downloadCsv(filename, csv) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ---- Skeleton -------------------------------------------------------------

function SkeletonList({ count = 5 }) {
    return (
        <div className="list" aria-busy="true" aria-live="polite">
            {Array.from({ length: count }).map((_, i) => (
                <div className="list-item" key={i}>
                    <div style={{ flex: 1 }}>
                        <div className="rq-skeleton rq-skeleton-title" />
                        <div className="rq-skeleton rq-skeleton-meta" />
                        <div className="rq-skeleton rq-skeleton-badge" />
                    </div>
                    <div className="rq-skeleton rq-skeleton-ring" />
                </div>
            ))}
        </div>
    );
}

const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 21h14" />
    </svg>
);

// ---- Main component -----------------------------------------------------

export default function ReviewQueuePage() {
    const [status, setStatus] = useState("Shortlisted");
    const [applications, setApplications] = useState(null);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [sortMode, setSortMode] = useState("default"); // "default" | "match" | "recent" | "oldest" | "interviews"

    const requestId = useRef(0);

    async function load(s) {
        const id = ++requestId.current;
        setApplications(null);
        setError("");
        try {
            const data = await applicationsApi.getForPosting(undefined, s);
            if (requestId.current !== id) return;
            setApplications(data);
        } catch (err) {
            if (requestId.current !== id) return;
            setError(err.message);
        }
    }

    useEffect(() => {
        load(status);
        return () => {
            requestId.current += 1;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [status]);

    const visibleApps = useMemo(() => {
        if (!applications) return [];
        let list = applications;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                (a) => a.candidateName?.toLowerCase().includes(q) || a.jobTitle?.toLowerCase().includes(q)
            );
        }
        if (sortMode !== "default") {
            list = [...list].sort((a, b) => {
                if (sortMode === "match") return (b.matchScore ?? -1) - (a.matchScore ?? -1);
                if (sortMode === "interviews") return (b.interviewCount ?? 0) - (a.interviewCount ?? 0);
                const diff = new Date(a.appliedDate) - new Date(b.appliedDate);
                return sortMode === "oldest" ? diff : -diff;
            });
        }
        return list;
    }, [applications, search, sortMode]);

    return (
        <div>
            <style>{RQ_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Hiring manager portal</div>
                    <h1>Review queue</h1>
                    <p>Candidates across every posting, grouped by pipeline stage.</p>
                </div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ height: "fit-content" }}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {error && (
                <div className="form-error rq-error" role="alert">
                    {error}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(status)}>
                        Retry
                    </button>
                </div>
            )}

            {applications && applications.length > 0 && (
                <div className="rq-toolbar">
                    <div className="rq-search">
                        <SearchIcon />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search candidate or job title…"
                            aria-label="Search candidates"
                        />
                    </div>
                    <select className="rq-sort-select" value={sortMode} onChange={(e) => setSortMode(e.target.value)} aria-label="Sort candidates">
                        <option value="default">Sort: Default</option>
                        <option value="match">Sort: Best match</option>
                        <option value="recent">Sort: Recently applied</option>
                        <option value="oldest">Sort: Oldest applied</option>
                        <option value="interviews">Sort: Most interviews</option>
                    </select>
                    <span className="rq-count">
                        {visibleApps.length} of {applications.length} in {splitWords(status).toLowerCase()}
                    </span>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => downloadCsv(`review-queue-${status}.csv`, toCsv(visibleApps))}
                    >
                        <DownloadIcon /> Export
                    </button>
                </div>
            )}

            {applications && applications.length === 0 && (
                <EmptyState
                    title={`No candidates are ${splitWords(status).toLowerCase()}`}
                    body="Try a different stage, or check back once recruiters move candidates forward."
                />
            )}

            {applications && applications.length > 0 && visibleApps.length === 0 && (
                <p className="rq-empty-filtered">No candidates match “{search}”.</p>
            )}

            {applications === null && !error && <SkeletonList />}

            <div className="list">
                {visibleApps.map((app) => (
                    <Link key={app.id} to={`/applications/${app.id}`} className="list-item" style={{ textDecoration: "none", color: "inherit" }}>
                        <div>
                            <div className="title">{app.candidateName}</div>
                            <div className="meta">{app.jobTitle} · Applied {new Date(app.appliedDate).toLocaleDateString()}</div>
                            <div style={{ marginTop: 8 }}><ApplicationStatusBadge status={app.status} /></div>
                        </div>
                        <div className="row">
                            <MatchRing score={app.matchScore} />
                            {app.interviewCount > 0 && <span className="tag">{app.interviewCount} interview{app.interviewCount === 1 ? "" : "s"}</span>}
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const RQ_STYLES = `
  .rq-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }

  .rq-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .rq-search {
    display: flex; align-items: center; gap: 6px; padding: 5px 10px;
    border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
  }
  .rq-search input { border: none; background: transparent; outline: none; font-size: 13px; color: inherit; width: 200px; }
  .rq-sort-select { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35); background: transparent; color: inherit; font-size: 13px; }
  .rq-count { font-size: 12px; opacity: 0.65; margin-left: auto; }

  .rq-empty-filtered { opacity: 0.7; font-size: 13px; }

  .rq-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: rq-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes rq-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .rq-skeleton-title { height: 15px; width: 140px; margin-bottom: 8px; }
  .rq-skeleton-meta { height: 12px; width: 200px; margin-bottom: 8px; }
  .rq-skeleton-badge { height: 20px; width: 100px; border-radius: 999px; }
  .rq-skeleton-ring { height: 44px; width: 44px; border-radius: 50%; }

  @media (prefers-reduced-motion: reduce) {
    .rq-skeleton { animation: none !important; }
  }

  @media (max-width: 640px) {
    .rq-toolbar { flex-direction: column; align-items: stretch; }
    .rq-search input { width: 100%; }
    .rq-count { margin-left: 0; }
  }
`;