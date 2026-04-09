import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { Badge, Card, Button, Input } from '../../components/ui';
import RatingsSection from '../../components/ratings/RatingsSection';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

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
 * Student Profile Page
 * Displays student profile information and account settings
 */
export default function StudentProfile() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ full_name: '', dob: '', gender: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [stats, setStats] = useState({ avgRatingGiven: 0, ratingsGiven: 0, totalSessions: 0 });

  const displayName = profile?.full_name || user?.profile?.full_name || user?.user_name || 'Student';
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'N/A';
  const todayDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const initials = useMemo(() => {
    const parts = String(displayName).trim().split(' ').filter(Boolean);
    if (!parts.length) return 'S';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }, [displayName]);

  useEffect(() => {
    const loadProfileData = async () => {
      setIsLoading(true);
      try {
        const [profileRes, ratingsRes, sessionsRes] = await Promise.allSettled([
          apiClient.get('/students/profile'),
          apiClient.get('/ratings/history'),
          apiClient.get('/sessions/my?skip=0&limit=100'),
        ]);

        if (profileRes.status !== 'fulfilled') {
          throw profileRes.reason;
        }

        const p = profileRes.value.data;
        setProfile(p);
        setForm({
          full_name: p?.full_name || '',
          dob: p?.dob || '',
          gender: p?.gender || '',
        });

        const given = ratingsRes.status === 'fulfilled' ? (ratingsRes.value?.data?.given || []) : [];
        const avgRatingGiven = given.length
          ? given.reduce((sum, item) => sum + (item.stars || 0), 0) / given.length
          : 0;

        const sessions = sessionsRes.status === 'fulfilled'
          ? (sessionsRes.value?.data?.items || (Array.isArray(sessionsRes.value?.data) ? sessionsRes.value.data : []))
          : [];

        setStats({
          avgRatingGiven,
          ratingsGiven: given.length,
          totalSessions: sessions.length,
        });
      } catch (error) {
        toast.error(toErrorMessage(error, 'Failed to load profile data'));
      } finally {
        setIsLoading(false);
      }
    };

    loadProfileData();
  }, []);

  const onCancelEdit = () => {
    setForm({
      full_name: profile?.full_name || '',
      dob: profile?.dob || '',
      gender: profile?.gender || '',
    });
    setIsEditing(false);
  };

  const onSave = async () => {
    setIsSaving(true);
    try {
      const normalizedDob = form.dob || null;
      if (normalizedDob && normalizedDob > todayDate) {
        toast.error('Date of birth cannot be in the future');
        setIsSaving(false);
        return;
      }

      const payload = {
        full_name: form.full_name?.trim() || null,
        dob: normalizedDob,
        gender: form.gender || null,
      };
      const { data } = await apiClient.put('/students/profile', payload);
      setProfile(data);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error(toErrorMessage(error, 'Failed to update profile'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="py-12 text-lg text-slate-700 font-medium">Loading profile...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white to-slate-50 px-6 py-5 shadow-sm">
        <h2 className="text-4xl font-bold text-slate-900 mb-2">My Profile</h2>
        <p className="text-lg text-slate-700">Manage your personal details, stats, and learning history.</p>
      </div>

      <Card className="mb-6 border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xl">
              {initials}
            </div>
            <div>
              <h3 className="text-2xl font-bold text-slate-900">{displayName}</h3>
              <p className="text-base text-slate-700">{user?.user_name || 'Student'}</p>
            </div>
          </div>
          {!isEditing ? (
            <Button variant="outline" onClick={() => setIsEditing(true)}>Edit Profile</Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCancelEdit} disabled={isSaving}>Cancel</Button>
              <Button onClick={onSave} loading={isSaving}>Save</Button>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border border-slate-200 shadow-sm">
          <p className="text-base text-slate-700 font-medium">Average Rating Given</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{stats.avgRatingGiven.toFixed(1)} / 5</p>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <p className="text-base text-slate-700 font-medium">Ratings Submitted</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.ratingsGiven}</p>
        </Card>
        <Card className="border border-slate-200 shadow-sm">
          <p className="text-base text-slate-700 font-medium">Sessions Attended</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalSessions}</p>
        </Card>
      </div>

      <Card className="mb-6 border border-slate-200 shadow-sm">
        <p className="text-base text-slate-700 font-medium">Member Since</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{memberSince}</p>
      </Card>

      <Card className="mb-6 border border-slate-200 shadow-sm">
        <h3 className="text-2xl font-bold text-slate-900 mb-4">Personal Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-1.5">Full Name</label>
            {isEditing ? (
              <Input
                size="lg"
                value={form.full_name}
                onChange={(e) => setForm((prev) => ({ ...prev, full_name: e.target.value }))}
                placeholder="Your full name"
              />
            ) : (
              <p className="text-base text-slate-900">{profile?.full_name || 'Not set'}</p>
            )}
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-1.5">Email</label>
            <p className="text-base text-slate-900">{user?.user_name || 'N/A'}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-base font-semibold text-slate-800 mb-1.5">Date of Birth</label>
              {isEditing ? (
                <Input
                  type="date"
                  size="lg"
                  value={form.dob}
                  max={todayDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
                />
              ) : (
                <p className="text-base text-slate-900">
                  {profile?.dob ? new Date(profile.dob).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Not set'}
                </p>
              )}
            </div>
            <div>
              <label className="block text-base font-semibold text-slate-800 mb-1.5">Gender</label>
              {isEditing ? (
                <select
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-base text-slate-900 bg-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  value={form.gender}
                  onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                >
                  <option value="">Prefer not to say</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              ) : (
                <p className="text-base text-slate-900">{profile?.gender ? `${profile.gender.charAt(0).toUpperCase()}${profile.gender.slice(1)}` : 'Not set'}</p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-base font-semibold text-slate-800 mb-1.5">Role</label>
            <Badge variant="soft" color="blue">{user?.role || 'student'}</Badge>
          </div>
        </div>
      </Card>

      <Card className="border border-slate-200 shadow-sm">
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Session History</h3>
        <p className="text-base text-slate-700 mb-4">View all upcoming and past sessions from your session workspace.</p>
        <Button variant="outline" onClick={() => navigate('/my-sessions')}>Go to My Sessions</Button>
      </Card>

      <RatingsSection
        showReceived={false}
        title="My Ratings"
        subtitle="Review the ratings you submitted for completed sessions."
      />
    </div>
  );
}
