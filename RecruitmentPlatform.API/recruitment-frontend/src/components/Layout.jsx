import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationBell from "./Notificationbell";

const CANDIDATE_NAV = [
  { to: "/jobs", label: "Find jobs" },
  { to: "/applications", label: "My applications" },
  { to: "/profile", label: "My profile" },
];

const RECRUITER_NAV = [
  { to: "/recruiter/postings", label: "Job postings" },
  { to: "/recruiter/postings/new", label: "New posting" },
  { to: "/recruiter/candidates", label: "Candidate search" },
];

const HIRING_MANAGER_NAV = [
  { to: "/hiring-manager", label: "Dashboard" },
  { to: "/hiring-manager/review-queue", label: "Review queue" },
];

const ADMIN_NAV = [
  { to: "/admin", label: "Analytics" },
  { to: "/admin/users", label: "Users & roles" },
  { to: "/admin/organizations", label: "Organizations" },
];

const NAV_BY_ROLE = {
  Candidate: { items: CANDIDATE_NAV, label: "Candidate portal" },
  Recruiter: { items: RECRUITER_NAV, label: "Recruiter portal" },
  HiringManager: { items: HIRING_MANAGER_NAV, label: "Hiring manager portal" },
  Admin: { items: ADMIN_NAV, label: "Administration portal" },
};

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const nav = NAV_BY_ROLE[user?.role] || NAV_BY_ROLE.Candidate;

  function handleSignOut() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="mark">T</div>
          <div className="name">Talent Bridge</div>
        </div>

        <div className="section-label">{nav.label}</div>
        <nav>
          {nav.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/hiring-manager" || item.to === "/admin"}
              className={({ isActive }) => `navlink${isActive ? " active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="userbox">
          <div className="avatar">{initials(user?.fullName)}</div>
          <div className="who">
            <div className="name">{user?.fullName}</div>
            <div className="role">{user?.role}{user?.organizationName ? ` · ${user.organizationName}` : ""}</div>
          </div>
        </div>
        <button className="signout" onClick={handleSignOut}>Sign out</button>
      </aside>

      <main className="main">
        <div className="topbar">
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
