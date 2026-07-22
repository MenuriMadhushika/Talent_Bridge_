import { api } from "./client";

export const messagesApi = {
    // Retrieves all messages related to a specific job application.
    getForApplication: (jobApplicationId) => api.get(`/messages?jobApplicationId=${jobApplicationId}`),
    send: (jobApplicationId, body) => api.post("/messages", { jobApplicationId, body }),
};
