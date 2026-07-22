import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { candidateProfilesApi } from "../../api/candidateProfiles";
import { LoadingState } from "../../components/States";

function parseSkills(skills) {
    if (!skills) return [];
    return skills
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
}

const RefreshIcon = ({ spinning }) => (
    <svg
        className={spinning ? "cdp-spin" : ""}
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
    </svg>
);

export default function CandidateDetailPage() {
    const { candidateId: id } = useParams();
    const [candidate, setCandidate] = useState(null);
    const [error, setError] = useState("");
    const [retrying, setRetrying] = useState(false);
    const requestId = useRef(0);

    const load = (isRetry = false) => {
        const reqId = ++requestId.current;
        if (isRetry) setRetrying(true);
        candidateProfilesApi
            .getById(id)
            .then((res) => {
                if (requestId.current !== reqId) return;
                setCandidate(res);
                setError("");
            })
            .catch((err) => {
                if (requestId.current !== reqId) return;
                setError(err.message);
            })
            .finally(() => {
                if (requestId.current !== reqId) return;
                if (isRetry) setRetrying(false);
            });
    };

    useEffect(() => {
        // Reset immediately so a fast navigation between candidates never
        // flashes the previous candidate's data while the new one loads.
        setCandidate(null);
        setError("");
        load(false);
        return () => {
            requestId.current += 1; // invalidate in-flight request if id changes/unmounts
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        if (candidate?.fullName) {
            document.title = `${candidate.fullName} · Candidate profile`;
        }
        return () => {
            document.title = "Recruiting";
        };
    }, [candidate]);

    if (!candidate && !error) return <LoadingState text="Loading candidate profile…" />;

    if (error && !candidate) {
        return (
            <div>
                <Link to="/recruiter/candidates" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
                    ← Candidate search
                </Link>
                <div className="cdp-error-panel">
                    <div className="form-error">{error}</div>
                    <button type="button" className="btn btn-sm" onClick={() => load(true)} disabled={retrying}>
                        <RefreshIcon spinning={retrying} /> {retrying ? "Retrying…" : "Try again"}
                    </button>
                </div>
            </div>
        );
    }

    const skills = parseSkills(candidate.skills);
    const applicationCount = candidate.applicationCount ?? 0;
    const resumeCount = candidate.resumeCount ?? 0;

    return (
        <div>
            <style>{CDP_STYLES}</style>

            <Link to="/recruiter/candidates" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← Candidate search</Link>

            <div className="card">
                <h1 style={{ marginBottom: 4 }}>{candidate.fullName}</h1>
                <p style={{ margin: 0 }}>{candidate.headline || "No headline set"} · {candidate.location || "Location not set"}</p>
                <div className="row" style={{ marginTop: 14 }}>
                    <span className="tag">{candidate.yearsOfExperience ?? 0} yrs experience</span>
                    <span className="tag">{applicationCount} application{applicationCount === 1 ? "" : "s"}</span>
                    <span className="tag">{resumeCount} resume{resumeCount === 1 ? "" : "s"}</span>
                </div>

                {candidate.summary && (
                    <>
                        <hr className="divider" />
                        <h3>Summary</h3>
                        <p style={{ whiteSpace: "pre-wrap" }}>{candidate.summary}</p>
                    </>
                )}

                <hr className="divider" />
                <h3>Skills</h3>
                {skills.length === 0 ? (
                    <p className="cdp-empty">No skills listed yet.</p>
                ) : (
                    <div>
                        {skills.map((s, i) => (
                            <span className="tag" key={`${s}-${i}`}>{s}</span>
                        ))}
                    </div>
                )}

                {candidate.education && (
                    <>
                        <hr className="divider" />
                        <h3>Education</h3>
                        <p>{candidate.education}</p>
                    </>
                )}
            </div>
        </div>
    );
}

const CDP_STYLES = `
  .cdp-error-panel { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
  .cdp-empty { opacity: 0.7; font-size: 13px; }
  .cdp-spin { animation: cdp-spin 0.8s linear infinite; }
  @keyframes cdp-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .cdp-spin { animation: none !important; }
  }
`;