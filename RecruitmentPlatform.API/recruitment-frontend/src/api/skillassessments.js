import { api } from "./client";
// Provides API methods for managing candidate skill assessments.
export const skillAssessmentsApi = {
    getMine: () => api.get("/skillassessments/me"),
    addMine: (dto) => api.post("/skillassessments/me", dto),
    getForCandidate: (candidateProfileId) => api.get(`/skillassessments/candidate/${candidateProfileId}`),
};
