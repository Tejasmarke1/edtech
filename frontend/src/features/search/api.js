/**
 * Search API wrapper for finding teachers
 */
import apiClient from '../../api/client';

const searchAPI = {
  /**
   * Search teachers by topic with filters and pagination
   */
  searchTeachers: async (query = {}) => {
    try {
      const params = new URLSearchParams();
      
      if (query.topic) params.append('topic', query.topic);
      if (query.skip !== undefined) params.append('skip', query.skip);
      if (query.limit !== undefined) params.append('limit', query.limit);
      if (query.minRating !== undefined && query.minRating !== null) params.append('min_rating', query.minRating);
      if (query.maxPrice !== undefined && query.maxPrice !== null) params.append('max_price', query.maxPrice);
      if (query.minPrice !== undefined && query.minPrice !== null) params.append('min_price', query.minPrice);
      if (query.subject) params.append('subject', query.subject);
      if (query.day) params.append('day', query.day);
      if (query.sortBy) params.append('sort_by', query.sortBy);

      const queryString = params.toString();
      const url = `/search${queryString ? `?${queryString}` : ''}`;
      
      const { data } = await apiClient.get(url);
      return {
        teachers: data.items || [],
        total: data.total || 0,
        skip: data.skip || 0,
        limit: data.limit || 20,
      };
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  },

  /**
   * Get full teacher details
   */
  getTeacherDetail: async (teacherId) => {
    try {
      const { data } = await apiClient.get(`/search/teachers/${teacherId}/detail`);
      return data;
    } catch (error) {
      console.error('Failed to fetch teacher detail:', error);
      throw error;
    }
  },

  /**
   * Get list of available subjects for filtering
   */
  getSubjects: async () => {
    try {
      const { data } = await apiClient.get('/subjects');
      return data || [];
    } catch (error) {
      console.error('Failed to fetch subjects:', error);
      throw error;
    }
  },
};

export default searchAPI;
