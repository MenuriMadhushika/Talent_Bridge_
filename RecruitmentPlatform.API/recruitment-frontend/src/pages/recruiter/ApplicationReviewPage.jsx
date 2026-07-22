import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { applicationsApi } from "../../api/applications";
import { jobPostingsApi } from "../../api/jobPostings";
import { EmptyState } from "../../components/States";
import { ApplicationStatusBadge } from "../../components/StatusBadge";
import MatchRing from "../../components/MatchRing";

const STATUS_OPTIONS = [
    "Submitted", "UnderReview", "Shortlisted", "InterviewScheduled",
    "Interviewed", "Offered", "Rejected", "Withdrawn", "Hired",
];

function toCsv(apps) {
    const header = "Candidate,Status,Applied,Match score";
    const lines = apps.map((a) =>
        [
            a.candidateName,
            a.status,
            new Date(a.appliedDate).toLocaleDateString(),
            a.matchScore != null ? `${a.matchScore}%` : "",
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
                        <div className="arp-skeleton arp-skeleton-title" />
                        <div className="arp-skeleton arp-skeleton-meta" />
                        <div className="arp-skeleton arp-skeleton-badge" />
                    </div>
                    <div className="arp-skeleton arp-skeleton-ring" />
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

export default function ApplicationReviewPage() {
    const { jobPostingId } = useParams();
    const [job, setJob] = useState(null);
    const [applications, setApplications] = useState(null);
    const [statusFilter, setStatusFilter] = useState("");
    const [jobError, setJobError] = useState("");
    const [listError, setListError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [sortMode, setSortMode] = useState("default"); // "default" | "match" | "recent" | "oldest"

    const requestId = useRef(0);
    const noticeTimer = useRef(null);

    function flashNotice(text) {
        setNotice(text);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(""), 2500);
    }

    async function load() {
        const id = ++requestId.current;
        setListError("");
        setApplications(null);
        if (!job) setJobError("");

        const [jobRes, appsRes] = await Promise.allSettled([
            jobPostingsApi.getById(jobPostingId),
            applicationsApi.getForPosting(jobPostingId, statusFilter || undefined),
        ]);

        if (requestId.current !== id) return;

        if (jobRes.status === "fulfilled") {
            setJob(jobRes.value);
            setJobError("");
        } else {
            setJobError(jobRes.reason.message);
        }

        if (appsRes.status === "fulfilled") {
            setApplications(appsRes.value);
        } else {
            setListError(appsRes.reason.message);
        }
    }

    useEffect(() => {
        load();
        return () => {
            requestId.current += 1;
            clearTimeout(noticeTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [jobPostingId, statusFilter]);

    async function handleStatusChange(id, status) {
        setBusyId(id);
        try {
            await applicationsApi.updateStatus(id, status);
            await load();
            flashNotice(`Moved to ${status}.`);
        } catch (err) {
            setListError(err.message);
        } finally {
            setBusyId(null);
        }
    }

    const visibleApps = useMemo(() => {
        if (!applications) return [];
        let list = applications;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((a) => a.candidateName?.toLowerCase().includes(q));
        }
        if (sortMode !== "default") {
            list = [...list].sort((a, b) => {
                if (sortMode === "match") return (b.matchScore ?? -1) - (a.matchScore ?? -1);
                const diff = new Date(a.appliedDate) - new Date(b.appliedDate);
                return sortMode === "oldest" ? diff : -diff;
            });
        }
        return list;
    }, [applications, search, sortMode]);

    return (
        <div>
            <style>{ARP_STYLES}</style>

            <Link to="/recruiter/postings" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← All postings</Link>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Recruiter portal</div>
                    <h1>{job ? job.title : "Review applications"}</h1>
                    <p>Move candidates through the pipeline as your team reviews them.</p>
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: "fit-content" }}>
                    <option value="">All statuses</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {jobError && (
                <div className="form-error arp-error" role="alert">
                    Couldn't load the job posting details ({jobError}).
                    <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Retry</button>
                </div>
            )}
            {listError && (
                <div className="form-error arp-error" role="alert">
                    {listError}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={load}>Retry</button>
                </div>
            )}
            {notice && (
                <div className="arp-notice" role="status" aria-live="polite">
                    {notice}
                </div>
            )}

            {applications && applications.length > 0 && (
                <div className="arp-toolbar">
                    <div className="arp-search">
                        <SearchIcon />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search candidate name…"
                            aria-label="Search candidates"
                        />
                    </div>
                    <select className="arp-sort-select" value={sortMode} onChange={(e) => setSortMode(e.target.value)} aria-label="Sort candidates">
                        <option value="default">Sort: Default</option>
                        <option value="match">Sort: Best match</option>
                        <option value="recent">Sort: Recently applied</option>
                        <option value="oldest">Sort: Oldest applied</option>
                    </select>
                    <span className="arp-count">{visibleApps.length} of {applications.length}</span>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => downloadCsv(`applications-${jobPostingId}.csv`, toCsv(visibleApps))}
                    >
                        <DownloadIcon /> Export
                    </button>
                </div>
            )}

            {applications === null && !listError && <SkeletonList />}

            {applications && applications.length === 0 && (
                <EmptyState title="No applications match this filter" body="Try a different status, or check back once candidates apply." />
            )}

            {applications && applications.length > 0 && visibleApps.length === 0 && (
                <p className="arp-empty-filtered">No candidates match “{search}”.</p>
            )}

            <div className="list">
                {visibleApps.map((app) => (
                    <div className={`list-item ${busyId === app.id ? "arp-row-busy" : ""}`} key={app.id}>
                        <div>
                            <div className="title">{app.candidateName}</div>
                            <div className="meta">Applied {new Date(app.appliedDate).toLocaleDateString()}</div>
                            <div style={{ marginTop: 8 }}><ApplicationStatusBadge status={app.status} /></div>
                        </div>
                        <div className="row">
                            <MatchRing score={app.matchScore} />
                            <select
                                value={app.status}
                                disabled={busyId === app.id}
                                onChange={(e) => handleStatusChange(app.id, e.target.value)}
                            >
                                {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <Link to={`/recruiter/candidates/${app.candidateProfileId}`} className="btn btn-secondary btn-sm">
                                View profile
                            </Link>
                            <Link to={`/applications/${app.id}`} className="btn btn-primary btn-sm">
                                Schedule / details
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const ARP_STYLES = `
  .arp-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .arp-notice {
    font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px;
    border: 1px solid rgba(79, 157, 105, 0.35); background: rgba(79, 157, 105, 0.08);
  }

  .arp-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
  .arp-search {
    display: flex; align-items: center; gap: 6px; padding: 5px 10px;
    border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
  }
  .arp-search input { border: none; background: transparent; outline: none; font-size: 13px; color: inherit; width: 190px; }
  .arp-sort-select { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35); background: transparent; color: inherit; font-size: 13px; }
  .arp-count { font-size: 12px; opacity: 0.65; margin-left: auto; }

  .arp-empty-filtered { opacity: 0.7; font-size: 13px; }

  .arp-row-busy { opacity: 0.6; transition: opacity 0.15s ease; }

  .arp-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: arp-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes arp-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .arp-skeleton-title { height: 15px; width: 140px; margin-bottom: 8px; }
  .arp-skeleton-meta { height: 12px; width: 160px; margin-bottom: 8px; }
  .arp-skeleton-badge { height: 20px; width: 100px; border-radius: 999px; }
  .arp-skeleton-ring { height: 44px; width: 44px; border-radius: 50%; }

  @media (prefers-reduced-motion: reduce) {
    .arp-skeleton { animation: none !important; }
  }

  @media (max-width: 640px) {
    .arp-toolbar { flex-direction: column; align-items: stretch; }
    .arp-search input { width: 100%; }
    .arp-count { margin-left: 0; }
  }
`;