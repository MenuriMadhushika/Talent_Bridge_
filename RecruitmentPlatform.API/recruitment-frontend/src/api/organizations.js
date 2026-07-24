// Imports the shared API client used to communicate with the backend.
import { api } from "./client";

export const organizationsApi = {
  list: () => api.get("/organizations"),
  getDepartments: (organizationId) => api.get(`/organizations/${organizationId}/departments`),
  create: (dto) => api.post("/organizations", dto),
  createDepartment: (organizationId, dto) => api.post(`/organizations/${organizationId}/departments`, dto),
};
