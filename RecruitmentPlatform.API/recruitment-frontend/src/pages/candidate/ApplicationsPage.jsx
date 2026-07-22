import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { applicationsApi } from "../../api/applications";
import { EmptyState } from "../../components/States";
import { ApplicationStatusBadge } from "../../components/StatusBadge";
import MatchRing from "../../components/MatchRing";

const CLOSED_STATUSES = new Set(["Withdrawn", "Hired", "Rejected"]);

function toCsv(apps) {
    const header = "Job title,Applied,Status,Match score";
    const lines = apps.map((a) =>
        [
            a.jobTitle,
            new Date(a.appliedDate).toLocaleDateString(),
            a.status,
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

const REDUCE_MOTION =
    typeof window !== "undefined" && window.matchMedia
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

// ---- Skeleton -----------------------------------------------------------

function SkeletonList({ count = 4 }) {
    return (
        <div className="list" aria-busy="true" aria-live="polite">
            {Array.from({ length: count }).map((_, i) => (
                <div className="list-item" key={i}>
                    <div style={{ flex: 1 }}>
                        <div className="capp-skeleton capp-skeleton-title" />
                        <div className="capp-skeleton capp-skeleton-meta" />
                        <div className="capp-skeleton capp-skeleton-badge" />
                    </div>
                    <div className="capp-skeleton capp-skeleton-ring" />
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

export default function ApplicationsPage() {
    const [applications, setApplications] = useState(null);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [sortMode, setSortMode] = useState("recent"); // "recent" | "oldest" | "match"
    const [listReady, setListReady] = useState(false);

    const requestId = useRef(0);
    const noticeTimer = useRef(null);

    function flashNotice(text) {
        setNotice(text);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(""), 2500);
    }

    async function load() {
        const id = ++requestId.current;
        setError("");
        try {
            const data = await applicationsApi.getMine();
            if (requestId.current !== id) return;
            setApplications(data);
        } catch (err) {
            if (requestId.current !== id) return;
            setError(err.message);
        }
    }

    useEffect(() => {
        load();
        return () => {
            requestId.current += 1;
            clearTimeout(noticeTimer.current);
        };
    }, []);

    useEffect(() => {
        if (!applications) return;
        setListReady(false);
        const t = setTimeout(() => setListReady(true), REDUCE_MOTION ? 0 : 30);
        return () => clearTimeout(t);
    }, [applications]);

    async function handleWithdraw(id, jobTitle) {
        if (!confirm("Withdraw this application? This can't be undone.")) return;
        setBusyId(id);
        try {
            await applicationsApi.withdraw(id);
            await load();
            flashNotice(`Withdrawn from “${jobTitle}”.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    }

    const statuses = useMemo(() => {
        if (!applications) return [];
        return [...new Set(applications.map((a) => a.status))];
    }, [applications]);

    const summary = useMemo(() => {
        if (!applications) return null;
        const active = applications.filter((a) => !CLOSED_STATUSES.has(a.status)).length;
        const scored = applications.filter((a) => a.matchScore != null);
        const avgMatch = scored.length
            ? Math.round(scored.reduce((sum, a) => sum + a.matchScore, 0) / scored.length)
            : null;
        return { total: applications.length, active, avgMatch };
    }, [applications]);

    const visibleApps = useMemo(() => {
        if (!applications) return [];
        let list = applications;
        if (statusFilter !== "All") list = list.filter((a) => a.status === statusFilter);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter((a) => a.jobTitle?.toLowerCase().includes(q));
        }
        list = [...list].sort((a, b) => {
            if (sortMode === "match") return (b.matchScore ?? -1) - (a.matchScore ?? -1);
            const diff = new Date(a.appliedDate) - new Date(b.appliedDate);
            return sortMode === "oldest" ? diff : -diff;
        });
        return list;
    }, [applications, search, statusFilter, sortMode]);

    if (!applications && !error) return <SkeletonList />;

    return (
        <div>
            <style>{CAPP_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Candidate portal</div>
                    <h1>My applications</h1>
                    <p>Track every role you've applied to and where it stands.</p>
                </div>
                <Link to="/jobs" className="btn btn-secondary">Find more jobs</Link>
            </div>

            {error && (
                <div className="form-error capp-error" role="alert">
                    {error}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={load}>
                        Retry
                    </button>
                </div>
            )}
            {notice && (
                <div className="capp-notice" role="status" aria-live="polite">
                    {notice}
                </div>
            )}

            {applications && applications.length === 0 && (
                <EmptyState
                    title="No applications yet"
                    body="Once you apply to a role, you'll be able to track its progress here."
                    action={<Link to="/jobs" className="btn btn-primary" style={{ marginTop: 12 }}>Browse open roles</Link>}
                />
            )}

            {applications && applications.length > 0 && summary && (
                <p className="capp-summary">
                    <strong>{summary.total}</strong> application{summary.total === 1 ? "" : "s"} ·{" "}
                    <strong>{summary.active}</strong> active
                    {summary.avgMatch !== null && (
                        <> · <strong>{summary.avgMatch}%</strong> avg. match</>
                    )}
                </p>
            )}

            {applications && applications.length > 0 && (
                <div className="capp-toolbar">
                    <div className="capp-search">
                        <SearchIcon />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search job title…"
                            aria-label="Search applications"
                        />
                    </div>

                    <div className="capp-chips" role="group" aria-label="Filter by status">
                        <button
                            type="button"
                            className={`capp-chip ${statusFilter === "All" ? "active" : ""}`}
                            onClick={() => setStatusFilter("All")}
                        >
                            All
                        </button>
                        {statuses.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={`capp-chip ${statusFilter === s ? "active" : ""}`}
                                onClick={() => setStatusFilter(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>

                    <select
                        className="capp-sort-select"
                        value={sortMode}
                        onChange={(e) => setSortMode(e.target.value)}
                        aria-label="Sort applications"
                    >
                        <option value="recent">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="match">Best match first</option>
                    </select>

                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => downloadCsv("my-applications.csv", toCsv(visibleApps))}
                    >
                        <DownloadIcon /> Export
                    </button>
                </div>
            )}

            {applications && applications.length > 0 && visibleApps.length === 0 && (
                <p className="capp-empty-filtered">
                    {search ? `No applications match “${search}”.` : `No applications with status “${statusFilter}”.`}
                </p>
            )}

            <div className="list">
                {visibleApps.map((app, index) => (
                    <div
                        className="list-item capp-item"
                        key={app.id}
                        style={{
                            opacity: listReady ? 1 : 0,
                            transform: listReady ? "translateY(0)" : "translateY(4px)",
                            transitionDelay: REDUCE_MOTION ? "0ms" : `${index * 35}ms`,
                        }}
                    >
                        <div>
                            <div className="title">{app.jobTitle}</div>
                            <div className="meta">Applied {new Date(app.appliedDate).toLocaleDateString()}</div>
                            <div style={{ marginTop: 8 }}><ApplicationStatusBadge status={app.status} /></div>
                        </div>
                        <div className="row">
                            <MatchRing score={app.matchScore ? app.matchScore : null} />
                            <Link to={`/applications/${app.id}`} className="btn btn-secondary btn-sm">View / message</Link>
                            {app.status !== "Withdrawn" && app.status !== "Hired" && app.status !== "Rejected" && (
                                <button
                                    className="btn btn-danger btn-sm"
                                    disabled={busyId === app.id}
                                    onClick={() => handleWithdraw(app.id, app.jobTitle)}
                                >
                                    {busyId === app.id ? "Withdrawing…" : "Withdraw"}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const CAPP_STYLES = `
  .capp-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .capp-notice {
    font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px;
    border: 1px solid rgba(79, 157, 105, 0.35); background: rgba(79, 157, 105, 0.08);
  }

  .capp-summary { font-size: 13px; opacity: 0.75; margin: -6px 0 16px; }

  .capp-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .capp-search {
    display: flex; align-items: center; gap: 6px; padding: 5px 10px;
    border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
  }
  .capp-search input { border: none; background: transparent; outline: none; font-size: 13px; color: inherit; width: 170px; }

  .capp-chips { display: flex; gap: 6px; flex-wrap: wrap; }
  .capp-chip {
    padding: 6px 10px; font-size: 12px; border-radius: 999px; border: 1px solid rgba(127,127,127,0.35);
    background: transparent; color: inherit; opacity: 0.7; cursor: pointer; white-space: nowrap;
  }
  .capp-chip.active { opacity: 1; background: rgba(127,127,127,0.15); font-weight: 600; }

  .capp-sort-select {
    padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
    background: transparent; color: inherit; font-size: 12px;
  }

  .capp-empty-filtered { opacity: 0.7; font-size: 13px; }

  .capp-item { transition: opacity 0.4s ease, transform 0.4s ease; }

  .capp-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: capp-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes capp-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .capp-skeleton-title { height: 15px; width: 160px; margin-bottom: 8px; }
  .capp-skeleton-meta { height: 12px; width: 110px; margin-bottom: 8px; }
  .capp-skeleton-badge { height: 20px; width: 80px; border-radius: 999px; }
  .capp-skeleton-ring { height: 44px; width: 44px; border-radius: 50%; }

  @media (prefers-reduced-motion: reduce) {
    .capp-skeleton, .capp-item { animation: none !important; transition: none !important; }
  }

  @media (max-width: 640px) {
    .capp-toolbar { flex-direction: column; align-items: stretch; }
    .capp-search input { width: 100%; }
  }
`;