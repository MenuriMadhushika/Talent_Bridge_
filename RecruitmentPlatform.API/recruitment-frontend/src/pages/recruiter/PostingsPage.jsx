import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { jobPostingsApi } from "../../api/jobPostings";
import { LoadingState, EmptyState } from "../../components/States";
import { PostingStatusBadge } from "../../components/StatusBadge";

export default function PostingsPage() {
    const [keyword, setKeyword] = useState("");
    const [postings, setPostings] = useState(null);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const requestId = useRef(0);
    const hasLoadedOnce = useRef(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    async function load(kw) {
        const reqId = ++requestId.current;
        const isFirstLoad = !hasLoadedOnce.current;

        if (isFirstLoad) setPostings(null); // full loading state only when there's nothing to show yet
        setError("");

        try {
            const data = await jobPostingsApi.list(kw);
            if (requestId.current !== reqId) return; // a newer load already superseded this one
            setPostings(data);
            hasLoadedOnce.current = true;
        } catch (err) {
            if (requestId.current !== reqId) return;
            setError(err.message);
        }
    }

    useEffect(() => {
        load("");
        return () => {
            requestId.current += 1;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleClose(id) {
        if (!confirm("Close this posting? Candidates will no longer be able to apply.")) return;
        setBusyId(id);
        setError("");
        try {
            await jobPostingsApi.close(id);
            if (!mounted.current) return;
            await load(keyword); // list already has data, so this refreshes in place — no blank flash
        } catch (err) {
            if (!mounted.current) return;
            // Closing a posting you don't own returns 403 — surface it, don't crash the list.
            setError(err.message);
        } finally {
            if (mounted.current) setBusyId(null);
        }
    }

    return (
        <div>
            <div className="page-head">
                <div>
                    <div className="eyebrow">Recruiter portal</div>
                    <h1>Job postings</h1>
                    <p>Open roles across the organization. Review applications or close a posting you own.</p>
                </div>
                <Link to="/recruiter/postings/new" className="btn btn-primary">New posting</Link>
            </div>

            <form
                onSubmit={(e) => { e.preventDefault(); load(keyword); }}
                className="row"
                style={{ marginBottom: 22 }}
            >
                <input
                    style={{ flex: 1, minWidth: 220 }}
                    placeholder="Filter by title or skill…"
                    value={keyword}
                    onChange={(e) => setKeyword(e.target.value)}
                />
                <button className="btn btn-secondary" type="submit">Filter</button>
            </form>

            {error && <div className="form-error" role="alert">{error}</div>}
            {!postings && !error && <LoadingState text="Loading postings…" />}
            {postings && postings.length === 0 && (
                <EmptyState
                    title="No open postings"
                    body="Create your first posting to start receiving applications."
                    action={<Link to="/recruiter/postings/new" className="btn btn-primary" style={{ marginTop: 12 }}>New posting</Link>}
                />
            )}

            <div className="list">
                {postings?.map((job) => {
                    const applicationCount = job.applicationCount ?? 0;
                    return (
                        <div className="list-item" key={job.id}>
                            <div>
                                <div className="title">{job.title}</div>
                                <div className="meta">{job.departmentName} · {applicationCount} applicant{applicationCount === 1 ? "" : "s"}</div>
                                <div style={{ marginTop: 8 }}><PostingStatusBadge status={job.status} /></div>
                            </div>
                            <div className="row">
                                <Link to={`/recruiter/postings/${job.id}/applications`} className="btn btn-secondary btn-sm">Review applications</Link>
                                {job.status === "Open" && (
                                    <button className="btn btn-danger btn-sm" disabled={busyId === job.id} onClick={() => handleClose(job.id)}>
                                        {busyId === job.id ? "Closing…" : "Close"}
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}