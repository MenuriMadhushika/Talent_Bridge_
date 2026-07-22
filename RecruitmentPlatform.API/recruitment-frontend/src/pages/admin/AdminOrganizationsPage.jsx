import { useEffect, useMemo, useRef, useState } from "react";
import { organizationsApi } from "../../api/organizations";

function toCsv(orgs) {
    const header = "Name,Industry,Departments,Users";
    const lines = orgs.map(
        (o) => `"${o.name}","${o.industry || ""}",${o.departmentCount},${o.userCount}`
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

// ---- Skeletons -----------------------------------------------------------

function SkeletonOrgList({ count = 4 }) {
    return (
        <div className="stack" aria-busy="true" aria-live="polite">
            {Array.from({ length: count }).map((_, i) => (
                <div className="card" key={i}>
                    <div className="row-between">
                        <div style={{ flex: 1 }}>
                            <div className="orgpg-skeleton orgpg-skeleton-title" />
                            <div className="orgpg-skeleton orgpg-skeleton-meta" />
                            <div className="row" style={{ marginTop: 8, gap: 8 }}>
                                <div className="orgpg-skeleton orgpg-skeleton-tag" />
                                <div className="orgpg-skeleton orgpg-skeleton-tag" />
                            </div>
                        </div>
                        <div className="orgpg-skeleton orgpg-skeleton-btn" />
                    </div>
                </div>
            ))}
        </div>
    );
}

// ---- Small icons -----------------------------------------------------------

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

const ChevronIcon = ({ open }) => (
    <svg
        className="orgpg-chevron"
        style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
        <path d="M6 9l6 6 6-6" />
    </svg>
);

// ---- Main component -----------------------------------------------------

export default function AdminOrganizationsPage() {
    const [orgs, setOrgs] = useState(null);
    const [departmentsByOrg, setDepartmentsByOrg] = useState({});
    const [loadingDeptsFor, setLoadingDeptsFor] = useState(null);
    const [expandedOrgId, setExpandedOrgId] = useState(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const [showNewOrgForm, setShowNewOrgForm] = useState(false);
    const [newOrg, setNewOrg] = useState({ name: "", industry: "" });
    const [busy, setBusy] = useState(false);

    const [newDeptName, setNewDeptName] = useState({});
    const [busyDeptOrgId, setBusyDeptOrgId] = useState(null);

    const [search, setSearch] = useState("");
    const [sortMode, setSortMode] = useState("name"); // "name" | "departments" | "users"

    const listRequestId = useRef(0);
    const noticeTimer = useRef(null);

    function flashNotice(text) {
        setNotice(text);
        clearTimeout(noticeTimer.current);
        noticeTimer.current = setTimeout(() => setNotice(""), 3000);
    }

    async function loadOrgs({ silent = false } = {}) {
        const id = ++listRequestId.current;
        try {
            const result = await organizationsApi.list();
            if (listRequestId.current !== id) return;
            setOrgs(result);
            if (!silent) setError("");
        } catch (err) {
            if (listRequestId.current !== id) return;
            setError(err.message);
        }
    }

    useEffect(() => {
        loadOrgs();
        return () => {
            listRequestId.current += 1;
            clearTimeout(noticeTimer.current);
        };
    }, []);

    async function toggleExpand(orgId) {
        if (expandedOrgId === orgId) {
            setExpandedOrgId(null);
            return;
        }
        setExpandedOrgId(orgId);
        if (!departmentsByOrg[orgId]) {
            setLoadingDeptsFor(orgId);
            try {
                const depts = await organizationsApi.getDepartments(orgId);
                setDepartmentsByOrg((prev) => ({ ...prev, [orgId]: depts }));
            } catch (err) {
                setError(err.message);
            } finally {
                setLoadingDeptsFor(null);
            }
        }
    }

    async function handleCreateOrg(e) {
        e.preventDefault();
        const name = newOrg.name.trim();
        if (!name) return;
        setBusy(true);
        setError("");
        try {
            await organizationsApi.create({ ...newOrg, name });
            setNewOrg({ name: "", industry: "" });
            setShowNewOrgForm(false);
            await loadOrgs();
            flashNotice(`“${name}” created.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function handleCreateDepartment(orgId) {
        const name = (newDeptName[orgId] || "").trim();
        if (!name) return;
        setBusyDeptOrgId(orgId);
        setError("");
        try {
            await organizationsApi.createDepartment(orgId, { name });
            setNewDeptName((prev) => ({ ...prev, [orgId]: "" }));
            const depts = await organizationsApi.getDepartments(orgId);
            setDepartmentsByOrg((prev) => ({ ...prev, [orgId]: depts }));
            await loadOrgs({ silent: true });
            flashNotice(`“${name}” added.`);
        } catch (err) {
            setError(err.message);
        } finally {
            setBusyDeptOrgId(null);
        }
    }

    const summary = useMemo(() => {
        if (!orgs) return null;
        return orgs.reduce(
            (acc, o) => ({
                departments: acc.departments + (o.departmentCount || 0),
                users: acc.users + (o.userCount || 0),
            }),
            { departments: 0, users: 0 }
        );
    }, [orgs]);

    const visibleOrgs = useMemo(() => {
        if (!orgs) return [];
        let list = orgs;
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(
                (o) => o.name.toLowerCase().includes(q) || (o.industry || "").toLowerCase().includes(q)
            );
        }
        list = [...list].sort((a, b) => {
            if (sortMode === "departments") return (b.departmentCount || 0) - (a.departmentCount || 0);
            if (sortMode === "users") return (b.userCount || 0) - (a.userCount || 0);
            return a.name.localeCompare(b.name);
        });
        return list;
    }, [orgs, search, sortMode]);

    if (!orgs && !error) return <SkeletonOrgList />;

    return (
        <div>
            <style>{ORGPG_STYLES}</style>

            <div className="page-head">
                <div>
                    <div className="eyebrow">Administration portal</div>
                    <h1>Organizations &amp; departments</h1>
                    <p>Client organizations and their departments — recruiters and hiring managers register under these.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowNewOrgForm((v) => !v)}>
                    {showNewOrgForm ? "Cancel" : "New organization"}
                </button>
            </div>

            {orgs && orgs.length > 0 && summary && (
                <p className="orgpg-summary">
                    <strong>{orgs.length}</strong> organization{orgs.length === 1 ? "" : "s"} ·{" "}
                    <strong>{summary.departments}</strong> department{summary.departments === 1 ? "" : "s"} ·{" "}
                    <strong>{summary.users}</strong> user{summary.users === 1 ? "" : "s"}
                </p>
            )}

            {error && (
                <div className="form-error orgpg-error" role="alert">
                    {error}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadOrgs()}>
                        Retry
                    </button>
                </div>
            )}
            {notice && (
                <div className="orgpg-notice" role="status" aria-live="polite">
                    {notice}
                </div>
            )}

            {showNewOrgForm && (
                <form onSubmit={handleCreateOrg} className="card" style={{ maxWidth: 480 }}>
                    <div className="field">
                        <label htmlFor="orgName">Organization name</label>
                        <input id="orgName" required value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} />
                    </div>
                    <div className="field">
                        <label htmlFor="orgIndustry">Industry</label>
                        <input id="orgIndustry" value={newOrg.industry} onChange={(e) => setNewOrg({ ...newOrg, industry: e.target.value })} />
                    </div>
                    <button className="btn btn-primary" type="submit" disabled={busy || !newOrg.name.trim()}>
                        {busy ? "Creating…" : "Create organization"}
                    </button>
                </form>
            )}

            {orgs && orgs.length > 0 && (
                <div className="orgpg-toolbar">
                    <div className="orgpg-search">
                        <SearchIcon />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search organizations…"
                            aria-label="Search organizations"
                        />
                    </div>
                    <div className="orgpg-sort" role="group" aria-label="Sort organizations">
                        <button type="button" className={`orgpg-chip ${sortMode === "name" ? "active" : ""}`} onClick={() => setSortMode("name")}>
                            A–Z
                        </button>
                        <button type="button" className={`orgpg-chip ${sortMode === "departments" ? "active" : ""}`} onClick={() => setSortMode("departments")}>
                            Most departments
                        </button>
                        <button type="button" className={`orgpg-chip ${sortMode === "users" ? "active" : ""}`} onClick={() => setSortMode("users")}>
                            Most users
                        </button>
                    </div>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => downloadCsv("organizations.csv", toCsv(orgs))}
                    >
                        <DownloadIcon /> Export
                    </button>
                </div>
            )}

            {orgs && orgs.length === 0 && (
                <div className="card orgpg-empty">
                    <div className="title">No organizations yet</div>
                    <p>Create the first client organization to start onboarding recruiters and hiring managers.</p>
                    <button className="btn btn-primary" onClick={() => setShowNewOrgForm(true)}>
                        New organization
                    </button>
                </div>
            )}

            {orgs && orgs.length > 0 && visibleOrgs.length === 0 && (
                <p className="orgpg-empty-filtered">No organizations match “{search}”.</p>
            )}

            <div className="stack">
                {visibleOrgs.map((org) => {
                    const isOpen = expandedOrgId === org.id;
                    const depts = departmentsByOrg[org.id] || [];
                    const isLoadingDepts = loadingDeptsFor === org.id;
                    const isDeptBusy = busyDeptOrgId === org.id;
                    return (
                        <div className="card" key={org.id}>
                            <div className="row-between">
                                <div>
                                    <div className="title">{org.name}</div>
                                    <div className="meta">{org.industry || "Industry not set"}</div>
                                    <div className="row" style={{ marginTop: 8 }}>
                                        <span className="tag">{org.departmentCount} department{org.departmentCount === 1 ? "" : "s"}</span>
                                        <span className="tag">{org.userCount} user{org.userCount === 1 ? "" : "s"}</span>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => toggleExpand(org.id)}
                                    aria-expanded={isOpen}
                                    aria-controls={`dept-panel-${org.id}`}
                                >
                                    {isOpen ? "Hide departments" : "Manage departments"} <ChevronIcon open={isOpen} />
                                </button>
                            </div>

                            <div
                                id={`dept-panel-${org.id}`}
                                className={`orgpg-panel ${isOpen ? "orgpg-panel-open" : ""}`}
                            >
                                <div className="orgpg-panel-inner">
                                    <hr className="divider" />
                                    <div className="stack" style={{ gap: 8, marginBottom: 14 }}>
                                        {isLoadingDepts && (
                                            <>
                                                <div className="orgpg-skeleton orgpg-skeleton-deptrow" />
                                                <div className="orgpg-skeleton orgpg-skeleton-deptrow" />
                                            </>
                                        )}
                                        {!isLoadingDepts &&
                                            depts.map((d) => (
                                                <div className="list-item" key={d.id} style={{ padding: "10px 14px" }}>
                                                    <div className="title" style={{ fontSize: "var(--text-sm)" }}>{d.name}</div>
                                                    <span className="tag">{d.jobPostingCount} posting{d.jobPostingCount === 1 ? "" : "s"}</span>
                                                </div>
                                            ))}
                                        {!isLoadingDepts && depts.length === 0 && (
                                            <p style={{ margin: 0 }}>No departments yet — add the first one below.</p>
                                        )}
                                    </div>
                                    <div className="row">
                                        <input
                                            placeholder="New department name…"
                                            value={newDeptName[org.id] || ""}
                                            onChange={(e) => setNewDeptName((prev) => ({ ...prev, [org.id]: e.target.value }))}
                                            onKeyDown={(e) => e.key === "Enter" && handleCreateDepartment(org.id)}
                                            style={{ flex: 1, minWidth: 180 }}
                                        />
                                        <button
                                            className="btn btn-secondary btn-sm"
                                            disabled={isDeptBusy || !(newDeptName[org.id] || "").trim()}
                                            onClick={() => handleCreateDepartment(org.id)}
                                        >
                                            {isDeptBusy ? "Adding…" : "Add department"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ---- Scoped styles (additive only — original classNames untouched) ------

const ORGPG_STYLES = `
  .orgpg-summary { font-size: 13px; opacity: 0.75; margin: -6px 0 16px; }

  .orgpg-error { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .orgpg-notice {
    font-size: 13px; padding: 8px 12px; border-radius: 8px; margin-bottom: 14px;
    border: 1px solid rgba(79, 157, 105, 0.35); background: rgba(79, 157, 105, 0.08);
  }

  .orgpg-toolbar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
  .orgpg-search {
    display: flex; align-items: center; gap: 6px; padding: 5px 10px;
    border-radius: 8px; border: 1px solid rgba(127,127,127,0.35);
  }
  .orgpg-search input { border: none; background: transparent; outline: none; font-size: 13px; color: inherit; width: 180px; }

  .orgpg-sort { display: inline-flex; border-radius: 8px; overflow: hidden; border: 1px solid rgba(127,127,127,0.35); }
  .orgpg-chip { padding: 6px 10px; font-size: 12px; border: none; background: transparent; color: inherit; opacity: 0.6; cursor: pointer; white-space: nowrap; }
  .orgpg-chip.active { opacity: 1; background: rgba(127,127,127,0.15); font-weight: 600; }

  .orgpg-empty { text-align: left; }
  .orgpg-empty-filtered { opacity: 0.7; font-size: 13px; }

  .orgpg-panel { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 0.25s ease; }
  .orgpg-panel-open { grid-template-rows: 1fr; }
  .orgpg-panel-inner { overflow: hidden; min-height: 0; }

  .orgpg-chevron { transition: transform 0.2s ease; }

  .orgpg-skeleton {
    background: linear-gradient(90deg, rgba(127,127,127,0.12) 25%, rgba(127,127,127,0.22) 37%, rgba(127,127,127,0.12) 63%);
    background-size: 400% 100%; animation: orgpg-shimmer 1.4s ease infinite; border-radius: 6px;
  }
  @keyframes orgpg-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }
  .orgpg-skeleton-title { height: 16px; width: 40%; margin-bottom: 8px; }
  .orgpg-skeleton-meta { height: 12px; width: 25%; }
  .orgpg-skeleton-tag { height: 20px; width: 90px; border-radius: 999px; }
  .orgpg-skeleton-btn { height: 30px; width: 150px; border-radius: 8px; }
  .orgpg-skeleton-deptrow { height: 38px; width: 100%; border-radius: 8px; }

  @media (prefers-reduced-motion: reduce) {
    .orgpg-skeleton, .orgpg-panel, .orgpg-chevron { animation: none !important; transition: none !important; }
  }

  @media (max-width: 640px) {
    .orgpg-toolbar { flex-direction: column; align-items: stretch; }
    .orgpg-search input { width: 100%; }
  }
`;