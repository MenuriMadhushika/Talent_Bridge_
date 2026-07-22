import { api } from "./client";

function toQuery(params) {
    const q = Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&");
    return q ? `?${q}` : "";
}

export const candidateProfilesApi = {
    getMe: () => api.get("/candidateprofiles/me"),
    updateMe: (dto) => api.put("/candidateprofiles/me", dto),
    getById: (id) => api.get(`/candidateprofiles/${id}`),
    search: (params = {}) => api.get(`/candidateprofiles${toQuery(params)}`),

    getMyResumes: () => api.get("/candidateprofiles/me/resumes"),
    addResume: (dto) => api.post("/candidateprofiles/me/resumes", dto),
    uploadResume: (file, isPrimary) => {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("isPrimary", isPrimary ? "true" : "false");
        return api.postForm("/candidateprofiles/me/resumes/upload", formData);
    },
    setPrimaryResume: (resumeId) => api.put(`/candidateprofiles/me/resumes/${resumeId}/set-primary`),
    deleteResume: (resumeId) => api.del(`/candidateprofiles/me/resumes/${resumeId}`),

    exportMyData: () => api.get("/candidateprofiles/me/export"),
    deleteMyAccount: () => api.del("/candidateprofiles/me"),
};