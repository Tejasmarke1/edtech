import apiClient from '../../api/client';

const ratingsApi = {
  getPending: async () => {
    const { data } = await apiClient.get('/ratings/pending');
    return data;
  },

  submit: async ({ session_id, stars, review_text }) => {
    const { data } = await apiClient.post('/ratings', {
      session_id,
      stars,
      review_text,
    });
    return data;
  },
};

export default ratingsApi;
