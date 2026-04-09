import React, { useMemo, useState } from 'react';
import { Button, Modal } from '../ui';
import { useAuthStore } from '../../stores/authStore';

function StarButton({ active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-3xl leading-none transition-colors ${active ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}
      aria-label={`Rate ${active ? 'selected' : 'unselected'} star`}
    >
      ★
    </button>
  );
}

export default function RatingModal({
  isOpen,
  pendingRating,
  submitting,
  onSubmit,
  onSkip,
}) {
  const userName = useAuthStore((s) => s.user?.user_name);
  const [stars, setStars] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [error, setError] = useState('');

  const teacherName = useMemo(() => {
    if (!pendingRating) return '';
    return pendingRating.teacher_id || userName || '';
  }, [pendingRating, userName]);

  const handleSubmit = async () => {
    if (stars < 1 || stars > 5) {
      setError('Please select a star rating from 1 to 5.');
      return;
    }
    setError('');
    await onSubmit({
      session_id: pendingRating.session_id,
      stars,
      review_text: reviewText.trim() || null,
    });
    setStars(0);
    setReviewText('');
  };

  if (!pendingRating) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onSkip}
      title="Rate Your Teacher"
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onSkip} disabled={submitting}>
            Skip for now
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Submit Rating
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
          <div className="text-sm text-slate-500">Session</div>
          <div className="font-semibold text-slate-900">{pendingRating.topic_description || 'Tutoring Session'}</div>
          <div className="text-sm text-slate-600 mt-1">Teacher: {teacherName}</div>
          <div className="text-xs text-slate-500 mt-1">
            {new Date(pendingRating.session_date).toLocaleString()}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Your rating</label>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((value) => (
              <StarButton key={value} active={value <= stars} onClick={() => setStars(value)} />
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Review (optional)</label>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            maxLength={2000}
            rows={4}
            className="w-full border border-slate-300 rounded-lg px-3 py-2"
            placeholder="Share feedback about your teacher and the session"
          />
          <div className="text-xs text-slate-500 mt-1">{reviewText.length}/2000</div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  );
}
