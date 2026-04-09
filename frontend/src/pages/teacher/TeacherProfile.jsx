import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, CardFooter, Button, Input, Badge, Modal, Spinner } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherProfile, useTeacherSubjects, useAddSubject, useRemoveSubject } from '../../features/teacher/hooks';
import teacherAPI from '../../features/teacher/api';
import RatingsSection from '../../components/ratings/RatingsSection';
import { toast } from 'react-hot-toast';
import apiClient from '../../api/client';
import paymentsApi from '../../features/payments/api';

function toErrorMessage(error, fallback = 'Something went wrong.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const msg = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.msg || item.message || '';
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
    if (msg) return msg;
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || fallback;
  }
  return error?.message || fallback;
}

/**
 * Teacher Profile Page
 * Displays and allows editing of teacher profile, subjects, videos, availability, and pricing
 */
export default function TeacherProfile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { profile, loading: profileLoading, refetch } = useTeacherProfile();
  const { subjects: availableSubjects } = useTeacherSubjects();
  const { addSubject, loading: addSubjectLoading } = useAddSubject();
  const { removeSubject, loading: removeSubjectLoading } = useRemoveSubject();

  const [editMode, setEditMode] = useState(null); // null | 'bio' | 'subjects' | 'videos' | 'availability'
  const [bio, setBio] = useState('');
  const [perSessionPrice, setPerSessionPrice] = useState('');
  const [groupSessionPrice, setGroupSessionPrice] = useState('');
  const [upiId, setUpiId] = useState('');

  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherVideos, setTeacherVideos] = useState({});
  const [teacherAvailability, setTeacherAvailability] = useState([]);
  const [removeSubjectEntryId, setRemoveSubjectEntryId] = useState(null);
  const [deleteVideoTarget, setDeleteVideoTarget] = useState(null);
  const [deleteAvailabilitySlotId, setDeleteAvailabilitySlotId] = useState(null);

  const [videoModalSubjectId, setVideoModalSubjectId] = useState(null);
  const [videoTitle, setVideoTitle] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [videoDuration, setVideoDuration] = useState('');
  const [videoFormError, setVideoFormError] = useState('');
  const [playbackVideo, setPlaybackVideo] = useState(null);
  const [playbackUrl, setPlaybackUrl] = useState('');
  const [playbackLoading, setPlaybackLoading] = useState(false);

  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [availabilityDay, setAvailabilityDay] = useState('Monday');
  const [availabilityStartTime, setAvailabilityStartTime] = useState('09:00');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('17:00');
  const [availabilityFormError, setAvailabilityFormError] = useState('');

  const [walletSummary, setWalletSummary] = useState({
    total_earned: 0,
    total_withdraw: 0,
    current_balance: 0,
  });
  const [teacherStats, setTeacherStats] = useState({ avgRating: 0, totalTaught: 0 });
  const personalInfoRef = useRef(null);
  const subjectsRef = useRef(null);
  const availabilityRef = useRef(null);

  const displayName = user?.profile?.full_name || user?.name || user?.user_name || 'Teacher';
  const personalName = user?.profile?.full_name || user?.name || displayName || 'N/A';
  const personalEmail = user?.user_name || profile?.user_name || 'N/A';
  const initials = useMemo(() => {
    const parts = String(displayName).trim().split(' ').filter(Boolean);
    if (!parts.length) return 'T';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [displayName]);

  const toDayLabel = (value) => {
    const map = {
      mon: 'Monday',
      tue: 'Tuesday',
      wed: 'Wednesday',
      thu: 'Thursday',
      fri: 'Friday',
      sat: 'Saturday',
      sun: 'Sunday',
    };
    return map[value] || value;
  };

  const toDayCode = (value) => {
    const map = {
      Monday: 'mon',
      Tuesday: 'tue',
      Wednesday: 'wed',
      Thursday: 'thu',
      Friday: 'fri',
      Saturday: 'sat',
      Sunday: 'sun',
    };
    return map[value] || value;
  };

  const toYouTubeEmbedUrl = (url) => {
    if (!url) return null;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.replace(/^www\./, '').toLowerCase();

      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
        const videoId = parsed.searchParams.get('v');
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }

      if (host === 'youtu.be') {
        const videoId = parsed.pathname.replace('/', '').trim();
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      }

      return null;
    } catch {
      return null;
    }
  };

  const isDirectVideoUrl = (url) => {
    if (!url) return false;
    const lower = url.toLowerCase();
    return /\.(mp4|webm|ogg)(\?|#|$)/.test(lower) || lower.includes('/teacher-videos/');
  };

  const loadTeacherAssets = useCallback(async () => {
    try {
      const [subjectsRes, availabilityRes] = await Promise.all([
        teacherAPI.getTeacherSubjects(),
        teacherAPI.getAvailability(),
      ]);

      const mappedSubjects = (subjectsRes || []).map((subject) => ({
        entry_id: subject.id,
        sub_id: subject.sub_id,
        name: subject.subject_name || subject.sub_id,
        topics: [],
      }));

      const videosPerSubject = await Promise.all(
        mappedSubjects.map((subject) => teacherAPI.getVideos(subject.sub_id).catch(() => []))
      );

      const mappedVideos = {};
      mappedSubjects.forEach((subject, index) => {
        mappedVideos[subject.sub_id] = (videosPerSubject[index] || []).map((video, vIndex) => ({
          ...video,
          title: video.title || `Demo Video ${vIndex + 1}`,
          duration_minutes: Math.max(1, Math.round((video.duration_seconds || 0) / 60)),
        }));
      });

      const availabilityItems = Array.isArray(availabilityRes?.items)
        ? availabilityRes.items
        : Array.isArray(availabilityRes)
          ? availabilityRes
          : [];

      const mappedAvailability = availabilityItems.map((slot) => ({
        id: slot.id,
        day: toDayLabel(slot.day_of_week || slot.day),
        start_time: slot.start_time,
        end_time: slot.end_time,
      }));

      setTeacherSubjects(mappedSubjects);
      setTeacherVideos(mappedVideos);
      setTeacherAvailability(mappedAvailability);
    } catch {
      // Keep profile screen usable even if optional sections fail.
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio || '');
    setPerSessionPrice(profile.per_30_mins_charges ?? profile.per_session_price ?? '');
    setGroupSessionPrice(profile.group_per_student_charges ?? profile.group_session_price ?? '');
    setUpiId(profile.upi_id || '');
  }, [profile]);

  useEffect(() => {
    loadTeacherAssets();
  }, [loadTeacherAssets]);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const [walletRes, ratingsRes, sessionsRes] = await Promise.allSettled([
          paymentsApi.getTeacherWallet(),
          apiClient.get('/ratings/history'),
          apiClient.get('/sessions/my?skip=0&limit=100'),
        ]);

        const wallet = walletRes.status === 'fulfilled' ? walletRes.value : null;
        setWalletSummary({
          total_earned: wallet?.total_earned ?? 0,
          total_withdraw: wallet?.total_withdraw ?? 0,
          current_balance: wallet?.current_balance ?? 0,
        });

        const received = ratingsRes.status === 'fulfilled' ? (ratingsRes.value?.data?.received || []) : [];
        const avgRating = received.length
          ? received.reduce((acc, row) => acc + (row.stars || 0), 0) / received.length
          : 0;
        const sessionItems = sessionsRes.status === 'fulfilled'
          ? (sessionsRes.value?.data?.items || (Array.isArray(sessionsRes.value?.data) ? sessionsRes.value.data : []))
          : [];
        const taughtCompleted = sessionItems.filter((s) => s.teacher_id === user?.user_name && s.status === 'Completed').length;
        setTeacherStats({ avgRating, totalTaught: taughtCompleted });
      } catch {
        // Summary widgets are non-blocking.
      }
    };

    loadSummary();
  }, [user?.user_name]);

  const handleSaveBio = async () => {
    try {
      const normalizedPerSession = perSessionPrice === '' ? 0 : Number(perSessionPrice);
      const normalizedGroupSession = groupSessionPrice === '' ? 0 : Number(groupSessionPrice);

      if (!Number.isFinite(normalizedPerSession) || normalizedPerSession < 0) {
        toast.error('Per 30-min price must be a valid non-negative number.');
        return;
      }
      if (!Number.isFinite(normalizedGroupSession) || normalizedGroupSession < 0) {
        toast.error('Group session price must be a valid non-negative number.');
        return;
      }

      await teacherAPI.updateProfile({
        bio,
        per_30_mins_charges: Math.round(normalizedPerSession),
        group_per_student_charges: Math.round(normalizedGroupSession),
        upi_id: upiId.trim() || null,
      });
      await refetch();
      await loadTeacherAssets();
      setEditMode(null);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error(toErrorMessage(error, 'Failed to update profile'));
    }
  };

  const handleAddSubject = async (subjectId) => {
    try {
      await addSubject(subjectId, []);
      await refetch();
      await loadTeacherAssets();
    } catch {
      toast.error('Failed to add subject');
    }
  };

  const handleRemoveSubject = async (entryId) => {
    try {
      await removeSubject(entryId);
      await refetch();
      await loadTeacherAssets();
      setRemoveSubjectEntryId(null);
    } catch {
      toast.error('Failed to remove subject');
    }
  };

  const openAddVideoModal = (subjectId) => {
    setVideoModalSubjectId(subjectId);
    setVideoTitle('');
    setVideoUrl('');
    setVideoDuration('');
    setVideoFormError('');
  };

  const handleAddVideo = async () => {
    const duration = parseInt(videoDuration, 10);
    if (!videoUrl || !videoTitle || !videoDuration) {
      setVideoFormError('All video fields are required.');
      return;
    }

    if (isNaN(duration) || duration <= 0) {
      toast.error('Duration must be a positive number');
      return;
    }

    try {
      await teacherAPI.addVideo(videoModalSubjectId, {
        video_url: videoUrl,
        duration_seconds: duration * 60,
      });
      await refetch();
      await loadTeacherAssets();
      toast.success('Video added successfully!');
      setVideoModalSubjectId(null);
    } catch {
      toast.error('Failed to add video');
    }
  };

  const handleDeleteVideo = async () => {
    try {
      await teacherAPI.deleteVideo(deleteVideoTarget.subjectId, deleteVideoTarget.videoId);
      await refetch();
      await loadTeacherAssets();
      setDeleteVideoTarget(null);
      toast.success('Video deleted');
    } catch {
      toast.error('Failed to delete video');
    }
  };

  const handleOpenVideoPlayer = async (video) => {
    setPlaybackVideo(video);
    setPlaybackLoading(true);
    setPlaybackUrl(video.video_url || '');

    try {
      const access = await teacherAPI.getVideoAccessUrl(video.id);
      if (access?.video_url) {
        setPlaybackUrl(access.video_url);
      }
    } catch {
      // Keep fallback URL if access endpoint fails.
    } finally {
      setPlaybackLoading(false);
    }
  };

  const openAvailabilityModal = () => {
    setAvailabilityDay('Monday');
    setAvailabilityStartTime('09:00');
    setAvailabilityEndTime('17:00');
    setAvailabilityFormError('');
    setIsAvailabilityModalOpen(true);
  };

  const handleAddAvailability = async () => {
    if (!availabilityDay || !availabilityStartTime || !availabilityEndTime) {
      setAvailabilityFormError('Please provide day, start time, and end time.');
      return;
    }

    if (availabilityStartTime >= availabilityEndTime) {
      setAvailabilityFormError('End time must be after start time.');
      return;
    }

    try {
      await teacherAPI.createAvailability({
        day_of_week: toDayCode(availabilityDay),
        start_time: availabilityStartTime,
        end_time: availabilityEndTime,
      });
      await refetch();
      await loadTeacherAssets();
      toast.success('Availability slot added!');
      setIsAvailabilityModalOpen(false);
    } catch {
      toast.error('Failed to add availability');
    }
  };

  const handleDeleteAvailability = async (slotId) => {
    try {
      await teacherAPI.deleteAvailability(slotId);
      await refetch();
      await loadTeacherAssets();
      setDeleteAvailabilitySlotId(null);
      toast.success('Slot deleted');
    } catch {
      toast.error('Failed to delete availability');
    }
  };

  const scrollToSection = (sectionRef, mode) => {
    setEditMode(mode);
    setTimeout(() => {
      sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5 shadow-sm">
        <h2 className="text-4xl font-bold text-slate-900 mb-2">Teacher Profile</h2>
        <p className="text-lg text-slate-700">Manage your subjects, videos, availability, and pricing</p>
      </div>

      <Card className="mb-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xl">
              {initials}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">{displayName}</h3>
              <p className="text-base text-slate-700">{personalEmail}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => scrollToSection(personalInfoRef, 'bio')}>Edit Profile</Button>
            <Button variant="outline" onClick={() => scrollToSection(availabilityRef, 'availability')}>Manage Availability</Button>
            <Button variant="secondary" onClick={() => navigate('/teacher-wallet')}>View Earnings</Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm uppercase tracking-wide text-slate-600 font-medium">Average Rating</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{teacherStats.avgRating.toFixed(1)} / 5</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm uppercase tracking-wide text-slate-600 font-medium">Sessions Taught</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{teacherStats.totalTaught}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="text-sm uppercase tracking-wide text-slate-600 font-medium">Current Balance</p>
            <p className="text-2xl font-bold text-emerald-700 mt-1">Rs. {walletSummary.current_balance}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border border-slate-200 shadow-sm">
          <p className="text-base text-slate-700 font-medium">Total Earned</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">Rs. {walletSummary.total_earned}</p>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <p className="text-base text-slate-700 font-medium">Total Withdrawn</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">Rs. {walletSummary.total_withdraw}</p>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <p className="text-base text-slate-700 font-medium">UPI Status</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{upiId ? 'Configured' : 'Pending'}</p>
        </Card>
      </div>

      {/* Personal Information */}
      <div ref={personalInfoRef}>
      <Card className="mb-6 border border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-slate-900">Personal Information</h3>
            {editMode !== 'bio' && <Button size="sm" variant="outlined" onClick={() => setEditMode('bio')}>Edit</Button>}
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          {editMode === 'bio' ? (
            <>
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-2">Name</label>
                <p className="text-base text-slate-900">{personalName}</p>
              </div>
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-2">Email</label>
                <p className="text-base text-slate-900">{personalEmail}</p>
              </div>
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-2">Bio</label>
                <textarea
                  maxLength={1000}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 resize-vertical"
                  rows={4}
                />
                <p className="text-sm text-slate-600 mt-1">{bio.length}/1000</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-base font-semibold text-slate-800 mb-2">Per 30-min Session (Rs.)</label>
                  <Input
                    type="number"
                    size="lg"
                    min="0"
                    step="0.50"
                    value={perSessionPrice}
                    onChange={(e) => setPerSessionPrice(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-base font-semibold text-slate-800 mb-2">Group Session (Rs.)</label>
                  <Input
                    type="number"
                    size="lg"
                    min="0"
                    step="0.50"
                    value={groupSessionPrice}
                    onChange={(e) => setGroupSessionPrice(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-2">UPI ID (Optional)</label>
                <Input
                  type="text"
                  size="lg"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                /></div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-1.5">Name</label>
                <p className="text-base text-slate-900">{personalName}</p>
              </div>
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-1.5">Email</label>
                <p className="text-base text-slate-900">{personalEmail}</p>
              </div>
              <div>
                <label className="block text-base font-semibold text-slate-800 mb-1.5">Bio</label>
                <p className="text-base text-slate-700">{bio || <span className="italic text-slate-500">No bio added yet</span>}</p>
              </div>
            </>
          )}
        </CardBody>
        {editMode === 'bio' && (
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={() => setEditMode(null)}>Cancel</Button>
            <Button onClick={handleSaveBio}>Save Changes</Button>
          </CardFooter>
        )}
      </Card>
      </div>

      {/* Subjects & Topics */}
      <div ref={subjectsRef}>
      <Card className="mb-6 border border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">
              Subjects & Topics {teacherSubjects.length > 0 && <Badge variant="solid" color="blue">{teacherSubjects.length}</Badge>}
            </h3>
            <Button size="sm" variant="outlined" onClick={() => setEditMode('subjects')}>Manage</Button>
          </div>
        </CardHeader>
        <CardBody>
          {editMode === 'subjects' ? (
            <div className="space-y-3">
              <p className="text-base text-slate-700 mb-4">Add or remove subjects</p>
              <div className="grid grid-cols-2 gap-3">
                {availableSubjects.map(subject => {
                  const isSelected = teacherSubjects.some(s => s.sub_id === subject.sub_id);
                  return (
                    <div key={subject.sub_id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{subject.name}</p>
                        {isSelected && <p className="text-xs text-green-600">✓ Added</p>}
                      </div>
                      {isSelected ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRemoveSubjectEntryId(teacherSubjects.find(s => s.sub_id === subject.sub_id).entry_id)}
                          disabled={removeSubjectLoading}
                        >
                          Remove
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outlined"
                          onClick={() => handleAddSubject(subject.sub_id)}
                          disabled={addSubjectLoading}
                        >
                          Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : teacherSubjects.length > 0 ? (
            <div className="space-y-2">
              {teacherSubjects.map(subject => (
                <div key={subject.entry_id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{subject.name}</p>
                    {subject.topics && subject.topics.length > 0 && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {subject.topics.map(topic => (
                          <Badge key={topic} variant="soft" color="blue">{topic}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 mb-4">No subjects added yet</p>
              <p className="text-sm text-slate-600">Add subjects and topics to help students find you</p>
            </div>
          )}
        </CardBody>
      </Card>
      </div>

      {/* Demo Videos */}
      <Card className="mb-6 border border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">
              Demo Videos {Object.values(teacherVideos).flat().length > 0 && <Badge variant="solid" color="blue">{Object.values(teacherVideos).flat().length}</Badge>}
            </h3>
            {teacherSubjects.length > 0 && <Button size="sm" variant="outlined" onClick={() => setEditMode('videos')}>Manage</Button>}
          </div>
        </CardHeader>
        <CardBody>
          {editMode === 'videos' ? (
            <div className="space-y-4">
              {teacherSubjects.map(subject => (
                <div key={subject.entry_id} className="border border-slate-200 rounded-lg p-4">
                  <h4 className="font-medium text-slate-900 mb-3">{subject.name}</h4>
                  <div className="space-y-2 mb-3">
                    {(teacherVideos[subject.sub_id] || []).map(video => (
                      <div key={video.id} className="flex items-center justify-between bg-slate-50 p-2 rounded">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{video.title}</p>
                          <p className="text-xs text-slate-600">{video.duration_minutes} minutes</p>
                        </div>
                        <div className="flex gap-2">
                          <a
                            href={video.video_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            Source
                          </a>
                          <Button size="sm" variant="outlined" onClick={() => handleOpenVideoPlayer(video)}>
                            Play in App
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeleteVideoTarget({ subjectId: subject.sub_id, videoId: video.id })}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outlined"
                    onClick={() => openAddVideoModal(subject.sub_id)}
                    className="w-full"
                  >
                    + Add Video
                  </Button>
                </div>
              ))}
            </div>
          ) : Object.values(teacherVideos).flat().length > 0 ? (
            <div className="space-y-4">
              {teacherSubjects.map(subject => {
                const videos = teacherVideos[subject.sub_id] || [];
                if (videos.length === 0) return null;
                return (
                  <div key={subject.entry_id} className="border-l-4 border-blue-500 pl-4">
                    <p className="font-medium text-slate-900 mb-2">{subject.name}</p>
                    <div className="space-y-2">
                      {videos.map(video => (
                        <div key={video.id} className="flex items-center justify-between gap-3 text-slate-700">
                          <div className="flex items-center gap-2">
                            <span className="text-blue-500">▶</span>
                            <span>{video.title} ({video.duration_minutes}min)</span>
                          </div>
                          <a
                            href={video.video_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200"
                          >
                            Source
                          </a>
                          <Button size="sm" variant="outlined" onClick={() => handleOpenVideoPlayer(video)}>
                            Play in App
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 mb-4">No demo videos uploaded yet</p>
              <p className="text-sm text-slate-600">Upload demo videos to showcase your teaching expertise</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Availability */}
      <div ref={availabilityRef}>
      <Card className="mb-6 border border-slate-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-900">
              Teaching Availability {teacherAvailability.length > 0 && <Badge variant="solid" color="blue">{teacherAvailability.length}</Badge>}
            </h3>
            <Button size="sm" variant="outlined" onClick={() => setEditMode('availability')}>Manage</Button>
          </div>
        </CardHeader>
        <CardBody>
          {editMode === 'availability' ? (
            <div className="space-y-3">
              {teacherAvailability.map(slot => (
                <div key={slot.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-900">{slot.day}</p>
                    <p className="text-sm text-slate-600">{slot.start_time} - {slot.end_time}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteAvailabilitySlotId(slot.id)}>Delete</Button>
                </div>
              ))}
              <Button variant="outlined" onClick={openAvailabilityModal} className="w-full">
                + Add Slot
              </Button>
            </div>
          ) : teacherAvailability.length > 0 ? (
            <div className="space-y-2">
              {teacherAvailability.map(slot => (
                <div key={slot.id} className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900">{slot.day}</p>
                    <p className="text-sm text-slate-600">{slot.start_time} - {slot.end_time}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-slate-500 mb-4">No availability slots set</p>
              <p className="text-sm text-slate-600">Set your available time slots for students to book sessions</p>
            </div>
          )}
        </CardBody>
      </Card>
      </div>

      {/* Pricing */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader>
          <h3 className="text-xl font-bold text-slate-900">Pricing</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-1.5">Per 30-min Session</label>
            <p className="text-slate-700 text-lg font-semibold">Rs. {perSessionPrice || '0'}</p>
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-1.5">Group Session (per student)</label>
            <p className="text-slate-700 text-lg font-semibold">Rs. {groupSessionPrice || '0'}</p>
          </div>
          {upiId && (
            <div>
              <label className="block text-base font-semibold text-slate-800 mb-1.5">UPI ID</label>
              <p className="text-base text-slate-700">{upiId}</p>
            </div>
          )}
        </CardBody>
      </Card>

      <RatingsSection
        showGiven={false}
        showReceived={true}
        title="Student Feedback"
        subtitle="See ratings and reviews received from students."
      />

      <Modal
        isOpen={Boolean(removeSubjectEntryId)}
        onClose={() => setRemoveSubjectEntryId(null)}
        title="Remove Subject"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setRemoveSubjectEntryId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => handleRemoveSubject(removeSubjectEntryId)}
              loading={removeSubjectLoading}
            >
              Remove
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">Removing this subject will also remove associated demo videos.</p>
      </Modal>

      <Modal
        isOpen={Boolean(deleteVideoTarget)}
        onClose={() => setDeleteVideoTarget(null)}
        title="Delete Demo Video"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setDeleteVideoTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteVideo}>
              Delete
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">This video will be permanently deleted.</p>
      </Modal>

      <Modal
        isOpen={Boolean(deleteAvailabilitySlotId)}
        onClose={() => setDeleteAvailabilitySlotId(null)}
        title="Delete Availability Slot"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setDeleteAvailabilitySlotId(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => handleDeleteAvailability(deleteAvailabilitySlotId)}>
              Delete
            </Button>
          </>
        )}
      >
        <p className="text-slate-600">This slot will no longer be available for session requests.</p>
      </Modal>

      <Modal
        isOpen={Boolean(videoModalSubjectId)}
        onClose={() => setVideoModalSubjectId(null)}
        title="Add Demo Video"
        size="md"
        footer={(
          <>
            <Button variant="outline" onClick={() => setVideoModalSubjectId(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddVideo}>
              Save Video
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Video Title</label>
            <Input value={videoTitle} onChange={(e) => setVideoTitle(e.target.value)} placeholder="e.g., Algebra Basics" />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Video URL</label>
            <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Duration (minutes)</label>
            <Input type="number" min="1" value={videoDuration} onChange={(e) => setVideoDuration(e.target.value)} />
          </div>
          {videoFormError && <p className="text-sm text-red-600" role="alert">{videoFormError}</p>}
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(playbackVideo)}
        onClose={() => {
          setPlaybackVideo(null);
          setPlaybackUrl('');
          setPlaybackLoading(false);
        }}
        title={playbackVideo?.title || 'Video Player'}
        size="lg"
        footer={(
          <Button
            variant="outline"
            onClick={() => {
              setPlaybackVideo(null);
              setPlaybackUrl('');
              setPlaybackLoading(false);
            }}
          >
            Close
          </Button>
        )}
      >
        {playbackLoading ? (
          <div className="py-8 flex justify-center">
            <Spinner />
          </div>
        ) : toYouTubeEmbedUrl(playbackUrl) ? (
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200">
            <iframe
              title={playbackVideo?.title || 'YouTube video'}
              src={toYouTubeEmbedUrl(playbackUrl)}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        ) : isDirectVideoUrl(playbackUrl) ? (
          <video className="w-full rounded-lg border border-slate-200" controls src={playbackUrl} />
        ) : (
          <div className="space-y-3">
            <p className="text-slate-700">This provider cannot be embedded directly. Use Source to open it.</p>
            <a
              href={playbackUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-sm px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Open Source Link
            </a>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={isAvailabilityModalOpen}
        onClose={() => setIsAvailabilityModalOpen(false)}
        title="Add Availability Slot"
        size="md"
        footer={(
          <>
            <Button variant="outline" onClick={() => setIsAvailabilityModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleAddAvailability}>
              Save Slot
            </Button>
          </>
        )}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-2">Day</label>
            <select
              value={availabilityDay}
              onChange={(e) => setAvailabilityDay(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Start Time</label>
              <Input type="time" value={availabilityStartTime} onChange={(e) => setAvailabilityStartTime(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">End Time</label>
              <Input type="time" value={availabilityEndTime} onChange={(e) => setAvailabilityEndTime(e.target.value)} />
            </div>
          </div>
          {availabilityFormError && <p className="text-sm text-red-600" role="alert">{availabilityFormError}</p>}
        </div>
      </Modal>
    </div>
  );
}
