import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { organizationsApi } from "../api/organizations";

const initialForm = {
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    role: "Candidate",
    organizationId: "",
};

const HOME_BY_ROLE = {
    Candidate: "/jobs",
    Recruiter: "/recruiter/postings",
    HiringManager: "/hiring-manager",
};

const RefreshIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
    </svg>
);

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [form, setForm] = useState(initialForm);
    const [organizations, setOrganizations] = useState(null);
    const [organizationsError, setOrganizationsError] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);

    const needsOrganization = form.role === "Recruiter" || form.role === "HiringManager";

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    function loadOrganizations() {
        setOrganizationsError("");
        organizationsApi
            .list()
            .then((res) => {
                if (!mounted.current) return;
                setOrganizations(res);
            })
            .catch((err) => {
                if (!mounted.current) return;
                // Distinguish "the fetch failed" from "there are genuinely zero orgs" —
                // otherwise a network error looks identical to an empty organization list.
                setOrganizations([]);
                setOrganizationsError(err.message);
            });
    }

    useEffect(() => {
        loadOrganizations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    function update(field, value) {
        setForm((f) => {
            const next = { ...f, [field]: value };
            // Clear a previously-selected organization if the new role doesn't need one,
            // so it doesn't get silently submitted along with an unrelated registration.
            if (field === "role" && value !== "Recruiter" && value !== "HiringManager") {
                next.organizationId = "";
            }
            return next;
        });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        if (busy) return;
        setError("");

        if (needsOrganization && !form.organizationId) {
            setError("Please select the organization you work for.");
            return;
        }

        setBusy(true);
        try {
            const dto = {
                ...form,
                email: form.email.trim(),
                organizationId: needsOrganization && form.organizationId ? Number(form.organizationId) : undefined,
            };
            const res = await register(dto);
            if (!mounted.current) return;
            navigate(HOME_BY_ROLE[res.role] || "/jobs", { replace: true });
        } catch (err) {
            if (!mounted.current) return;
            setError(err.message);
        } finally {
            if (mounted.current) setBusy(false);
        }
    }

    return (
        <div className="auth-shell">
            <div className="auth-card">
                <div className="auth-brand">
                    <div className="mark">T</div>
                    <div className="name">Talent Bridge</div>
                </div>
                <h1 style={{ fontSize: "var(--text-xl)" }}>Create your account</h1>
                <p style={{ marginBottom: 20 }}>Set up a candidate, recruiter, or hiring manager profile.</p>

                {error && <div className="form-error" role="alert">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="grid-2">
                        <div className="field">
                            <label htmlFor="firstName">First name</label>
                            <input id="firstName" required autoComplete="given-name" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} />
                        </div>
                        <div className="field">
                            <label htmlFor="lastName">Last name</label>
                            <input id="lastName" required autoComplete="family-name" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} />
                        </div>
                    </div>

                    <div className="field">
                        <label htmlFor="email">Email</label>
                        <input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
                    </div>

                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            minLength={8}
                            autoComplete="new-password"
                            value={form.password}
                            onChange={(e) => update("password", e.target.value)}
                        />
                        <span className="hint">At least 8 characters.</span>
                    </div>

                    <div className="field">
                        <label htmlFor="role">I am a…</label>
                        <select id="role" value={form.role} onChange={(e) => update("role", e.target.value)}>
                            <option value="Candidate">Job seeker (Candidate)</option>
                            <option value="Recruiter">Recruiter</option>
                            <option value="HiringManager">Hiring manager</option>
                        </select>
                    </div>

                    {needsOrganization && (
                        <div className="field">
                            <label htmlFor="organizationId">Organization</label>
                            <select
                                id="organizationId"
                                required
                                value={form.organizationId}
                                onChange={(e) => update("organizationId", e.target.value)}
                                disabled={organizations === null}
                            >
                                <option value="" disabled>
                                    {organizations === null ? "Loading organizations…" : "Select your organization"}
                                </option>
                                {organizations?.map((org) => (
                                    <option key={org.id} value={org.id}>{org.name}</option>
                                ))}
                            </select>
                            {organizationsError ? (
                                <span className="hint reg-org-error">
                                    Couldn't load organizations ({organizationsError}).{" "}
                                    <button type="button" className="reg-retry-link" onClick={loadOrganizations}>
                                        <RefreshIcon /> Retry
                                    </button>
                                </span>
                            ) : (
                                <span className="hint">
                                    {organizations && organizations.length === 0
                                        ? "No organizations exist yet — ask an admin to create one first."
                                        : "Links your postings and interviews to your company's department list."}
                                </span>
                            )}
                        </div>
                    )}

                    <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
                        {busy ? "Creating account…" : "Create account"}
                    </button>
                </form>

                <div className="auth-foot">
                    Already have an account? <Link to="/login">Sign in</Link>
                </div>
            </div>

            <style>{`
        .reg-org-error { color: inherit; opacity: 0.85; }
        .reg-retry-link {
          display: inline-flex; align-items: center; gap: 4px;
          background: none; border: none; padding: 0; margin-left: 4px;
          color: inherit; text-decoration: underline; cursor: pointer; font-size: inherit;
        }
      `}</style>
        </div>
    );
}