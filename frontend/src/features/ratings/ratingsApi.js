import apiClient from '../../api/client';

const ratingsApi = {
  getHistory: async () => {
    const { data } = await apiClient.get('/ratings/history');
    return data;
  },
};

export default ratingsApi;
