import { Link } from "react-router-dom";

export default function UnauthorizedPage() {
    return (
        <div style={{ padding: 48, textAlign: "center" }}>
            <h1>403 — Access Denied</h1>
            <p>You don't have permission to view this page.</p>
            <Link to="/">Go back home</Link>
        </div>
    );
}