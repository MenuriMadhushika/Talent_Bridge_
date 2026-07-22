// Imports the shared API client used to communicate with the backend.
import { api } from "./client";

export const authApi = {
  register: (dto) => api.post("/auth/register", dto, { auth: false }),
  login: (dto) => api.post("/auth/login", dto, { auth: false }),
};
