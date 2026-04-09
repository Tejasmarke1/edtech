import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import teacherAPI from '../../features/teacher/api';
import { Spinner } from '../ui';

/**
 * Guard component that redirects to onboarding wizard if teacher hasn't completed it.
 * Works as a route wrapper and renders nested routes through Outlet.
 */
export default function TeacherOnboardingGuard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [onboardingComplete, setOnboardingComplete] = useState(null);
  const [loading, setLoading] = useState(true);

  const inferCompletionFromProfile = (profile) => {
    if (!profile) return false;
    const hasBio = Boolean(profile.bio && String(profile.bio).trim());
    const hasPricing =
      Number(profile.per_30_mins_charges || 0) > 0 &&
      Number(profile.group_per_student_charges || 0) > 0;
    return hasBio && hasPricing;
  };

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        if (user?.role !== 'teacher') {
          setLoading(false);
          return;
        }

        // Prefer explicit flag when backend provides it; otherwise infer from required profile fields.
        const profile = await teacherAPI.getProfile();
        const hasExplicitFlag = typeof profile?.onboarding_complete === 'boolean';
        const isComplete = hasExplicitFlag
          ? profile.onboarding_complete
          : inferCompletionFromProfile(profile);

        setOnboardingComplete(isComplete);

        // If not complete, redirect to wizard
        if (!isComplete) {
          navigate('/teacher/onboarding', { replace: true });
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error);
        // Default to allowing access on error (backend might not have profile yet)
        setOnboardingComplete(true);
      } finally {
        setLoading(false);
      }
    };

    checkOnboardingStatus();
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Spinner />
          <p className="text-slate-600 mt-4">Checking profile...</p>
        </div>
      </div>
    );
  }

  // If onboarding is not complete, it will have already redirected in useEffect
  if (!onboardingComplete && user?.role === 'teacher') {
    return null;
  }

  return <Outlet />;
}
