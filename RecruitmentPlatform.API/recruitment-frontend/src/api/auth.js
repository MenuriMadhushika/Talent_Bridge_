import { api } from "./client";

export const authApi = {
  register: (dto) => api.post("/auth/register", dto, { auth: false }),
  login: (dto) => api.post("/auth/login", dto, { auth: false }),
};
