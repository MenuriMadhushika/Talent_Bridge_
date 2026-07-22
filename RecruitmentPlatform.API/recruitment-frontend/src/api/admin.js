import { api } from "./client";

export const adminApi = {
    getUsers: (role) => api.get(`/admin/users${role ? `?role=${role}` : ""}`),
    toggleActive: (id) => api.put(`/admin/users/${id}/toggle-active`),
    changeRole: (id, role) => api.put(`/admin/users/${id}/role`, { role }),
    getAnalytics: () => api.get("/admin/analytics"),
    getHiringTrends: (months = 6) => api.get(`/admin/analytics/trends?months=${months}`),
    getAuditLogs: (take) => api.get(`/admin/audit-logs${take ? `?take=${take}` : ""}`),
    getSystemHealth: () => api.get("/admin/system-health"),
};