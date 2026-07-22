import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { applicationsApi } from "../../api/applications";
import { interviewsApi } from "../../api/interviews";
import { evaluationsApi } from "../../api/evaluations";
import { messagesApi } from "../../api/messages";
import { useAuth } from "../../context/AuthContext";
import { LoadingState, EmptyState } from "../../components/States";
import { ApplicationStatusBadge } from "../../components/StatusBadge";
import MatchRing from "../../components/MatchRing";

const STATUS_OPTIONS = [
    "Submitted", "UnderReview", "Shortlisted", "InterviewScheduled",
    "Interviewed", "Offered", "Rejected", "Withdrawn", "Hired",
];

const blankSchedule = { scheduledAt: "", durationMinutes: 30, location: "" };
const blankEvaluation = { technicalScore: 70, communicationScore: 70, cultureFitScore: 70, comments: "", recommended: true };

function clampScore(value, fallback) {
    const n = Number(value);
    if (Number.isNaN(n)) return fallback;
    return Math.min(100, Math.max(0, n));
}

export default function ApplicationDetailPage() {
    const { applicationId: id } = useParams();
    const { user } = useAuth();
    const isCandidate = user?.role === "Candidate";
    const backTo = isCandidate
        ? "/applications"
        : user?.role === "HiringManager" ? "/hiring-manager/review-queue" : "/recruiter/postings";

    const [application, setApplication] = useState(null);
    const [interviews, setInterviews] = useState(null);
    const [evaluations, setEvaluations] = useState(null);
    const [messages, setMessages] = useState(null);
    const [messageDraft, setMessageDraft] = useState("");
    const [sendingMessage, setSendingMessage] = useState(false);
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    const [showScheduleForm, setShowScheduleForm] = useState(false);
    const [scheduleForm, setScheduleForm] = useState(blankSchedule);
    const [feedbackDraft, setFeedbackDraft] = useState({});

    const [showEvalForm, setShowEvalForm] = useState(false);
    const [evalForm, setEvalForm] = useState(blankEvaluation);

    const requestId = useRef(0);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    async function load() {
        const reqId = ++requestId.current;
        try {
            const isCandidateUser = user?.role === "Candidate";
            const [app, ivs, evs, msgs] = await Promise.all([
                applicationsApi.getById(id),
                isCandidateUser ? Promise.resolve([]) : interviewsApi.getForApplication(id),
                isCandidateUser ? Promise.resolve([]) : evaluationsApi.getForApplication(id),
                messagesApi.getForApplication(id),
            ]);
            if (requestId.current !== reqId || !mounted.current) return; // superseded or unmounted
            setApplication(app);
            setInterviews(ivs);
            setEvaluations(evs);
            setMessages(msgs);
            setError("");
        } catch (err) {
            if (requestId.current !== reqId || !mounted.current) return;
            setError(err.message);
        }
    }

    useEffect(() => {
        // Reset everything on id change — otherwise stale data from the previous
        // application flashes, and unsaved drafts/open forms leak onto the new one.
        setApplication(null);
        setInterviews(null);
        setEvaluations(null);
        setMessages(null);
        setMessageDraft("");
        setError("");
        setShowScheduleForm(false);
        setScheduleForm(blankSchedule);
        setFeedbackDraft({});
        setShowEvalForm(false);
        setEvalForm(blankEvaluation);
        load();
        return () => {
            requestId.current += 1; // invalidate in-flight request on id change/unmount
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    async function handleStatusChange(status) {
        setBusy(true);
        setError("");
        try {
            await applicationsApi.updateStatus(id, status);
            if (!mounted.current) return;
            await load();
        } catch (err) {
            if (!mounted.current) return;
            setError(err.message);
        } finally {
            if (mounted.current) setBusy(false);
        }
    }

    async function handleSchedule(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await interviewsApi.schedule({
                jobApplicationId: Number(id),
                scheduledAt: new Date(scheduleForm.scheduledAt).toISOString(),
                durationMinutes: Number(scheduleForm.durationMinutes) || blankSchedule.durationMinutes,
                location: scheduleForm.location || undefined,
            });
            if (!mounted.current) return;
            setShowScheduleForm(false);
            setScheduleForm(blankSchedule);
            await load();
        } catch (err) {
            if (!mounted.current) return;
            setError(err.message);
        } finally {
            if (mounted.current) setBusy(false);
        }
    }

    function draftFor(interviewId) {
        return feedbackDraft[interviewId] ?? { feedback: "", score: 70, status: "Completed" };
    }

    function updateDraft(interviewId, patch) {
        setFeedbackDraft((prev) => ({ ...prev, [interviewId]: { ...draftFor(interviewId), ...patch } }));
    }

    async function handleSaveFeedback(interviewId) {
        const draft = draftFor(interviewId);
        setBusy(true);
        setError("");
        try {
            await interviewsApi.update(interviewId, {
                feedback: draft.feedback,
                score: clampScore(draft.score, 0),
                status: draft.status,
            });
            if (!mounted.current) return;
            await load();
        } catch (err) {
            if (!mounted.current) return;
            setError(err.message);
        } finally {
            if (mounted.current) setBusy(false);
        }
    }

    async function handleEvaluate(e) {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
            await evaluationsApi.create({
                jobApplicationId: Number(id),
                technicalScore: clampScore(evalForm.technicalScore, blankEvaluation.technicalScore),
                communicationScore: clampScore(evalForm.communicationScore, blankEvaluation.communicationScore),
                cultureFitScore: clampScore(evalForm.cultureFitScore, blankEvaluation.cultureFitScore),
                comments: evalForm.comments || undefined,
                recommended: evalForm.recommended,
            });
            if (!mounted.current) return;
            setShowEvalForm(false);
            setEvalForm(blankEvaluation);
            await load();
        } catch (err) {
            if (!mounted.current) return;
            setError(err.message);
        } finally {
            if (mounted.current) setBusy(false);
        }
    }

    async function handleSendMessage(e) {
        e.preventDefault();
        const body = messageDraft.trim();
        if (!body) return;
        setSendingMessage(true);
        setError("");
        try {
            const sent = await messagesApi.send(Number(id), body);
            if (!mounted.current) return;
            setMessages((prev) => [...(prev ?? []), sent]);
            setMessageDraft("");
        } catch (err) {
            if (!mounted.current) return;
            setError(err.message);
        } finally {
            if (mounted.current) setSendingMessage(false);
        }
    }

    const canEvaluate = user?.role === "HiringManager" || user?.role === "Admin";

    if (!application && !error) return <LoadingState text="Loading application…" />;
    if (error && !application) return <div className="form-error" role="alert">{error}</div>;

    return (
        <div>
            <Link to={backTo} className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>← Back</Link>

            {error && <div className="form-error" role="alert">{error}</div>}

            <div className="card">
                <div className="row-between">
                    <div>
                        <div className="eyebrow">{application.jobTitle}</div>
                        <h1 style={{ marginBottom: 4 }}>{application.candidateName}</h1>
                        <p style={{ margin: 0 }}>Applied {new Date(application.appliedDate).toLocaleDateString()}</p>
                    </div>
                    <MatchRing score={application.matchScore} label="AI match" />
                </div>

                <div className="row" style={{ marginTop: 14 }}>
                    <ApplicationStatusBadge status={application.status} />
                    {!isCandidate && (
                        <select
                            value={application.status}
                            disabled={busy}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            style={{ marginLeft: "auto" }}
                        >
                            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                    )}
                </div>

                {application.coverLetter && (
                    <>
                        <hr className="divider" />
                        <h3>Cover letter</h3>
                        <p style={{ whiteSpace: "pre-wrap" }}>{application.coverLetter}</p>
                    </>
                )}
            </div>

            {/* ---------- Messages ---------- */}
            <div className="card">
                <div className="section-title">
                    <h3>Messages</h3>
                </div>

                {messages && messages.length === 0 && (
                    <EmptyState title="No messages yet" body="Start the conversation about this application below." />
                )}

                <div className="stack" style={{ marginBottom: 16 }}>
                    {messages?.map((m) => (
                        <div className="card" key={m.id} style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
                            <div className="row-between">
                                <div className="title">{m.senderName} <span className="tag">{m.senderRole}</span></div>
                                <div className="meta">{new Date(m.sentAt).toLocaleString()}</div>
                            </div>
                            <p style={{ marginTop: 8, marginBottom: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
                        </div>
                    ))}
                </div>

                <form onSubmit={handleSendMessage} className="row" style={{ gap: 8 }}>
                    <textarea
                        placeholder="Write a message…"
                        value={messageDraft}
                        onChange={(e) => setMessageDraft(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary btn-sm" type="submit" disabled={sendingMessage || !messageDraft.trim()}>
                        {sendingMessage ? "Sending…" : "Send"}
                    </button>
                </form>
            </div>

            {/* ---------- Interviews ---------- */}
            {!isCandidate && (
            <div className="card">
                <div className="section-title">
                    <h3>Interviews</h3>
                    {!isCandidate && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowScheduleForm((v) => !v)}>
                            {showScheduleForm ? "Cancel" : "Schedule interview"}
                        </button>
                    )}
                </div>

                {showScheduleForm && !isCandidate && (
                    <form onSubmit={handleSchedule} className="card" style={{ background: "var(--surface-sunken)", boxShadow: "none", marginBottom: 16 }}>
                        <div className="grid-2">
                            <div className="field">
                                <label htmlFor="scheduledAt">Date &amp; time</label>
                                <input
                                    id="scheduledAt" type="datetime-local" required
                                    value={scheduleForm.scheduledAt}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                                />
                            </div>
                            <div className="field">
                                <label htmlFor="durationMinutes">Duration (minutes)</label>
                                <input
                                    id="durationMinutes" type="number" min="15" step="15"
                                    value={scheduleForm.durationMinutes}
                                    onChange={(e) => setScheduleForm({ ...scheduleForm, durationMinutes: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="field">
                            <label htmlFor="location">Location or meeting link</label>
                            <input
                                id="location" placeholder="Google Meet link, office address, phone…"
                                value={scheduleForm.location}
                                onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                            />
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={busy}>
                            {busy ? "Scheduling…" : "Confirm interview"}
                        </button>
                    </form>
                )}

                {interviews && interviews.length === 0 && !showScheduleForm && (
                    <EmptyState title="No interviews scheduled yet" body="Schedule one once the candidate is ready to move forward." />
                )}

                <div className="stack">
                    {interviews?.map((iv) => {
                        const draft = draftFor(iv.id);
                        return (
                            <div className="card" key={iv.id} style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
                                <div className="row-between">
                                    <div>
                                        <div className="title">{new Date(iv.scheduledAt).toLocaleString()}</div>
                                        <div className="meta">
                                            {iv.durationMinutes} min · {iv.location || "No location set"} · with {iv.interviewerName}
                                        </div>
                                    </div>
                                    <span className={`badge ${iv.status === "Completed" ? "badge-teal" : iv.status === "Cancelled" ? "badge-rust" : "badge-blue"}`}>
                                        {iv.status}
                                    </span>
                                </div>

                                <div className="row" style={{ marginTop: 10 }}>
                                    <a className="btn btn-secondary btn-sm" href={iv.googleCalendarLink} target="_blank" rel="noreferrer">Add to Google Calendar</a>
                                    <a className="btn btn-secondary btn-sm" href={iv.outlookCalendarLink} target="_blank" rel="noreferrer">Add to Outlook</a>
                                </div>

                                {iv.feedback && (
                                    <p style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                                        <strong>Feedback:</strong> {iv.feedback} {iv.score != null && <span className="tag">Score {iv.score}/100</span>}
                                    </p>
                                )}

                                {!isCandidate && (
                                <>
                                <hr className="divider" />
                                <div className="field">
                                    <label>Add / update feedback</label>
                                    <textarea
                                        placeholder="How did the interview go?"
                                        value={draft.feedback}
                                        onChange={(e) => updateDraft(iv.id, { feedback: e.target.value })}
                                    />
                                </div>
                                <div className="grid-2">
                                    <div className="field">
                                        <label>Score (0-100)</label>
                                        <input type="number" min="0" max="100" value={draft.score} onChange={(e) => updateDraft(iv.id, { score: e.target.value })} />
                                    </div>
                                    <div className="field">
                                        <label>Status</label>
                                        <select value={draft.status} onChange={(e) => updateDraft(iv.id, { status: e.target.value })}>
                                            <option value="Scheduled">Scheduled</option>
                                            <option value="Completed">Completed</option>
                                            <option value="Cancelled">Cancelled</option>
                                            <option value="NoShow">No show</option>
                                        </select>
                                    </div>
                                </div>
                                <button className="btn btn-secondary btn-sm" disabled={busy} onClick={() => handleSaveFeedback(iv.id)}>
                                    Save feedback
                                </button>
                                </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            )}

            {/* ---------- Evaluations ---------- */}
            {!isCandidate && (
            <div className="card">
                <div className="section-title">
                    <h3>Hiring manager evaluation</h3>
                    {canEvaluate && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowEvalForm((v) => !v)}>
                            {showEvalForm ? "Cancel" : "Add evaluation"}
                        </button>
                    )}
                </div>

                {showEvalForm && (
                    <form onSubmit={handleEvaluate} className="card" style={{ background: "var(--surface-sunken)", boxShadow: "none", marginBottom: 16 }}>
                        <div className="field">
                            <label htmlFor="technicalScore">Technical score: {evalForm.technicalScore}</label>
                            <input id="technicalScore" type="range" min="0" max="100"
                                value={evalForm.technicalScore}
                                onChange={(e) => setEvalForm({ ...evalForm, technicalScore: e.target.value })} />
                        </div>
                        <div className="field">
                            <label htmlFor="communicationScore">Communication score: {evalForm.communicationScore}</label>
                            <input id="communicationScore" type="range" min="0" max="100"
                                value={evalForm.communicationScore}
                                onChange={(e) => setEvalForm({ ...evalForm, communicationScore: e.target.value })} />
                        </div>
                        <div className="field">
                            <label htmlFor="cultureFitScore">Culture fit score: {evalForm.cultureFitScore}</label>
                            <input id="cultureFitScore" type="range" min="0" max="100"
                                value={evalForm.cultureFitScore}
                                onChange={(e) => setEvalForm({ ...evalForm, cultureFitScore: e.target.value })} />
                        </div>
                        <div className="field">
                            <label htmlFor="comments">Comments</label>
                            <textarea id="comments" value={evalForm.comments} onChange={(e) => setEvalForm({ ...evalForm, comments: e.target.value })} />
                        </div>
                        <div className="checkbox-row" style={{ marginBottom: 16 }}>
                            <input id="recommended" type="checkbox" checked={evalForm.recommended} onChange={(e) => setEvalForm({ ...evalForm, recommended: e.target.checked })} />
                            <label htmlFor="recommended" style={{ marginBottom: 0 }}>I recommend moving this candidate forward</label>
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={busy}>
                            {busy ? "Saving…" : "Submit evaluation"}
                        </button>
                    </form>
                )}

                {evaluations && evaluations.length === 0 && !showEvalForm && (
                    <EmptyState title="No evaluations yet" body="A hiring manager can score this candidate after interviews wrap up." />
                )}

                <div className="stack">
                    {evaluations?.map((ev) => (
                        <div className="card" key={ev.id} style={{ boxShadow: "none", border: "1px solid var(--line)" }}>
                            <div className="row-between">
                                <div>
                                    <div className="title">{ev.evaluatorName}</div>
                                    <div className="meta">{new Date(ev.evaluatedAt).toLocaleDateString()}</div>
                                </div>
                                <span className={`badge ${ev.recommended ? "badge-teal" : "badge-rust"}`}>
                                    {ev.recommended ? "Recommended" : "Not recommended"}
                                </span>
                            </div>
                            <div className="row" style={{ marginTop: 10 }}>
                                <span className="tag">Technical {ev.technicalScore}</span>
                                <span className="tag">Communication {ev.communicationScore}</span>
                                <span className="tag">Culture fit {ev.cultureFitScore}</span>
                                <span className="tag">Overall {ev.overallScore}</span>
                            </div>
                            {ev.comments && <p style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>{ev.comments}</p>}
                        </div>
                    ))}
                </div>
            </div>
            )}
        </div>
    );
}