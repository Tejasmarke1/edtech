/**
 * Teacher API calls and utilities
 */
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

export const teacherAPI = {
  // Get available subjects
  getSubjects: async () => {
    const response = await apiClient.get('/subjects');
    return response.data;
  },

  // Get teacher's selected subjects
  getTeacherSubjects: async () => {
    const response = await apiClient.get('/teachers/subjects');
    return response.data;
  },

  // Add subject
  addSubject: async (subjectId, topics = []) => {
    const response = await apiClient.post('/teachers/subjects', {
      sub_id: subjectId,
    });
    return response.data;
  },

  // Remove subject
  removeSubject: async (entryId) => {
    await apiClient.delete(`/teachers/subjects/${entryId}`);
  },

  // Get videos for subject
  getVideos: async (subjectId) => {
    const response = await apiClient.get(`/teachers/subjects/${subjectId}/videos`);
    return response.data;
  },

  // Add video (expects video_url, duration_minutes, title)
  addVideo: async (subjectId, videoData) => {
    const response = await apiClient.post(`/teachers/subjects/${subjectId}/videos`, videoData);
    return response.data;
  },

  // Delete video
  deleteVideo: async (subjectId, videoId) => {
    await apiClient.delete(`/teachers/subjects/${subjectId}/videos/${videoId}`);
  },

  // Resolve playable URL (supports signed/private backends)
  getVideoAccessUrl: async (videoId) => {
    const response = await apiClient.get(`/teachers/videos/${videoId}/access-url`);
    return response.data;
  },

  // Create upload URL (local upload-session service)
  createVideoUpload: async ({ filename, content_type }) => {
    const response = await apiClient.post('/teachers/uploads/create', {
      filename,
      content_type,
    });
    return response.data;
  },

  // Upload file bytes to the provided upload URL
  uploadVideoBinary: async (uploadUrl, file, contentType) => {
    const token = useAuthStore.getState().accessToken;
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType || 'application/octet-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: file,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Failed to upload video file');
    }
  },

  // Finalize uploaded file and retrieve public URL
  finalizeVideoUpload: async (uploadId) => {
    const response = await apiClient.post('/teachers/uploads/finalize', {
      upload_id: uploadId,
    });
    return response.data;
  },

  // Get availability slots
  getAvailability: async () => {
    const response = await apiClient.get('/teachers/availability');
    return response.data;
  },

  // Create availability slot
  createAvailability: async (slotData) => {
    const response = await apiClient.post('/teachers/availability', slotData);
    return response.data;
  },

  // Update availability slot
  updateAvailability: async (slotId, slotData) => {
    const response = await apiClient.put(`/teachers/availability/${slotId}`, slotData);
    return response.data;
  },

  // Delete availability slot
  deleteAvailability: async (slotId) => {
    await apiClient.delete(`/teachers/availability/${slotId}`);
  },

  // Get teacher profile
  getProfile: async () => {
    const response = await apiClient.get('/teachers/profile');
    return response.data;
  },

  // Update teacher profile
  updateProfile: async (profileData) => {
    const response = await apiClient.put('/teachers/profile', profileData);
    return response.data;
  },

  // Mark onboarding complete
  completeOnboarding: async () => {
    const response = await apiClient.post('/teachers/onboarding/complete');
    return response.data;
  },
};

export default teacherAPI;
