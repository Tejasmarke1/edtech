import React, { useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { usePendingRatings, useSubmitRating } from '../../features/ratings/hooks';
import RatingModal from '../modals/RatingModal';

function toErrorMessage(err, fallback = 'Failed to submit rating') {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const message = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.msg || item.message || '';
        return '';
      })
      .filter(Boolean)
      .join(' ')
      .trim();
    if (message) return message;
  }
  if (detail && typeof detail === 'object') {
    return detail.msg || detail.message || fallback;
  }
  return err?.message || fallback;
}

export default function RatingsPromptManager() {
  const { accessToken, isInitialized, user } = useAuthStore();
  const enabled = useMemo(
    () => Boolean(isInitialized && accessToken && user?.role === 'student'),
    [isInitialized, accessToken, user?.role]
  );

  const {
    current,
    loading,
    dismissCurrent,
    removeCurrentAfterSubmit,
  } = usePendingRatings(enabled);

  const { submitting, submitRating } = useSubmitRating();

  const handleSubmit = async (payload) => {
    try {
      await submitRating(payload);
      toast.success('Thanks for your feedback!');
      removeCurrentAfterSubmit();
    } catch (err) {
      toast.error(toErrorMessage(err));
    }
  };

  const handleSkip = () => {
    dismissCurrent();
  };

  if (!enabled || loading || !current) return null;

  return (
    <RatingModal
      isOpen={Boolean(current)}
      pendingRating={current}
      submitting={submitting}
      onSubmit={handleSubmit}
      onSkip={handleSkip}
    />
  );
}
