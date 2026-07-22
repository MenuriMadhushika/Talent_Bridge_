import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "../../api/admin";

function splitWords(value = "") {
    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2");
}

function formatUpdatedAt(date) {
    if (!date) return "";
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function csvEscape(value) {
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function toCsv(rows) {
    const header = "Stage,Count,Share";
    const total = rows.reduce((sum, [, count]) => sum + count, 0) || 1;
    const lines = rows.map(([label, count]) => {
        const share = ((count / total) * 100).toFixed(1);
        return `${csvEscape(splitWords(label))},${count},${share}%`;
    });
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

function exportFilename() {
    const d = new Date();
    const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
    ).padStart(2, "0")}`;
    return `pipeline-stages-${stamp}.csv`;
}

// ---- Reduced-motion (live-updating, not a frozen module constant) -----
function useReducedMotion() {
    const [reduced, setReduced] = useState(() =>
        typeof window !== "undefined" && window.matchMedia
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : false
    );

    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;
        const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
        const handler = (e) => setReduced(e.matches);
        if (mql.addEventListener) mql.addEventListener("change", handler);
        else mql.addListener(handler);
        return () => {
            if (mql.removeEventListener) mql.removeEventListener("change", handler);
            else mql.removeListener(handler);
        };
    }, []);

    return reduced;
}

// ---- Skeletons -------------------------------------------------------

function SkeletonStatGrid({ count = 6 }) {
    return (
        <div className="stat-grid">
            {Array.from({ length: count }).map((_, i) => (
                <div className="stat-card adm-skeleton-card" key={i}>
                    <div className="adm-skeleton adm-skeleton-value" />
                    <div className="adm-skeleton adm-skeleton-label" />
                </div>
            ))}
        </div>
    );
}

function SkeletonDashboard() {
    return (
        <div aria-busy="true" aria-live="polite">
            <div className="page-head">
                <div>
                    <div className="eyebrow">Administration portal</div>
                    <h1>Recruitment analytics</h1>
                    <p>A platform-wide view of people, postings, and pipeline health.</p>
                </div>
            </div>
            <SkeletonStatGrid />
            <SkeletonStatGrid />
            <div className="card">
                <div className="adm-skeleton adm-skeleton-title" />
                {Array.from({ length: 4 }).map((_, i) => (
                    <div className="bar-row" key={i}>
                        <div className="adm-skeleton adm-skeleton-barlabel" />
                        <div className="bar-track"><div className="adm-skeleton adm-skeleton-barfill" /></div>
                        <div className="adm-skeleton adm-skeleton-barcount" />
                    </div>
                ))}
            </div>
        </div>
    );
}

// ---- Small icons (inline, no deps) -----------------------------------

const RefreshIcon = ({ spinning }) => (
    <svg
        className={spinning ? "adm-spin" : ""}
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
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

const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
    </svg>
);

// ---- Postings composition bar -----------------------------------------

function PostingsComposition({ open, draft, closed }) {
    const total = open + draft + closed || 1;
    const segments = [
        { key: "open", value: open, className: "adm-seg-open", label: "Open" },
        { key: "draft", value: draft, className: "adm-seg-draft", label: "Draft" },
        { key: "closed", value: closed, className: "adm-seg-closed", label: "Closed" },
    ];
    return (
        <div className="adm-composition">
            <div className="adm-composition-track" role="img" aria-label={`${open} open, ${draft} draft, ${closed} closed postings`}>
                {segments.map((seg) => (
                    seg.value > 0 && (
                        <div
                            key={seg.key}
                            className={`adm-composition-seg ${seg.className}`}
                            style={{ width: `${(seg.value / total) * 100}%` }}
                            title={`${seg.label}: ${seg.value}`}
                        />
                    )
                ))}
            </div>
            <div className="adm-composition-legend">
                {segments.map((seg) => (
                    <span className="adm-legend-item" key={seg.key}>
                        <span className={`adm-legend-dot ${seg.className}`} />
                        {seg.label} <strong>{seg.value}</strong>
                    </span>
                ))}
            </div>
        </div>
    );
}

// ---- Hiring trend (monthly postings / applications / hires) -----------

function monthLabel(month) {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

function HiringTrendChart() {
    const [trend, setTrend] = useState(null);
    const [trendError, setTrendError] = useState("");

    useEffect(() => {
        let cancelled = false;
        adminApi
            .getHiringTrends(6)
            .then((res) => {
                if (!cancelled) setTrend(res);
            })
            .catch((err) => {
                if (!cancelled) setTrendError(err.message);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    if (trendError) {
        return <p className="adm-empty">Couldn't load hiring trends ({trendError}).</p>;
    }

    if (!trend) {
        return (
            <div>
                {Array.from({ length: 3 }).map((_, i) => (
                    <div className="bar-row" key={i}>
                        <div className="adm-skeleton adm-skeleton-barlabel" />
                        <div className="bar-track">
                            <div className="adm-skeleton adm-skeleton-barfill" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    const maxValue = Math.max(
        1,
        ...trend.points.flatMap((p) => [p.postingsOpened, p.applicationsReceived, p.hires])
    );

    return (
        <div className="adm-trend">
            <div className="adm-trend-legend">
                <span className="adm-legend-item">
                    <span className="adm-legend-dot adm-seg-open" /> Postings opened
                </span>
                <span className="adm-legend-item">
                    <span className="adm-legend-dot" style={{ background: "#3b6fa0" }} /> Applications
                </span>
                <span className="adm-legend-item">
                    <span className="adm-legend-dot adm-seg-draft" /> Hires
                </span>
            </div>
            {trend.points.every((p) => p.postingsOpened + p.applicationsReceived + p.hires === 0) && (
                <p className="adm-empty">No activity in the selected window yet.</p>
            )}
            {trend.points.map((p) => (
                <div className="adm-trend-row" key={p.month}>
                    <div className="adm-trend-month">{monthLabel(p.month)}</div>
                    <div className="adm-trend-bars">
                        <div className="adm-trend-bar" title={`Postings opened: ${p.postingsOpened}`}>
                            <div
                                className="adm-trend-fill"
                                style={{ width: `${(p.postingsOpened / maxValue) * 100}%`, background: "#4f9d69" }}
                            />
                        </div>
                        <div className="adm-trend-bar" title={`Applications received: ${p.applicationsReceived}`}>
                            <div
                                className="adm-trend-fill"
                                style={{ width: `${(p.applicationsReceived / maxValue) * 100}%`, background: "#3b6fa0" }}
                            />
                        </div>
                        <div className="adm-trend-bar" title={`Hires: ${p.hires}`}>
                            <div
                                className="adm-trend-fill"
                                style={{ width: `${(p.hires / maxValue) * 100}%`, background: "#c9a227" }}
                            />
                        </div>
                    </div>
                    <div className="adm-trend-counts">
                        {p.postingsOpened} / {p.applicationsReceived} / {p.hires}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---- Main component -----------------------------------------------------

export default function AdminDashboardPage() {
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [refreshing, setRefreshing] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [search, setSearch] = useState("");
    const [sortMode, setSortMode] = useState("count"); // "count" | "alpha"
    const [expanded, setExpanded] = useState(null);
    const [barsReady, setBarsReady] = useState(false);
    const requestId = useRef(0);
    const reduceMotion = useReducedMotion();

    const load = (isManualRefresh = false) => {
        const id = ++requestId.current;
        if (isManualRefresh) setRefreshing(true);
        adminApi
            .getAnalytics()
            .then((res) => {
                if (requestId.current !== id) return;
                setData(res);
                setError("");
                setLastUpdated(new Date());
            })
            .catch((err) => {
                if (requestId.current !== id) return;
                setError(err.message);
            })
            .finally(() => {
                if (requestId.current !== id) return;
                if (isManualRefresh) setRefreshing(false);
            });
    };

    useEffect(() => {
        load(false);
        return () => {
            requestId.current += 1;
        };
    }, []);

    useEffect(() => {
        if (!data) return;
        setBarsReady(false);
        const t = setTimeout(() => setBarsReady(true), reduceMotion ? 0 : 40);
        return () => clearTimeout(t);
    }, [data, reduceMotion]);

    const statusEntries = useMemo(() => Object.entries(data?.applicationsByStatus || {}), [data]);
    const totalApplications = useMemo(
        () => statusEntries.reduce((sum, [, v]) => sum + v, 0),
        [statusEntries]
    );
    const maxStatusCount = Math.max(1, ...statusEntries.map(([, v]) => v));

    const visibleEntries = useMemo(() => {
        let entries = statusEntries;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            entries = entries.filter(([label]) => splitWords(label).toLowerCase().includes(q));
        }
        entries = [...entries].sort((a, b) =>
            sortMode === "alpha" ? splitWords(a[0]).localeCompare(splitWords(b[0])) : b[1] - a[1]
        );
        return entries;
    }, [statusEntries, search, sortMode]);

    const conversionRate =
        data && data.totalCandidates > 0
            ? ((data.totalHires / data.totalCandidates) * 100).toFixed(1)
            : null;

    const matchScoreLabel =
        data && typeof data.averageMatchScore === "number" ? `${data.averageMatchScore}%` : "—";

    if (!data && !error) return <SkeletonDashboard />;
    if (error && !data) {
        return (
            <div role="alert" className="adm-error-panel">
                <div className="form-error">{error}</div>
                <button type="button" className="adm-btn adm-btn-primary" onClick={() => load(true)}>
                    <RefreshIcon spinning={refreshing} /> Try again
                </button>
            </div>
        );
    }

    return (
        <div>
            <style>{ADM_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Administration portal</div>
                    <h1>Recruitment analytics</h1>
                    <p>A platform-wide view of people, postings, and pipeline health.</p>
                </div>
                <div className="adm-toolbar">
                    {lastUpdated && (
                        <span className="adm-updated" aria-live="polite">
                            Updated {formatUpdatedAt(lastUpdated)}
                        </span>
                    )}
                    <button
                        type="button"
                        className="adm-btn"
                        onClick={() => load(true)}
                        disabled={refreshing}
                        aria-label="Refresh analytics"
                    >
                        <RefreshIcon spinning={refreshing} /> {refreshing ? "Refreshing…" : "Refresh"}
                    </button>
                </div>
            </div>

            {error && data && (
                <div className="adm-inline-error" role="alert">
                    Couldn't refresh just now ({error}). Showing last known data from {formatUpdatedAt(lastUpdated)}.
                </div>
            )}

            <div className="stat-grid">
                <div className="stat-card accent"><div className="stat-value">{data.totalCandidates}</div><div className="stat-label">Candidates</div></div>
                <div className="stat-card"><div className="stat-value">{data.totalRecruiters}</div><div className="stat-label">Recruiters</div></div>
                <div className="stat-card"><div className="stat-value">{data.totalHiringManagers}</div><div className="stat-label">Hiring managers</div></div>
                <div className="stat-card"><div className="stat-value">{data.totalAdmins}</div><div className="stat-label">Admins</div></div>
                <div className="stat-card"><div className="stat-value">{data.totalOrganizations}</div><div className="stat-label">Organizations</div></div>
                <div className="stat-card"><div className="stat-value">{data.totalDepartments}</div><div className="stat-label">Departments</div></div>
            </div>

            <div className="stat-grid">
                <div className="stat-card"><div className="stat-value">{data.openPostings}</div><div className="stat-label">Open postings</div></div>
                <div className="stat-card"><div className="stat-value">{data.draftPostings}</div><div className="stat-label">Draft postings</div></div>
                <div className="stat-card"><div className="stat-value">{data.closedPostings}</div><div className="stat-label">Closed postings</div></div>
                <div className="stat-card"><div className="stat-value">{data.interviewsScheduled}</div><div className="stat-label">Interviews scheduled</div></div>
                <div className="stat-card gold"><div className="stat-value">{data.totalHires}</div><div className="stat-label">Total hires</div></div>
                <div className="stat-card accent"><div className="stat-value">{matchScoreLabel}</div><div className="stat-label">Avg. AI match score</div></div>
            </div>

            <div className="card">
                <h3>Postings composition</h3>
                <PostingsComposition open={data.openPostings} draft={data.draftPostings} closed={data.closedPostings} />
                {conversionRate !== null && (
                    <p className="adm-footnote">
                        <strong>{conversionRate}%</strong> of candidates have converted to a hire
                        ({data.totalHires} of {data.totalCandidates}).
                    </p>
                )}
            </div>

            <div className="card">
                <h3>Hiring trend (last 6 months)</h3>
                <HiringTrendChart />
            </div>

            <div className="card">
                <div className="adm-card-head">
                    <h3>Applications by pipeline stage</h3>
                    <div className="adm-card-controls">
                        <div className="adm-search">
                            <SearchIcon />
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Filter stages…"
                                aria-label="Filter pipeline stages"
                            />
                        </div>
                        <div className="adm-sort" role="group" aria-label="Sort stages">
                            <button
                                type="button"
                                className={`adm-chip ${sortMode === "count" ? "active" : ""}`}
                                onClick={() => setSortMode("count")}
                            >
                                By volume
                            </button>
                            <button
                                type="button"
                                className={`adm-chip ${sortMode === "alpha" ? "active" : ""}`}
                                onClick={() => setSortMode("alpha")}
                            >
                                A–Z
                            </button>
                        </div>
                        <button
                            type="button"
                            className="adm-btn"
                            onClick={() => downloadCsv(exportFilename(), toCsv(statusEntries))}
                            disabled={statusEntries.length === 0}
                        >
                            <DownloadIcon /> Export
                        </button>
                    </div>
                </div>

                {statusEntries.length === 0 && <p>No applications submitted yet.</p>}
                {statusEntries.length > 0 && visibleEntries.length === 0 && (
                    <p className="adm-empty">No stages match "{search}".</p>
                )}

                {visibleEntries.map(([label, count], index) => {
                    const pct = totalApplications ? ((count / totalApplications) * 100).toFixed(1) : "0.0";
                    const isOpen = expanded === label;
                    return (
                        <div
                            className={`bar-row adm-bar-row ${isOpen ? "adm-bar-row-open" : ""}`}
                            key={label}
                            onClick={() => setExpanded(isOpen ? null : label)}
                            role="button"
                            tabIndex={0}
                            aria-expanded={isOpen}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setExpanded(isOpen ? null : label);
                                } else if (e.key === "Escape" && isOpen) {
                                    setExpanded(null);
                                }
                            }}
                        >
                            <div className="bar-label">{splitWords(label)}</div>
                            <div className="bar-track">
                                <div
                                    className="bar-fill adm-bar-fill"
                                    style={{
                                        width: barsReady ? `${(count / maxStatusCount) * 100}%` : "0%",
                                        transitionDelay: reduceMotion ? "0ms" : `${index * 45}ms`,
                                    }}
                                />
                            </div>
                            <div className="bar-count">{count}</div>
                            {isOpen && (
                                <div className="adm-bar-detail">
                                    {count} of {totalApplications} applications ({pct}%)
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const ADM_STYLES = `
  .page-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
  .adm-toolbar { display: flex; align-items: center; gap: 10px; }
  .adm-updated { font-size: 12px; opacity: 0.65; }

  .adm-btn {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 7px 12px; border-radius: 8px; border: 1px solid currentColor;
    background: transparent; color: inherit; opacity: 0.85; cursor: pointer;
    font-size: 13px; line-height: 1; transition: opacity 0.15s ease, transform 0.1s ease;
  }
  .adm-btn:hover:not(:disabled) { opacity: 1; }
  .adm-btn:active:not(:disabled) { transform: scale(0.97); }
  .adm-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .adm-btn:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .adm-btn-primary { background: currentColor; }
  .adm-btn-primary > * { color: Canvas; }

  .adm-spin { animation: adm-spin 0.8s linear infinite; }
  @keyframes adm-spin { to { transform: rotate(360deg); } }

  .adm-inline-error {
    font-size: 13px; padding: 8px 12px; border-radius: 8px;
    border: 1px solid rgba(200, 60, 60, 0.35); background: rgba(200, 60, 60, 0.08);
    margin: 8px 0 16px;
  }

  .adm-error-panel { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }

  .adm-composition { display: flex; flex-direction: column; gap: 10px; }
  .adm-composition-track {
    display: flex; width: 100%; height: 14px; border-radius: var(--radius-full, 999px); overflow: hidden;
    background: rgba(127,127,127,0.15);
  }
  .adm-composition-seg { height: 100%; transition: width 0.6s ease-out; }
  .adm-seg-open { background: #4f9d69; }
  .adm-seg-draft { background: #c9a227; }
  .adm-seg-closed { background: #9a9a9a; }
  .adm-composition-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 13px; opacity: 0.85; }
  .adm-legend-item { display: inline-flex; align-items: center; gap: 6px; }
  .adm-legend-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .adm-footnote { margin-top: 12px; font-size: 13px; opacity: 0.75; }

  .adm-trend { display: flex; flex-direction: column; gap: 10px; }
  .adm-trend-legend { display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; opacity: 0.8; margin-bottom: 4px; }
  .adm-trend-row { display: grid; grid-template-columns: 56px 1fr 90px; align-items: center; gap: 10px; }
  .adm-trend-month { font-size: 12px; opacity: 0.8; }
  .adm-trend-bars { display: flex; flex-direction: column; gap: 3px; }
  .adm-trend-bar { height: 6px; border-radius: var(--radius-full, 999px); background: rgba(127,127,127,0.12); overflow: hidden; }
  .adm-trend-fill { height: 100%; border-radius: var(--radius-full, 999px); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
  .adm-trend-counts { font-size: 11px; opacity: 0.7; text-align: right; white-space: nowrap; }

  .adm-card-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 12px; }
  .adm-card-controls { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  .adm-search {
    display: flex; align-items: center; gap: 6px; padding: 5px 10px;
    border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
  }
  .adm-search input { border: none; background: transparent; outline: none; font-size: 13px; color: inherit; width: 140px; }

  .adm-sort { display: inline-flex; border-radius: 8px; overflow: hidden; border: 1px solid rgba(127,127,127,0.35); }
  .adm-chip { padding: 6px 10px; font-size: 12px; border: none; background: transparent; color: inherit; opacity: 0.6; cursor: pointer; }
  .adm-chip.active { opacity: 1; background: rgba(127,127,127,0.15); font-weight: 600; }

  .adm-bar-row { cursor: pointer; border-radius: 8px; padding: 4px 6px; margin: 0 -6px; transition: background 0.15s ease; flex-wrap: wrap; }
  .adm-bar-row:hover { background: rgba(127,127,127,0.08); }
  .adm-bar-row:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .adm-bar-row-open { background: rgba(127,127,127,0.1); }
  .adm-bar-fill { transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
  .adm-bar-detail { flex-basis: 100%; font-size: 12px; opacity: 0.7; padding: 4px 2px 6px; }
  .adm-empty { opacity: 0.7; font-size: 13px; }

  .adm-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: adm-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes adm-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .adm-skeleton-value { height: 22px; width: 50%; margin-bottom: 8px; }
  .adm-skeleton-label { height: 12px; width: 70%; }
  .adm-skeleton-title { height: 16px; width: 220px; margin-bottom: 14px; }
  .adm-skeleton-barlabel { height: 12px; width: 90px; }
  .adm-skeleton-barfill { height: 100%; width: 60%; }
  .adm-skeleton-barcount { height: 12px; width: 24px; }

  @media (prefers-reduced-motion: reduce) {
    .adm-spin, .adm-skeleton, .adm-composition-seg, .adm-bar-fill { animation: none !important; transition: none !important; }
  }

  @media (max-width: 640px) {
    .adm-card-head { flex-direction: column; align-items: stretch; }
    .adm-search input { width: 100%; }
    .adm-toolbar { width: 100%; justify-content: space-between; }
  }
`;