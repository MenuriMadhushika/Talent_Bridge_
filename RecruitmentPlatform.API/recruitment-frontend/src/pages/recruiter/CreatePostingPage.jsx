import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { jobPostingsApi } from "../../api/jobPostings";
import { organizationsApi } from "../../api/organizations";
import { useAuth } from "../../context/AuthContext";

const blank = {
    title: "",
    description: "",
    requiredSkills: "",
    location: "",
    isRemote: false,
    salaryMin: "",
    salaryMax: "",
    departmentId: "",
    closingDate: "",
};

const RefreshIcon = ({ spinning }) => (
    <svg
        className={spinning ? "cpp-spin" : ""}
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
    </svg>
);

export default function CreatePostingPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [form, setForm] = useState(blank);
    const [departments, setDepartments] = useState(null);
    const [departmentsError, setDepartmentsError] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const requestId = useRef(0);
    const mounted = useRef(true);

    function loadDepartments() {
        if (!user?.organizationId) {
            setDepartments([]);
            return;
        }
        const reqId = ++requestId.current;
        setDepartmentsError("");
        organizationsApi
            .getDepartments(user.organizationId)
            .then((res) => {
                if (requestId.current !== reqId) return;
                setDepartments(res);
            })
            .catch((err) => {
                if (requestId.current !== reqId) return;
                // Unstick the form: without this, `departments` stays null forever
                // and the select is permanently disabled on "Loading departments…".
                setDepartments([]);
                setDepartmentsError(err.message);
            });
    }

    useEffect(() => {
        loadDepartments();
        return () => {
            requestId.current += 1;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.organizationId]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    function update(field, value) {
        setForm((f) => ({ ...f, [field]: value }));
    }

    function validate() {
        if (form.salaryMin && form.salaryMax && Number(form.salaryMin) > Number(form.salaryMax)) {
            return "Salary min can't be greater than salary max.";
        }
        return "";
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }
        setError("");
        setBusy(true);
        try {
            const dto = {
                ...form,
                departmentId: Number(form.departmentId),
                salaryMin: form.salaryMin ? Number(form.salaryMin) : undefined,
                salaryMax: form.salaryMax ? Number(form.salaryMax) : undefined,
                closingDate: form.closingDate || undefined,
            };
            const posting = await jobPostingsApi.create(dto);
            navigate(`/recruiter/postings/${posting.id}/applications`);
        } catch (err) {
            if (!mounted.current) return;
            setError(err.message);
        } finally {
            if (mounted.current) setBusy(false);
        }
    }

    return (
        <div>
            <style>{CPP_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Recruiter portal</div>
                    <h1>New job posting</h1>
                    <p>Publish a role — it goes live for candidates to browse and apply immediately.</p>
                </div>
            </div>

            <div className="card" style={{ maxWidth: 640 }}>
                {error && <div className="form-error" role="alert">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label htmlFor="title">Title</label>
                        <input id="title" required value={form.title} onChange={(e) => update("title", e.target.value)} />
                    </div>
                    <div className="field">
                        <label htmlFor="description">Description</label>
                        <textarea id="description" required value={form.description} onChange={(e) => update("description", e.target.value)} />
                    </div>
                    <div className="field">
                        <label htmlFor="requiredSkills">Required skills</label>
                        <input
                            id="requiredSkills"
                            placeholder="Comma-separated, e.g. Python, SQL, AWS"
                            value={form.requiredSkills}
                            onChange={(e) => update("requiredSkills", e.target.value)}
                        />
                        <span className="hint">Used by AI matching to score and rank candidates against this posting.</span>
                    </div>
                    <div className="grid-2">
                        <div className="field">
                            <label htmlFor="location">Location</label>
                            <input id="location" value={form.location} onChange={(e) => update("location", e.target.value)} />
                        </div>
                        <div className="field">
                            <label htmlFor="departmentId">Department</label>
                            <select
                                id="departmentId"
                                required
                                value={form.departmentId}
                                onChange={(e) => update("departmentId", e.target.value)}
                                disabled={!departments || departments.length === 0}
                            >
                                <option value="" disabled>
                                    {departments === null ? "Loading departments…" : "Select a department"}
                                </option>
                                {departments?.map((d) => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                            {departments && departments.length === 0 && !departmentsError && (
                                <span className="hint">No departments set up yet — ask an admin to add one to your organization.</span>
                            )}
                            {departmentsError && (
                                <span className="hint cpp-dept-error">
                                    Couldn't load departments ({departmentsError}).{" "}
                                    <button type="button" className="cpp-retry-link" onClick={loadDepartments}>
                                        <RefreshIcon spinning={false} /> Retry
                                    </button>
                                </span>
                            )}
                        </div>
                    </div>
                    <div className="checkbox-row" style={{ marginBottom: 16 }}>
                        <input id="isRemote" type="checkbox" checked={form.isRemote} onChange={(e) => update("isRemote", e.target.checked)} />
                        <label htmlFor="isRemote" style={{ marginBottom: 0 }}>This role is remote-friendly</label>
                    </div>
                    <div className="grid-2">
                        <div className="field">
                            <label htmlFor="salaryMin">Salary min</label>
                            <input id="salaryMin" type="number" min="0" value={form.salaryMin} onChange={(e) => update("salaryMin", e.target.value)} />
                        </div>
                        <div className="field">
                            <label htmlFor="salaryMax">Salary max</label>
                            <input id="salaryMax" type="number" min="0" value={form.salaryMax} onChange={(e) => update("salaryMax", e.target.value)} />
                        </div>
                    </div>
                    <div className="field">
                        <label htmlFor="closingDate">Closing date (optional)</label>
                        <input id="closingDate" type="date" value={form.closingDate} onChange={(e) => update("closingDate", e.target.value)} />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={busy || !form.departmentId}>
                        {busy ? "Publishing…" : "Publish posting"}
                    </button>
                </form>
            </div>
        </div>
    );
}

const CPP_STYLES = `
  .cpp-dept-error { color: inherit; opacity: 0.85; }
  .cpp-retry-link {
    display: inline-flex; align-items: center; gap: 4px;
    background: none; border: none; padding: 0; margin-left: 4px;
    color: inherit; text-decoration: underline; cursor: pointer; font-size: inherit;
  }
  .cpp-spin { animation: cpp-spin 0.8s linear infinite; display: inline-block; }
  @keyframes cpp-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .cpp-spin { animation: none !important; }
  }
`;