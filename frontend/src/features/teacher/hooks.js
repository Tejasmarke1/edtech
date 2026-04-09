/**
 * Custom hooks for teacher data fetching and mutations
 */
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import teacherAPI from './api';

export function useTeacherSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        const data = await teacherAPI.getSubjects();
        setSubjects(data);
      } catch (_err) {
        setError(_err.message);
        toast.error('Failed to load subjects');
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  return { subjects, loading, error };
}

export function useTeacherProfile() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const data = await teacherAPI.getProfile();
      setProfile(data);
    } catch (_err) {
      setError(_err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return { profile, loading, error, refetch: fetchProfile };
}

export function useAddSubject() {
  const [loading, setLoading] = useState(false);

  const addSubject = async (subjectId, topics) => {
    try {
      setLoading(true);
      await teacherAPI.addSubject(subjectId, topics);
      toast.success('Subject added successfully!');
      return true;
    } catch {
      toast.error('Failed to add subject');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { addSubject, loading };
}

export function useRemoveSubject() {
  const [loading, setLoading] = useState(false);

  const removeSubject = async (entryId) => {
    try {
      setLoading(true);
      await teacherAPI.removeSubject(entryId);
      toast.success('Subject removed');
      return true;
    } catch {
      toast.error('Failed to remove subject');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { removeSubject, loading };
}

export function useVideoManagement() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(false);

  const addVideo = async (subjectId, videoData) => {
    try {
      setLoading(true);
      await teacherAPI.addVideo(subjectId, videoData);
      toast.success('Video added successfully!');
      return true;
    } catch {
      toast.error('Failed to add video');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async (subjectId, videoId) => {
    try {
      setLoading(true);
      await teacherAPI.deleteVideo(subjectId, videoId);
      toast.success('Video removed');
      return true;
    } catch {
      toast.error('Failed to remove video');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { videos, setVideos, addVideo, deleteVideo, loading };
}

export function useAvailability() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchSlots = async () => {
      try {
        setLoading(true);
        const data = await teacherAPI.getAvailability();
        setSlots(data);
      } catch {
        toast.error('Failed to load availability slots');
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, []);

  const addSlot = async (slotData) => {
    try {
      await teacherAPI.createAvailability(slotData);
      toast.success('Slot added successfully!');
      return true;
    } catch {
      toast.error('Failed to add slot');
      return false;
    }
  };

  const updateSlot = async (slotId, slotData) => {
    try {
      await teacherAPI.updateAvailability(slotId, slotData);
      toast.success('Slot updated');
      return true;
    } catch {
      toast.error('Failed to update slot');
      return false;
    }
  };

  const deleteSlot = async (slotId) => {
    try {
      await teacherAPI.deleteAvailability(slotId);
      toast.success('Slot removed');
      return true;
    } catch {
      toast.error('Failed to remove slot');
      return false;
    }
  };

  return { slots, setSlots, addSlot, updateSlot, deleteSlot, loading };
}

export function useUpdateProfile() {
  const [loading, setLoading] = useState(false);

  const updateProfile = async (profileData) => {
    try {
      setLoading(true);
      await teacherAPI.updateProfile(profileData);
      toast.success('Profile updated successfully!');
      return true;
    } catch {
      toast.error('Failed to update profile');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { updateProfile, loading };
}
