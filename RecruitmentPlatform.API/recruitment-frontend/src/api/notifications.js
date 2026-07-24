import { api } from "./client";

export const notificationsApi = {
  getMine: () => api.get("/notifications/me"),
  // Retrieves the number of unread notifications for the logged-in user.
  getUnreadCount: () => api.get("/notifications/me/unread-count"),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put("/notifications/me/read-all"),
};
