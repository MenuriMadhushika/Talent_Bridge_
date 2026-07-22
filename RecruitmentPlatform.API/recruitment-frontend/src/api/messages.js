import { api } from "./client";

export const messagesApi = {
    getForApplication: (jobApplicationId) => api.get(`/messages?jobApplicationId=${jobApplicationId}`),
    send: (jobApplicationId, body) => api.post("/messages", { jobApplicationId, body }),
};