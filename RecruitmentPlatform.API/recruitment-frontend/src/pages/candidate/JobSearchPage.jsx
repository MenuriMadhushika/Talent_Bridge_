import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { jobPostingsApi } from "../../api/jobPostings";
import { EmptyState } from "../../components/States";
import MatchRing from "../../components/MatchRing";

function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }) {
    if (!query.trim()) return text;
    const parts = text.split(new RegExp(`(${escapeRegExp(query.trim())})`, "gi"));
    return parts.map((part, i) =>
        part.toLowerCase() === query.trim().toLowerCase() ? (
            <mark className="jsp-mark" key={i}>{part}</mark>
        ) : (
            part
        )
    );
}

function skillsOf(job) {
    return (job.requiredSkills || "").split(",").map((s) => s.trim()).filter(Boolean);
}

// ---- Skeletons ------------------------------------------------------------

function SkeletonPostingList({ count = 5 }) {
    return (
        <div className="list" aria-busy="true" aria-live="polite">
            {Array.from({ length: count }).map((_, i) => (
                <div className="list-item" key={i}>
                    <div style={{ flex: 1 }}>
                        <div className="jsp-skeleton jsp-skeleton-title" />
                        <div className="jsp-skeleton jsp-skeleton-meta" />
                        <div className="row" style={{ marginTop: 8, gap: 6 }}>
                            <div className="jsp-skeleton jsp-skeleton-tag" />
                            <div className="jsp-skeleton jsp-skeleton-tag" />
                        </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <div className="jsp-skeleton jsp-skeleton-meta" style={{ marginLeft: "auto" }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function SkeletonRecommended() {
    return (
        <div className="rec-scroll" aria-busy="true" aria-live="polite">
            {Array.from({ length: 3 }).map((_, i) => (
                <div className="rec-card" key={i}>
                    <div className="jsp-skeleton jsp-skeleton-title" />
                    <div className="jsp-skeleton jsp-skeleton-meta" />
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

const ChevronIcon = ({ direction }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
    </svg>
);

// ---- Main component -----------------------------------------------------

export default function JobSearchPage() {
    const [keyword, setKeyword] = useState("");
    const [appliedKeyword, setAppliedKeyword] = useState("");
    const [postings, setPostings] = useState(null);
    const [recommended, setRecommended] = useState(null);
    const [error, setError] = useState("");
    const [remoteOnly, setRemoteOnly] = useState(false);
    const [sortMode, setSortMode] = useState("relevance"); // "relevance" | "salary" | "applicants"

    const requestId = useRef(0);
    const debounceTimer = useRef(null);
    const recScrollRef = useRef(null);

    async function load(kw) {
        const id = ++requestId.current;
        setError("");
        try {
            const data = await jobPostingsApi.list(kw);
            if (requestId.current !== id) return;
            setPostings(data);
            setAppliedKeyword(kw);
        } catch (err) {
            if (requestId.current !== id) return;
            setError(err.message);
        }
    }

    useEffect(() => {
        setPostings(null);
        load("");
        jobPostingsApi.getRecommended().then(setRecommended).catch(() => setRecommended([]));
        return () => {
            requestId.current += 1;
            clearTimeout(debounceTimer.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleSearch(e) {
        e.preventDefault();
        clearTimeout(debounceTimer.current);
        setPostings(null);
        load(keyword);
    }

    // Live debounced search as the user types, on top of the explicit submit button.
    function handleKeywordChange(value) {
        setKeyword(value);
        clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            setPostings(null);
            load(value);
        }, 350);
    }

    function handleClear() {
        clearTimeout(debounceTimer.current);
        setKeyword("");
        setPostings(null);
        load("");
    }

    function scrollRec(direction) {
        const el = recScrollRef.current;
        if (!el) return;
        el.scrollBy({ left: direction === "left" ? -260 : 260, behavior: "smooth" });
    }

    const visiblePostings = useMemo(() => {
        if (!postings) return [];
        let list = remoteOnly ? postings.filter((j) => j.isRemote) : postings;
        if (sortMode === "salary") {
            list = [...list].sort((a, b) => (b.salaryMax ?? -1) - (a.salaryMax ?? -1));
        } else if (sortMode === "applicants") {
            list = [...list].sort((a, b) => (a.applicationCount ?? 0) - (b.applicationCount ?? 0));
        }
        return list;
    }, [postings, remoteOnly, sortMode]);

    return (
        <div>
            <style>{JSP_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Candidate portal</div>
                    <h1>Find your next role</h1>
                    <p>Search open positions by title or required skill.</p>
                </div>
            </div>

            {recommended === null && <SkeletonRecommended />}
            {recommended && recommended.length > 0 && (
                <div>
                    <div className="rec-heading">
                        <h3 style={{ margin: 0 }}>Recommended for you</h3>
                        <span className="badge badge-teal">AI matched</span>
                    </div>
                    <div className="jsp-rec-wrap">
                        <button type="button" className="jsp-rec-nav left" onClick={() => scrollRec("left")} aria-label="Scroll recommended left">
                            <ChevronIcon direction="left" />
                        </button>
                        <div className="rec-scroll" ref={recScrollRef}>
                            {recommended.map((job) => (
                                <Link key={job.id} to={`/jobs/${job.id}`} className="rec-card">
                                    <div className="row-between" style={{ alignItems: "flex-start" }}>
                                        <div>
                                            <div className="title">{job.title}</div>
                                            <div className="meta">{job.departmentName} · {job.location || "Remote"}</div>
                                        </div>
                                        <MatchRing score={job.matchScore} size={34} />
                                    </div>
                                    <div>
                                        {skillsOf(job).slice(0, 3).map((s) => (
                                            <span className="tag" key={s}>{s}</span>
                                        ))}
                                    </div>
                                </Link>
                            ))}
                        </div>
                        <button type="button" className="jsp-rec-nav right" onClick={() => scrollRec("right")} aria-label="Scroll recommended right">
                            <ChevronIcon direction="right" />
                        </button>
                    </div>
                </div>
            )}

            <form onSubmit={handleSearch} className="row" style={{ marginBottom: 14 }}>
                <div className="jsp-search-field">
                    <SearchIcon />
                    <input
                        style={{ flex: 1, minWidth: 220, border: "none", background: "transparent", outline: "none" }}
                        placeholder="Search by title or skill, e.g. “React” or “Data Analyst”"
                        value={keyword}
                        onChange={(e) => handleKeywordChange(e.target.value)}
                    />
                    {keyword && (
                        <button type="button" className="jsp-clear-btn" onClick={handleClear} aria-label="Clear search">
                            ×
                        </button>
                    )}
                </div>
                <button className="btn btn-primary" type="submit">Search</button>
            </form>

            <div className="jsp-filters">
                <label className="jsp-checkbox">
                    <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} />
                    Remote only
                </label>
                <select className="jsp-sort-select" value={sortMode} onChange={(e) => setSortMode(e.target.value)} aria-label="Sort results">
                    <option value="relevance">Sort: Relevance</option>
                    <option value="salary">Sort: Highest salary</option>
                    <option value="applicants">Sort: Fewest applicants</option>
                </select>
                {postings && (
                    <span className="jsp-count">
                        {visiblePostings.length} open role{visiblePostings.length === 1 ? "" : "s"}
                    </span>
                )}
            </div>

            {error && (
                <div className="form-error jsp-error" role="alert">
                    {error}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(appliedKeyword)}>
                        Retry
                    </button>
                </div>
            )}

            {!postings && !error && <SkeletonPostingList />}

            {postings && postings.length === 0 && (
                <EmptyState
                    title={appliedKeyword ? `No postings match “${appliedKeyword}”` : "No matching postings"}
                    body={appliedKeyword ? "Try a broader keyword, or clear your search." : "Check back soon — new roles open regularly."}
                />
            )}

            {postings && postings.length > 0 && visiblePostings.length === 0 && (
                <p className="jsp-empty-filtered">No remote roles match this search right now.</p>
            )}

            <div className="list">
                {visiblePostings.map((job) => (
                    <Link key={job.id} to={`/jobs/${job.id}`} className="list-item" style={{ textDecoration: "none", color: "inherit" }}>
                        <div>
                            <div className="title"><Highlight text={job.title} query={appliedKeyword} /></div>
                            <div className="meta">
                                {job.departmentName} · {job.location || "Remote"} {job.isRemote && "· Remote"}
                            </div>
                            <div style={{ marginTop: 8 }}>
                                {skillsOf(job).slice(0, 5).map((s) => (
                                    <span className="tag" key={s}><Highlight text={s} query={appliedKeyword} /></span>
                                ))}
                            </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            {job.salaryMin != null && job.salaryMax != null && (
                                <div className="meta">${job.salaryMin.toLocaleString()} – ${job.salaryMax.toLocaleString()}</div>
                            )}
                            <div className="meta">{job.applicationCount} applicant{job.applicationCount === 1 ? "" : "s"}</div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const JSP_STYLES = `
  .jsp-search-field {
    flex: 1; min-width: 220px; display: flex; align-items: center; gap: 8px;
    padding: 0 12px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
  }
  .jsp-clear-btn { background: none; border: none; font-size: 18px; line-height: 1; cursor: pointer; color: inherit; opacity: 0.6; }
  .jsp-clear-btn:hover { opacity: 1; }

  .jsp-filters { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; font-size: 13px; }
  .jsp-checkbox { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
  .jsp-sort-select { padding: 6px 10px; border-radius: 8px; border: 1px solid rgba(127,127,127,0.35); background: transparent; color: inherit; }
  .jsp-count { opacity: 0.65; margin-left: auto; }

  .jsp-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .jsp-empty-filtered { opacity: 0.7; font-size: 13px; }

  .jsp-mark { background: rgba(201, 162, 39, 0.35); color: inherit; border-radius: 3px; padding: 0 1px; }

  .jsp-rec-wrap { position: relative; }
  .jsp-rec-nav {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 1;
    width: 28px; height: 28px; border-radius: 50%; border: 1px solid rgba(127,127,127,0.35);
    background: var(--bg, #fff); color: inherit; display: flex; align-items: center; justify-content: center;
    cursor: pointer; opacity: 0.85;
  }
  .jsp-rec-nav:hover { opacity: 1; }
  .jsp-rec-nav.left { left: -8px; }
  .jsp-rec-nav.right { right: -8px; }

  .jsp-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: jsp-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes jsp-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .jsp-skeleton-title { height: 15px; width: 60%; margin-bottom: 8px; }
  .jsp-skeleton-meta { height: 12px; width: 45%; }
  .jsp-skeleton-tag { height: 20px; width: 70px; border-radius: 999px; }

  @media (prefers-reduced-motion: reduce) {
    .jsp-skeleton { animation: none !important; }
  }

  @media (max-width: 640px) {
    .jsp-filters { gap: 10px; }
    .jsp-count { margin-left: 0; flex-basis: 100%; }
  }
`;