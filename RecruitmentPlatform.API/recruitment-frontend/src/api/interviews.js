import { api } from "./client";

export const interviewsApi = {
  schedule: (dto) => api.post("/interviews", dto),
  getForApplication: (jobApplicationId) => api.get(`/interviews?jobApplicationId=${jobApplicationId}`),
  getMine: () => api.get("/interviews/me"),
  update: (id, dto) => api.put(`/interviews/${id}`, dto),
};
