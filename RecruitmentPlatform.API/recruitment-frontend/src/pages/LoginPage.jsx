import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const HOME_BY_ROLE = {
    Candidate: "/jobs",
    Recruiter: "/recruiter/postings",
    HiringManager: "/hiring-manager",
    Admin: "/admin",
};

const AUTH_PATHS = new Set(["/login", "/register"]);

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [form, setForm] = useState({ email: "", password: "" });
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const mounted = useRef(true);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    async function handleSubmit(e) {
        e.preventDefault();
        if (busy) return; // guards against a double-submit racing ahead of the disabled button
        setError("");
        setBusy(true);
        try {
            const res = await login({ ...form, email: form.email.trim() });
            if (!mounted.current) return;
            const requestedPath = location.state?.from?.pathname;
            // Never redirect back into the auth flow itself — avoids a login/login loop
            // if `from` ever points at the login or register page.
            const dest = (requestedPath && !AUTH_PATHS.has(requestedPath))
                ? requestedPath
                : HOME_BY_ROLE[res.role] || "/jobs";
            navigate(dest, { replace: true });
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
                <h1 style={{ fontSize: "var(--text-xl)" }}>Sign in</h1>
                <p style={{ marginBottom: 20 }}>Continue to your candidate, recruiter, hiring manager, or admin portal.</p>

                {error && <div className="form-error" role="alert">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            required
                            autoComplete="email"
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                        />
                    </div>
                    <div className="field">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            required
                            autoComplete="current-password"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                        />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: "100%" }}>
                        {busy ? "Signing in…" : "Sign in"}
                    </button>
                </form>

                <div className="auth-foot">
                    New here? <Link to="/register">Create an account</Link>
                </div>

            </div>
        </div>
    );
}