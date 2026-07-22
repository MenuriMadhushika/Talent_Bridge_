import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { candidateProfilesApi } from "../../api/candidateProfiles";
import { LoadingState, EmptyState } from "../../components/States";

function parseSkills(skills) {
    if (!skills) return [];
    return skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

const RefreshIcon = ({ spinning }) => (
    <svg
        className={spinning ? "csp-spin" : ""}
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
    </svg>
);

export default function CandidateSearchPage() {
    const [filters, setFilters] = useState({ keyword: "", minYearsOfExperience: "", location: "" });
    const [candidates, setCandidates] = useState(null);
    const [error, setError] = useState("");
    const [searching, setSearching] = useState(false);
    const requestId = useRef(0);
    const hasResultsYet = useRef(false);

    async function load(params) {
        const reqId = ++requestId.current;
        const isFirstLoad = !hasResultsYet.current;

        if (isFirstLoad) setCandidates(null); // full loading state, nothing to show yet
        setSearching(true);
        setError("");

        try {
            const data = await candidateProfilesApi.search(params);
            if (requestId.current !== reqId) return; // a newer search already superseded this one
            setCandidates(data);
            hasResultsYet.current = true;
        } catch (err) {
            if (requestId.current !== reqId) return;
            setError(err.message);
        } finally {
            if (requestId.current === reqId) setSearching(false);
        }
    }

    useEffect(() => {
        load({});
        return () => {
            requestId.current += 1; // invalidate in-flight request on unmount
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function handleSearch(e) {
        e.preventDefault();
        load({
            ...filters,
            keyword: filters.keyword.trim(),
            location: filters.location.trim(),
        });
    }

    return (
        <div>
            <style>{CSP_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Recruiter portal</div>
                    <h1>Candidate search</h1>
                    <p>Search the candidate pool by skill, experience, or location.</p>
                </div>
            </div>

            <form onSubmit={handleSearch} className="row" style={{ marginBottom: 22, flexWrap: "wrap" }}>
                <input
                    style={{ flex: 2, minWidth: 200 }}
                    placeholder="Skill or headline keyword…"
                    value={filters.keyword}
                    onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                />
                <input
                    style={{ flex: 1, minWidth: 140 }}
                    type="number"
                    min="0"
                    placeholder="Min years experience"
                    value={filters.minYearsOfExperience}
                    onChange={(e) => setFilters({ ...filters, minYearsOfExperience: e.target.value })}
                />
                <input
                    style={{ flex: 1, minWidth: 140 }}
                    placeholder="Location"
                    value={filters.location}
                    onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                />
                <button className="btn btn-primary" type="submit" disabled={searching}>
                    {searching && <RefreshIcon spinning />} {searching ? "Searching…" : "Search"}
                </button>
            </form>

            {error && <div className="form-error">{error}</div>}
            {!candidates && !error && <LoadingState text="Searching candidates…" />}
            {candidates && candidates.length === 0 && !error && (
                <EmptyState title="No candidates match these filters" body="Broaden your search — try fewer filters or a different keyword." />
            )}

            <div className="list">
                {candidates?.map((c) => {
                    const skills = parseSkills(c.skills);
                    const resumeCount = c.resumeCount ?? 0;
                    return (
                        <Link key={c.id} to={`/recruiter/candidates/${c.id}`} className="list-item" style={{ textDecoration: "none", color: "inherit" }}>
                            <div>
                                <div className="title">{c.fullName}</div>
                                <div className="meta">{c.headline || "No headline yet"} · {c.location || "Location not set"}</div>
                                <div style={{ marginTop: 8 }}>
                                    {skills.slice(0, 6).map((s, i) => (
                                        <span className="tag" key={`${s}-${i}`}>{s}</span>
                                    ))}
                                </div>
                            </div>
                            <div style={{ textAlign: "right" }}>
                                <div className="meta">{c.yearsOfExperience ?? 0} yrs experience</div>
                                <div className="meta">{resumeCount} resume{resumeCount === 1 ? "" : "s"}</div>
                            </div>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

const CSP_STYLES = `
  .csp-spin { animation: csp-spin 0.8s linear infinite; display: inline-block; }
  @keyframes csp-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .csp-spin { animation: none !important; }
  }
`;