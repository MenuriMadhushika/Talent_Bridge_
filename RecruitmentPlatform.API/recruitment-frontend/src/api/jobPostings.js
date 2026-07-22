import { api } from "./client";

export const jobPostingsApi = {
    list: (keyword) => api.get(`/jobpostings${keyword ? `?keyword=${encodeURIComponent(keyword)}` : ""}`),
    getById: (id) => api.get(`/jobpostings/${id}`),
    getRecommended: () => api.get("/jobpostings/recommended"),
    create: (dto) => api.post("/jobpostings", dto),
    update: (id, dto) => api.put(`/jobpostings/${id}`, dto),
    close: (id) => api.put(`/jobpostings/${id}/close`),
};