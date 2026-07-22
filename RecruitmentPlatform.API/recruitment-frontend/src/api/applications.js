import { api } from "./client";

export const applicationsApi = {
  create: (dto) => api.post("/applications", dto),
  getMine: () => api.get("/applications/me"),
  getById: (id) => api.get(`/applications/${id}`),
  getForPosting: (jobPostingId, status) => {
    const params = [];
    if (jobPostingId) params.push(`jobPostingId=${jobPostingId}`);
    if (status) params.push(`status=${status}`);
    return api.get(`/applications${params.length ? `?${params.join("&")}` : ""}`);
  },
  updateStatus: (id, status) => api.put(`/applications/${id}/status`, { status }),
  withdraw: (id) => api.put(`/applications/${id}/withdraw`),
};
