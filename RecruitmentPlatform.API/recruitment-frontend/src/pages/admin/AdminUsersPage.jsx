import { useEffect, useMemo, useRef, useState } from "react";
import { adminApi } from "../../api/admin";
import { EmptyState } from "../../components/States";

const ROLES = ["Candidate", "Recruiter", "HiringManager", "Admin"];

function toCsv(users) {
    const header = "Name,Email,Organization,Role,Status,Joined";
    const lines = users.map((u) =>
        [
            u.fullName,
            u.email,
            u.organizationName || "",
            u.role,
            u.isActive ? "Active" : "Inactive",
            new Date(u.createdAt).toLocaleDateString(),
        ]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(",")
    );
    return [header, ...lines].join("\n");
}

function downloadCsv(filename, csv) {
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ---- Skeleton ---------------------------------------------------------

function SkeletonRows({ count = 6 }) {
    return (
        <tbody aria-busy="true" aria-live="polite">
            {Array.from({ length: count }).map((_, i) => (
                <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                        <td key={j}>
                            <div className="usrpg-skeleton" />
                        </td>
                    ))}
                </tr>
            ))}
        </tbody>
    );
}

const SortIcon = ({ direction }) => {
    if (!direction) return <span className="usrpg-sort-icon usrpg-sort-idle">↕</span>;
    return <span className="usrpg-sort-icon">{direction === "asc" ? "↑" : "↓"}</span>;
};

const SearchIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
    </svg>
);

const DownloadIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3v12" />
        <path d="M7 10l5 5 5-5" />
        <path d="M5 21h14" />
    </svg>
);

const SORT_ACCESSORS = {
    name: (u) => u.fullName?.toLowerCase() || "",
    email: (u) => u.email?.toLowerCase() || "",
    organization: (u) => u.organizationName?.toLowerCase() || "",
    role: (u) => u.role || "",
    status: (u) => (u.isActive ? 1 : 0),
    joined: (u) => new Date(u.createdAt).getTime(),
};

// ---- Main component -----------------------------------------------------

export default function AdminUsersPage() {
    const [roleFilter, setRoleFilter] = useState("");
    const [users, setUsers] = useState(null);
    const [error, setError] = useState("");
    const [busyId, setBusyId] = useState(null);
    const [notice, setNotice] = useState("");
    const [search, setSearch] = useState("");
    const [sort, setSort] = useState({ key: "name", direction: "asc" });

    const requestId = useRef(0);
    const noticeTimer = useRef(null);

    function flashNotice(text) {
        setNotice(text);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(""), 2500);
    }

    async function load(role) {
        const id = ++requestId.current;
        setError("");
        try {
            const result = await adminApi.getUsers(role || undefined);
            if (requestId.current !== id) return; // a newer filter/request superseded this one
            setUsers(result);
        } catch (err) {
            if (requestId.current !== id) return;
            setError(err.message);
        }
    }

    useEffect(() => {
        setUsers(null); // only the active filter shows its own skeleton
        load(roleFilter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleFilter]);

    useEffect(() => () => clearTimeout(noticeTimer.current), []);

    async function handleToggleActive(id, willBeActive) {
        setBusyId(id);
        try {
            await adminApi.toggleActive(id);
            await load(roleFilter);
            flashNotice(willBeActive ? "User activated." : "User deactivated.");
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    }

    async function handleRoleChange(id, role) {
        if (!confirm(`Change this user's role to ${role}? Their access will update immediately.`)) return;
        setBusyId(id);
        try {
            await adminApi.changeRole(id, role);
            await load(roleFilter);
            flashNotice(`Role updated to ${role}.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyId(null);
        }
    }

    function toggleSort(key) {
        setSort((prev) =>
            prev.key === key
                ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
                : { key, direction: "asc" }
        );
    }

    const visibleUsers = useMemo(() => {
        if (!users) return [];
        let list = users;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                (u) => u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
            );
        }
        const accessor = SORT_ACCESSORS[sort.key];
        list = [...list].sort((a, b) => {
            const av = accessor(a);
            const bv = accessor(b);
            if (av < bv) return sort.direction === "asc" ? -1 : 1;
            if (av > bv) return sort.direction === "asc" ? 1 : -1;
            return 0;
        });
        return list;
    }, [users, search, sort]);

    const columns = [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
        { key: "organization", label: "Organization" },
        { key: "role", label: "Role" },
        { key: "status", label: "Status" },
        { key: "joined", label: "Joined" },
    ];

    return (
        <div>
            <style>{USRPG_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Administration portal</div>
                    <h1>Users &amp; roles</h1>
                    <p>Manage every account on the platform — activate, deactivate, or reassign roles.</p>
                </div>
                <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={{ height: "fit-content" }}>
                    <option value="">All roles</option>
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
            </div>

            {error && (
                <div className="form-error usrpg-error" role="alert">
                    {error}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => load(roleFilter)}>
                        Retry
                    </button>
                </div>
            )}
            {notice && (
                <div className="usrpg-notice" role="status" aria-live="polite">
                    {notice}
                </div>
            )}

            {users && users.length > 0 && (
                <div className="usrpg-toolbar">
                    <div className="usrpg-search">
                        <SearchIcon />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search name or email…"
                            aria-label="Search users"
                        />
                    </div>
                    <span className="usrpg-count">
                        {visibleUsers.length} of {users.length} user{users.length === 1 ? "" : "s"}
                    </span>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => downloadCsv("users.csv", toCsv(visibleUsers))}
                    >
                        <DownloadIcon /> Export
                    </button>
                </div>
            )}

            {users && users.length === 0 && (
                <EmptyState title="No users match this filter" body="Try a different role filter." />
            )}

            {users && users.length > 0 && visibleUsers.length === 0 && (
                <p className="usrpg-empty-filtered">No users match “{search}”.</p>
            )}

            {(users === null || (users && users.length > 0)) && (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th key={col.key}>
                                        <button
                                            type="button"
                                            className="usrpg-th-btn"
                                            onClick={() => toggleSort(col.key)}
                                            aria-sort={
                                                sort.key === col.key ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                                            }
                                        >
                                            {col.label} <SortIcon direction={sort.key === col.key ? sort.direction : null} />
                                        </button>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        {users === null ? (
                            <SkeletonRows />
                        ) : (
                            <tbody>
                                {visibleUsers.map((u) => (
                                    <tr key={u.id} className={busyId === u.id ? "usrpg-row-busy" : ""}>
                                        <td>{u.fullName}</td>
                                        <td>{u.email}</td>
                                        <td>{u.organizationName || "—"}</td>
                                        <td>
                                            <select
                                                value={u.role}
                                                disabled={busyId === u.id}
                                                onChange={(e) => handleRoleChange(u.id, e.target.value)}
                                            >
                                                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            <button
                                                className={`pill-toggle ${u.isActive ? "on" : "off"}`}
                                                disabled={busyId === u.id}
                                                onClick={() => handleToggleActive(u.id, !u.isActive)}
                                            >
                                                {busyId === u.id ? "…" : u.isActive ? "Active" : "Inactive"}
                                            </button>
                                        </td>
                                        <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        )}
                    </table>
                </div>
            )}
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const USRPG_STYLES = `
  .usrpg-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .usrpg-notice {
    font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px;
    border: 1px solid rgba(79, 157, 105, 0.35); background: rgba(79, 157, 105, 0.08);
  }

  .usrpg-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .usrpg-search {
    display: flex; align-items: center; gap: 6px; padding: 5px 10px;
    border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
  }
  .usrpg-search input { border: none; background: transparent; outline: none; font-size: 13px; color: inherit; width: 200px; }
  .usrpg-count { font-size: 12px; opacity: 0.65; margin-right: auto; }

  .usrpg-empty-filtered { opacity: 0.7; font-size: 13px; }

  .usrpg-th-btn {
    display: inline-flex; align-items: center; gap: 4px; background: none; border: none;
    color: inherit; font: inherit; font-weight: 600; cursor: pointer; padding: 2px 0;
  }
  .usrpg-th-btn:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
  .usrpg-sort-icon { font-size: 11px; opacity: 0.9; }
  .usrpg-sort-idle { opacity: 0.35; }

  .usrpg-row-busy { opacity: 0.6; transition: opacity 0.15s ease; }

  .usrpg-skeleton {
    height: 14px; border-radius: 4px; width: 80%;
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: usrpg-shimmer 1.4s ease infinite;
  }
  @keyframes usrpg-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

  @media (prefers-reduced-motion: reduce) {
    .usrpg-skeleton { animation: none !important; }
  }

  @media (max-width: 640px) {
    .usrpg-toolbar { flex-direction: column; align-items: stretch; }
    .usrpg-search input { width: 100%; }
    .usrpg-count { margin-right: 0; }
  }
`;