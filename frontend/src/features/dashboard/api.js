import apiClient from '../../api/client';

export const getMySessions = async () => {
  const response = await apiClient.get('/sessions/my?skip=0&limit=100');
  return response.data;
};
