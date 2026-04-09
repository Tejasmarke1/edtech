import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardBody, CardFooter, Button, Input, Badge, Spinner } from '../../components/ui';
import { useAuthStore } from '../../stores/authStore';
import { useTeacherSubjects } from '../../features/teacher/hooks';
import teacherAPI from '../../features/teacher/api';
import apiClient from '../../api/client';
import { toast } from 'react-hot-toast';

/**
 * Multi-step teacher onboarding wizard
 * Steps: 1. Subjects, 2. Videos, 3. Availability, 4. Profile Info
 */
export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    subjects: availableSubjects,
    loading: subjectsLoading,
    error: subjectsError,
  } = useTeacherSubjects();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Step 1: Subjects
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [subjectTopics, setSubjectTopics] = useState({});
  const [subjectSearch, setSubjectSearch] = useState('');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  
  // Step 2: Videos
  const [videos, setVideos] = useState({});
  const [videoInputs, setVideoInputs] = useState({});
  const [videoModeBySubject, setVideoModeBySubject] = useState({});
  const [videoFileInputs, setVideoFileInputs] = useState({});
  const [uploadingBySubject, setUploadingBySubject] = useState({});
  
  // Step 3: Availability
  const [availability, setAvailability] = useState([]);
  const [newSlot, setNewSlot] = useState({ day: 'Monday', start_time: '09:00', end_time: '17:00' });
  
  // Step 4: Profile Info
  const [bio, setBio] = useState('');
  const [perSessionPrice, setPerSessionPrice] = useState('');
  const [groupSessionPrice, setGroupSessionPrice] = useState('');
  const [upiId, setUpiId] = useState('');
  const welcomeName = user?.full_name || user?.name || user?.user_name || 'Teacher';

  const canProceedStep1 = selectedSubjects.length > 0;
  const canProceedStep2 = () => {
    // Each selected subject needs either 2×5min videos or 1×10min video
    return selectedSubjects.every(subId => {
      const subvideos = videos[subId] || [];
      const totalDuration = subvideos.reduce((sum, v) => sum + (v.duration || 0), 0);
      return (subvideos.length >= 2 && totalDuration >= 10) || totalDuration >= 10;
    });
  };
  const hasPendingVideoDrafts = () => {
    return selectedSubjects.some((subId) => {
      const mode = getVideoMode(subId);
      const input = getVideoInput(subId);
      if (mode === 'link') {
        return Boolean(input.url?.trim() || input.title?.trim());
      }
      return Boolean(videoFileInputs[subId]?.file);
    });
  };
  const hasActiveVideoUpload = () => selectedSubjects.some((subId) => Boolean(uploadingBySubject[subId]));
  const canProceedStep3 = availability.length > 0;

  const filteredSubjects = useMemo(() => {
    const query = subjectSearch.trim().toLowerCase();
    return availableSubjects.filter((subject) => {
      const matchesSearch = !query || subject.name.toLowerCase().includes(query);
      const matchesSelection = !showSelectedOnly || selectedSubjects.includes(subject.sub_id);
      return matchesSearch && matchesSelection;
    });
  }, [availableSubjects, selectedSubjects, showSelectedOnly, subjectSearch]);
  
  const canSubmit = step === 4 && perSessionPrice && groupSessionPrice && bio.length > 0;

  // Handle subject selection
  const toggleSubject = (subjectId) => {
    if (selectedSubjects.includes(subjectId)) {
      const newSelected = selectedSubjects.filter(s => s !== subjectId);
      setSelectedSubjects(newSelected);
      const newTopics = { ...subjectTopics };
      delete newTopics[subjectId];
      setSubjectTopics(newTopics);
    } else {
      if (selectedSubjects.length >= 5) {
        toast.error('Maximum 5 subjects allowed');
        return;
      }
      setSelectedSubjects([...selectedSubjects, subjectId]);
    }
  };

  // Handle adding topic to subject
  const addTopicToSubject = (subjectId, topic) => {
    if (!topic.trim()) return;
    const currentTopics = subjectTopics[subjectId] || [];
    if (!currentTopics.includes(topic)) {
      setSubjectTopics({
        ...subjectTopics,
        [subjectId]: [...currentTopics, topic],
      });
    }
  };

  // Handle removing topic from subject
  const removeTopicFromSubject = (subjectId, topic) => {
    const currentTopics = subjectTopics[subjectId] || [];
    setSubjectTopics({
      ...subjectTopics,
      [subjectId]: currentTopics.filter(t => t !== topic),
    });
  };

  // Handle video addition
  const getVideoInput = (subjectId) => videoInputs[subjectId] || { title: '', url: '', duration: '5' };
  const getVideoMode = (subjectId) => videoModeBySubject[subjectId] || 'link';

  const updateVideoInput = (subjectId, patch) => {
    setVideoInputs((prev) => ({
      ...prev,
      [subjectId]: {
        ...getVideoInput(subjectId),
        ...patch,
      },
    }));
  };

  const updateVideoMode = (subjectId, mode) => {
    setVideoModeBySubject((prev) => ({ ...prev, [subjectId]: mode }));
  };

  const updateVideoFileInput = (subjectId, file) => {
    setVideoFileInputs((prev) => {
      const existing = prev[subjectId];
      if (existing?.previewUrl) {
        URL.revokeObjectURL(existing.previewUrl);
      }

      if (!file) {
        return {
          ...prev,
          [subjectId]: null,
        };
      }

      return {
        ...prev,
        [subjectId]: {
          file,
          previewUrl: URL.createObjectURL(file),
        },
      };
    });
  };

  const isValidHttpUrl = (value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const getYouTubeEmbedUrl = (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.hostname.includes('youtu.be')) {
        const id = parsed.pathname.replace('/', '').trim();
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.hostname.includes('youtube.com')) {
        const id = parsed.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      return null;
    } catch {
      return null;
    }
  };

  const getVimeoEmbedUrl = (url) => {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('vimeo.com')) return null;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    } catch {
      return null;
    }
  };

  const getVideoSourceLabel = (url) => {
    try {
      const host = new URL(url).hostname.toLowerCase();
      if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
      if (host.includes('vimeo.com')) return 'Vimeo';
      if (host.includes('loom.com')) return 'Loom';
      if (host.includes('drive.google.com')) return 'Google Drive';
      return 'External URL';
    } catch {
      return 'External URL';
    }
  };

  const renderVideoPreview = (url) => {
    if (!url || !isValidHttpUrl(url)) return null;

    const youtube = getYouTubeEmbedUrl(url);
    if (youtube) {
      return (
        <iframe
          src={youtube}
          title="YouTube preview"
          className="w-full h-44 rounded border border-slate-200"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    const vimeo = getVimeoEmbedUrl(url);
    if (vimeo) {
      return (
        <iframe
          src={vimeo}
          title="Vimeo preview"
          className="w-full h-44 rounded border border-slate-200"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
        />
      );
    }

    const lower = url.toLowerCase();
    if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg')) {
      return (
        <video className="w-full rounded border border-slate-200" controls src={url}>
          Your browser does not support video preview.
        </video>
      );
    }

    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-sm text-blue-700 hover:text-blue-800 font-medium"
      >
        Open preview link in new tab
      </a>
    );
  };

  const handlePasteVideoUrl = async (subjectId) => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text?.trim()) {
        toast.error('Clipboard is empty');
        return;
      }
      updateVideoInput(subjectId, { url: text.trim() });
    } catch {
      toast.error('Could not read clipboard. Paste manually.');
    }
  };

  const handleAddVideo = async (subjectId) => {
    const input = getVideoInput(subjectId);
    const mode = getVideoMode(subjectId);
    const title = input.title?.trim();
    const duration = parseInt(input.duration, 10);
    let finalUrl = input.url?.trim();

    if (mode === 'upload') {
      const fileItem = videoFileInputs[subjectId];
      const file = fileItem?.file;
      if (!file) {
        toast.error('Please choose a video file first');
        return;
      }
      if (!file.type?.startsWith('video/')) {
        toast.error('Only video files are allowed');
        return;
      }

      try {
        setUploadingBySubject((prev) => ({ ...prev, [subjectId]: true }));
        const upload = await teacherAPI.createVideoUpload({
          filename: file.name,
          content_type: file.type,
        });
        await teacherAPI.uploadVideoBinary(upload.upload_url, file, file.type);
        const finalized = await teacherAPI.finalizeVideoUpload(upload.upload_id);
        finalUrl = finalized.file_url;
      } catch (err) {
        toast.error(err?.message || 'Video file upload failed');
        return;
      } finally {
        setUploadingBySubject((prev) => ({ ...prev, [subjectId]: false }));
      }
    }

    if (!finalUrl || !isValidHttpUrl(finalUrl)) {
      toast.error('Please provide a valid video URL (http/https)');
      return;
    }

    if (isNaN(duration) || duration <= 0) {
      toast.error('Duration must be a positive number');
      return;
    }

    if (mode === 'upload' && duration > 10) {
      toast.error('Each demo video must be 10 minutes or less');
      return;
    }

    const newVideo = {
      title: title || `Demo Video ${(videos[subjectId]?.length || 0) + 1}`,
      url: finalUrl,
      duration,
    };
    
    if (!videos[subjectId]) {
      setVideos({ ...videos, [subjectId]: [newVideo] });
    } else {
      setVideos({
        ...videos,
        [subjectId]: [...videos[subjectId], newVideo],
      });
    }

    updateVideoInput(subjectId, { title: '', url: '', duration: '5' });
    updateVideoFileInput(subjectId, null);
    toast.success('Video added');
  };

  // Handle removing video
  const handleRemoveVideo = (subjectId, index) => {
    const updated = videos[subjectId].filter((_, i) => i !== index);
    setVideos({ ...videos, [subjectId]: updated });
  };

  // Handle adding availability slot
  const handleAddSlot = () => {
    if (!newSlot.day || !newSlot.start_time || !newSlot.end_time) {
      toast.error('Please fill all slot details');
      return;
    }

    setAvailability([...availability, newSlot]);
    setNewSlot({ day: 'Monday', start_time: '09:00', end_time: '17:00' });
  };

  // Handle removing availability slot
  const handleRemoveSlot = (index) => {
    setAvailability(availability.filter((_, i) => i !== index));
  };

  // Submit onboarding
  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Please complete all fields');
      return;
    }

    try {
      setLoading(true);

      const perSession = Number(perSessionPrice);
      const groupSession = Number(groupSessionPrice);
      if (!Number.isFinite(perSession) || !Number.isFinite(groupSession)) {
        toast.error('Please enter valid numeric pricing values');
        return;
      }
      if (!Number.isInteger(perSession) || !Number.isInteger(groupSession)) {
        toast.error('Pricing must be a whole number (no decimals)');
        return;
      }
      if (perSession < 0 || groupSession < 0) {
        toast.error('Pricing cannot be negative');
        return;
      }

      const normalizeUrl = (value) => String(value || '').trim().replace(/\/+$/, '').toLowerCase();

      const dayToEnum = {
        monday: 'mon',
        tuesday: 'tue',
        wednesday: 'wed',
        thursday: 'thu',
        friday: 'fri',
        saturday: 'sat',
        sunday: 'sun',
      };

      // Avoid duplicate-add failures when a subject is already present.
      const existingSubjectsResponse = await apiClient.get('/teachers/subjects');
      const existingSubjects = new Set((existingSubjectsResponse.data || []).map((s) => s.sub_id));

      // Add all subjects
      for (const subjectId of selectedSubjects) {
        if (!existingSubjects.has(subjectId)) {
          await apiClient.post('/teachers/subjects', {
            sub_id: subjectId,
          });
          existingSubjects.add(subjectId);
        }

        // Add videos for this subject, skipping already saved links.
        const existingVideosResponse = await apiClient.get(`/teachers/subjects/${subjectId}/videos`);
        const existingVideoItems = Array.isArray(existingVideosResponse.data) ? existingVideosResponse.data : [];
        const existingVideoUrls = new Set(existingVideoItems.map((v) => normalizeUrl(v.video_url)));

        const subjectVideos = videos[subjectId] || [];
        let remainingSlots = Math.max(0, 2 - existingVideoItems.length);

        for (const video of subjectVideos) {
          const normalized = normalizeUrl(video.url);
          if (!normalized || existingVideoUrls.has(normalized)) {
            continue;
          }
          if (remainingSlots <= 0) {
            break;
          }

          await apiClient.post(`/teachers/subjects/${subjectId}/videos`, {
            video_url: video.url,
            duration_seconds: Number(video.duration) * 60,
          });
          existingVideoUrls.add(normalized);
          remainingSlots -= 1;
        }
      }

      // Add availability slots, skipping duplicates already on server.
      const existingAvailabilityResponse = await apiClient.get('/teachers/availability', {
        params: { skip: 0, limit: 100 },
      });
      const existingAvailabilityItems = Array.isArray(existingAvailabilityResponse.data?.items)
        ? existingAvailabilityResponse.data.items
        : [];
      const existingAvailability = new Set(
        existingAvailabilityItems.map((slot) => `${slot.day_of_week}|${slot.start_time}|${slot.end_time}`)
      );

      for (const slot of availability) {
        const dayKey = String(slot.day || '').toLowerCase();
        const dayOfWeek = dayToEnum[dayKey];
        if (!dayOfWeek) {
          throw new Error(`Invalid day selected: ${slot.day}`);
        }

        const slotKey = `${dayOfWeek}|${slot.start_time}|${slot.end_time}`;
        if (existingAvailability.has(slotKey)) {
          continue;
        }

        await apiClient.post('/teachers/availability', {
          day_of_week: dayOfWeek,
          start_time: slot.start_time,
          end_time: slot.end_time,
        });
        existingAvailability.add(slotKey);
      }

      // Update profile
      await teacherAPI.updateProfile({
        bio,
        per_30_mins_charges: perSession,
        group_per_student_charges: groupSession,
        upi_id: upiId || null,
      });

      // Mark onboarding complete when backend exposes this endpoint.
      try {
        await teacherAPI.completeOnboarding();
      } catch {
        // Some backend versions infer completion from profile readiness.
      }

      toast.success('Onboarding complete! Welcome aboard!');
      navigate('/teacher-dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      const detail = error?.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : (Array.isArray(detail)
          ? detail.map((d) => d?.msg || 'Validation error').join(', ')
          : (error?.message || 'Failed to complete onboarding. Please try again.'));
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-blue-50 to-indigo-50 py-6 md:py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className="flex flex-col items-center flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all ${
                    s <= step
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {s}
                </div>
                <p className="text-xs mt-2 text-slate-600">
                  {['Subjects', 'Videos', 'Availability', 'Profile'][s - 1]}
                </p>
              </div>
            ))}
          </div>
          <div className="h-1 bg-slate-200 rounded-full">
            <div
              className="h-full bg-blue-600 rounded-full transition-all"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg -m-6 mb-4 p-6">
            <h2 className="text-2xl font-bold">Teacher Onboarding</h2>
            <p className="text-blue-100 text-sm mt-1">
              Step {step} of 4: {['Subjects', 'Videos', 'Availability', 'Profile'][step - 1]}
            </p>
          </CardHeader>

          <CardBody className="space-y-6">
            {/* STEP 1: Subjects */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-3">
                    Select Subjects You Teach (max 5)
                  </label>

                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3 space-y-3">
                    <div className="flex flex-col md:flex-row gap-2">
                      <Input
                        value={subjectSearch}
                        onChange={(e) => setSubjectSearch(e.target.value)}
                        placeholder="Search subjects..."
                      />
                      <Button
                        type="button"
                        variant={showSelectedOnly ? 'primary' : 'outline'}
                        onClick={() => setShowSelectedOnly((prev) => !prev)}
                      >
                        {showSelectedOnly ? 'Showing Selected' : 'Show Selected Only'}
                      </Button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                      <span>{selectedSubjects.length}/5 selected</span>
                      {selectedSubjects.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubjects([]);
                            setSubjectTopics({});
                          }}
                          className="text-blue-700 hover:text-blue-800 font-semibold"
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>

                  {subjectsLoading && (
                    <div className="flex items-center gap-2 text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      <Spinner size="sm" variant="gray" />
                      <span className="text-sm">Loading subjects...</span>
                    </div>
                  )}

                  {!subjectsLoading && subjectsError && (
                    <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                      Failed to load subjects. Please refresh and try again.
                    </div>
                  )}

                  {!subjectsLoading && !subjectsError && availableSubjects.length === 0 && (
                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      No subjects are available yet. Please contact support or try again later.
                    </div>
                  )}

                  {!subjectsLoading && !subjectsError && availableSubjects.length > 0 && filteredSubjects.length === 0 && (
                    <div className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg p-3">
                      No subjects match your filters.
                    </div>
                  )}

                  {!subjectsLoading && !subjectsError && filteredSubjects.length > 0 && (
                    <div className="max-h-80 overflow-y-auto pr-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filteredSubjects.map(subject => (
                          <button
                            key={subject.sub_id}
                            type="button"
                            onClick={() => toggleSubject(subject.sub_id)}
                            className={`p-3 rounded-lg border-2 transition-all text-left ${
                              selectedSubjects.includes(subject.sub_id)
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-slate-200 bg-white hover:border-blue-300'
                            }`}
                          >
                            <p className="font-medium text-slate-900">{subject.name}</p>
                            {selectedSubjects.includes(subject.sub_id) && (
                              <Badge variant="solid" color="blue" className="mt-2">
                                Selected
                              </Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSubjects.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedSubjects.map((subjectId) => {
                        const subject = availableSubjects.find((s) => s.sub_id === subjectId);
                        if (!subject) return null;
                        return (
                          <Badge
                            key={subjectId}
                            variant="outlined"
                            color="blue"
                            className="cursor-pointer hover:opacity-80"
                            onClick={() => toggleSubject(subjectId)}
                          >
                            {subject.name} ×
                          </Badge>
                        );
                      })}
                    </div>
                  )}
                </div>

                {selectedSubjects.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-slate-200">
                    <p className="text-sm font-semibold text-slate-900">Add Topics for Selected Subjects</p>
                    {selectedSubjects.map(subjectId => {
                      const subject = availableSubjects.find(s => s.sub_id === subjectId);
                      const topics = subjectTopics[subjectId] || [];
                      return (
                        <div key={subjectId} className="space-y-2">
                          <label className="text-sm font-medium text-slate-700">{subject?.name} Topics</label>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add topic (e.g., Algebra, Geometry)"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  addTopicToSubject(subjectId, e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </div>
                          {topics.length > 0 && (
                            <div className="flex gap-2 flex-wrap">
                              {topics.map(topic => (
                                <Badge
                                  key={topic}
                                  variant="outlined"
                                  color="blue"
                                  className="cursor-pointer hover:opacity-70"
                                  onClick={() => removeTopicFromSubject(subjectId, topic)}
                                >
                                  {topic} ✕
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Videos */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Add demo links quickly for each subject. You can paste YouTube, Vimeo, Loom, Google Drive public links, or direct video URLs. Each subject needs either 2×5-minute videos or 1×10-minute video.
                </p>
                <p className="text-xs text-slate-500">
                  Note: Pasted links/files are drafts. Click Add for each subject to include them.
                </p>
                {selectedSubjects.map(subjectId => {
                  const subject = availableSubjects.find(s => s.sub_id === subjectId);
                  const subVideos = videos[subjectId] || [];
                  const input = getVideoInput(subjectId);
                  const mode = getVideoMode(subjectId);
                  const fileItem = videoFileInputs[subjectId];
                  const isUploading = !!uploadingBySubject[subjectId];
                  const totalDuration = subVideos.reduce((sum, v) => sum + v.duration, 0);
                  const isComplete = (subVideos.length >= 2 && totalDuration >= 10) || totalDuration >= 10;

                  return (
                    <div key={subjectId} className="border border-slate-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-slate-900">{subject?.name}</p>
                        {isComplete ? (
                          <Badge variant="solid" color="green">
                            ✓ Complete
                          </Badge>
                        ) : (
                          <Badge variant="soft" color="amber">
                            Incomplete
                          </Badge>
                        )}
                      </div>

                      {subVideos.length > 0 && (
                        <div className="space-y-2">
                          {subVideos.map((video, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded">
                              <div className="flex-1">
                                <p className="text-sm font-medium text-slate-900">{video.title}</p>
                                <p className="text-xs text-slate-500">{video.duration} minutes • {getVideoSourceLabel(video.url)}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveVideo(subjectId, idx)}
                              >
                                Remove
                              </Button>
                            </div>
                          ))}
                          <p className="text-xs text-slate-600">
                            Total: {totalDuration} minutes / {isComplete ? 'Complete ✓' : 'Needs more'}
                          </p>
                        </div>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className={`px-3 py-1.5 text-xs rounded border ${mode === 'link' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                            onClick={() => updateVideoMode(subjectId, 'link')}
                          >
                            Paste Link
                          </button>
                          <button
                            type="button"
                            className={`px-3 py-1.5 text-xs rounded border ${mode === 'upload' ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                            onClick={() => updateVideoMode(subjectId, 'upload')}
                          >
                            Upload File
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                          <div className="md:col-span-4">
                            <Input
                              placeholder="Video title (optional)"
                              value={input.title}
                              onChange={(e) => updateVideoInput(subjectId, { title: e.target.value })}
                              size="sm"
                            />
                          </div>
                          {mode === 'link' ? (
                            <div className="md:col-span-5">
                              <Input
                                placeholder="Paste video URL"
                                value={input.url}
                                onChange={(e) => updateVideoInput(subjectId, { url: e.target.value })}
                                size="sm"
                              />
                            </div>
                          ) : (
                            <div className="md:col-span-5">
                              <input
                                type="file"
                                accept="video/*"
                                onChange={(e) => updateVideoFileInput(subjectId, e.target.files?.[0] || null)}
                                className="w-full text-sm rounded-lg border-2 border-slate-200 bg-white px-3 py-2"
                              />
                            </div>
                          )}
                          <div className="md:col-span-1">
                            <Input
                              type="number"
                              min="1"
                              max={mode === 'upload' ? '10' : undefined}
                              placeholder="Min"
                              value={input.duration}
                              onChange={(e) => updateVideoInput(subjectId, { duration: e.target.value })}
                              size="sm"
                            />
                          </div>
                          <div className="md:col-span-2 flex gap-2">
                            {mode === 'link' && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handlePasteVideoUrl(subjectId)}
                              >
                                Paste
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleAddVideo(subjectId)}
                              disabled={isUploading}
                            >
                              {isUploading ? 'Uploading...' : 'Add'}
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500">Quick duration:</span>
                          {[5, 10].map((mins) => (
                            <button
                              key={mins}
                              type="button"
                              className={`px-2 py-1 rounded text-xs border ${String(input.duration) === String(mins)
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'}`}
                              onClick={() => updateVideoInput(subjectId, { duration: String(mins) })}
                            >
                              {mins} min
                            </button>
                          ))}
                          {mode === 'link' && input.url && (
                            <Badge variant="soft" color="blue">
                              {getVideoSourceLabel(input.url)}
                            </Badge>
                          )}
                          {mode === 'upload' && fileItem?.file && (
                            <Badge variant="soft" color="green">
                              {fileItem.file.name}
                            </Badge>
                          )}
                        </div>

                        {mode === 'link' && input.url && (
                          <div className="bg-slate-50 border border-slate-200 rounded p-2">
                            {renderVideoPreview(input.url)}
                          </div>
                        )}
                        {mode === 'upload' && fileItem?.previewUrl && (
                          <div className="bg-slate-50 border border-slate-200 rounded p-2">
                            <video className="w-full rounded border border-slate-200" controls src={fileItem.previewUrl}>
                              Your browser does not support video preview.
                            </video>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* STEP 3: Availability */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 mb-4">
                  Add your available time slots. Students can book during these times.
                </p>

                {availability.length > 0 && (
                  <div className="space-y-2">
                    {availability.map((slot, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-slate-50 p-3 rounded">
                        <div>
                          <p className="font-medium text-slate-900">{slot.day}</p>
                          <p className="text-sm text-slate-600">
                            {slot.start_time} - {slot.end_time}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSlot(idx)}
                        >
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-slate-200 pt-4 space-y-3">
                  <p className="text-sm font-medium text-slate-900">Add New Slot</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      value={newSlot.day}
                      onChange={(e) => setNewSlot({ ...newSlot, day: e.target.value })}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      {days.map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    <input
                      type="time"
                      value={newSlot.start_time}
                      onChange={(e) => setNewSlot({ ...newSlot, start_time: e.target.value })}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="time"
                      value={newSlot.end_time}
                      onChange={(e) => setNewSlot({ ...newSlot, end_time: e.target.value })}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleAddSlot}
                    className="w-full"
                  >
                    Add Slot
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 4: Profile Info */}
            {step === 4 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    Bio / About You (max 1000 characters)
                  </label>
                  <textarea
                    maxLength={1000}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell students about your teaching experience, qualifications, and teaching style..."
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 text-sm resize-vertical"
                    rows={4}
                  />
                  <p className="text-xs text-slate-500 mt-1">{bio.length}/1000</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Per 30-min Session (Rs.)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={perSessionPrice}
                      onChange={(e) => setPerSessionPrice(e.target.value)}
                      placeholder="e.g., 10"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-900 mb-2">
                      Group Session (per student, Rs.)
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      value={groupSessionPrice}
                      onChange={(e) => setGroupSessionPrice(e.target.value)}
                      placeholder="e.g., 7"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">
                    UPI ID (Optional - for payouts)
                  </label>
                  <Input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g., yourname@upi"
                  />
                </div>
              </div>
            )}
          </CardBody>

          {/* Navigation Buttons */}
          <CardFooter className="flex gap-3 justify-between">
            <Button
              variant="outline"
              onClick={() => setStep(Math.max(1, step - 1))}
              disabled={step === 1 || loading}
            >
              Previous
            </Button>

            <div className="flex gap-3">
              {step < 4 && (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={
                    loading ||
                    subjectsLoading ||
                    (step === 1 && !canProceedStep1) ||
                    (step === 2 && (!canProceedStep2() || hasPendingVideoDrafts() || hasActiveVideoUpload())) ||
                    (step === 3 && !canProceedStep3)
                  }
                >
                  Next
                </Button>
              )}
              {step === 4 && (
                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  disabled={!canSubmit || loading}
                  className="flex items-center gap-2"
                >
                  {loading && <Spinner size="sm" />}
                  {loading ? 'Completing...' : 'Complete Onboarding'}
                </Button>
              )}
            </div>
          </CardFooter>
        </Card>

        <p className="text-center text-sm text-slate-600 mt-6">
          {`Welcome, ${welcomeName}! Let's get your profile set up so students can find you.`}
        </p>
      </div>
    </div>
  );
}
