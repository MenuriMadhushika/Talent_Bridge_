import { api } from "./client";
// Provides API methods for scheduling, retrieving, and updating interviews.
export const interviewsApi = {
  schedule: (dto) => api.post("/interviews", dto),
  getForApplication: (jobApplicationId) => api.get(`/interviews?jobApplicationId=${jobApplicationId}`),
  getMine: () => api.get("/interviews/me"),
  update: (id, dto) => api.put(`/interviews/${id}`, dto),
};
