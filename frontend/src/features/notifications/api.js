import apiClient from '../../api/client';

const notificationsApi = {
  list: async ({ skip = 0, limit = 10 } = {}) => {
    const { data } = await apiClient.get('/notifications', {
      params: { skip, limit },
    });
    return data;
  },

  getUnreadCount: async () => {
    const { data } = await apiClient.get('/notifications/unread-count');
    return data;
  },

  markAsRead: async (notificationId) => {
    const { data } = await apiClient.put(`/notifications/${notificationId}/read`);
    return data;
  },
};

export default notificationsApi;
