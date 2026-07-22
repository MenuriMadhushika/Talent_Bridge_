import { api } from "./client";

export const evaluationsApi = {
  create: (dto) => api.post("/evaluations", dto),
  getForApplication: (jobApplicationId) => api.get(`/evaluations?jobApplicationId=${jobApplicationId}`),
};
