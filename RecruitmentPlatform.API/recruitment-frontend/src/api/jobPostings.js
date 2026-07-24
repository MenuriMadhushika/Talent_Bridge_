import { api } from "./client";
// Provides API methods for viewing, creating, updating, and closing job postings.
export const jobPostingsApi = {
    list: (keyword) => api.get(`/jobpostings${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`),
    getById: (id) => api.get(`/jobpostings/${id}`),
    getRecommended: () => api.get("/jobpostings/recommended"),
    create: (dto) => api.post("/jobpostings", dto),
    update: (id, dto) => api.put(`/jobpostings/${id}`, dto),
    close: (id) => api.put(`/jobpostings/${id}/close`),
};
