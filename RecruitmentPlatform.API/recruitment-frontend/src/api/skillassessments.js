import { api } from "./client";

export const skillAssessmentsApi = {
    getMine: () => api.get("/skillassessments/me"),
    addMine: (dto) => api.post("/skillassessments/me", dto),
    getForCandidate: (candidateProfileId) => api.get(`/skillassessments/candidate/${candidateProfileId}`),
};