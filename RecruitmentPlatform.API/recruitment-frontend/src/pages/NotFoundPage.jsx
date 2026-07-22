import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <div className="auth-shell">
      <div style={{ textAlign: "center" }}>
        <h1>Page not found</h1>
        <p>The page you're looking for doesn't exist.</p>
        <Link to="/" className="btn btn-primary">Go home</Link>
      </div>
    </div>
  );
}
