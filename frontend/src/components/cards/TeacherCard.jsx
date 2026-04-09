import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, Button, Badge, Avatar } from '../ui';
import BookingModal from '../modals/BookingModal';
import searchAPI from '../../features/search/api';
import { toast } from 'react-hot-toast';

/**
 * Enhanced TeacherCard component for search rempacting converssults
 * Displays teacher info with subjects, pricing, availability, and CTAs
 */
export default function TeacherCard({ teacher, onBookClick }) {
  const navigate = useNavigate();
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingSubjects, setBookingSubjects] = useState(teacher?.subjects || []);
  const [bookingAvailability, setBookingAvailability] = useState(teacher?.availability || []);
  const [bookingTeacherName, setBookingTeacherName] = useState(teacher?.full_name || teacher?.user_name || 'Teacher');

  if (!teacher) return null;

  const teacherName = teacher.full_name || teacher.user_name || 'Teacher';
  const teacherId = teacher.user_name || teacher.id || teacher.user_id;
  const rating = Number(teacher.rating_avg || 0);
  const reviewCount = Number(teacher.rating_count || 0);

  // Extract unique days from availability
  const availableDays = teacher.availability
    ? [...new Set(teacher.availability.map(a => a.day_of_week || a.day))].slice(0, 3)
    : [];

  // Format availability text (e.g., "Mon 5-9 PM, Wed 2-6 PM")
  const formatAvailability = () => {
    if (!teacher.availability || teacher.availability.length === 0) {
      return 'Not available';
    }

    const dayGroups = {};
    teacher.availability.forEach(slot => {
      const day = String(slot.day_of_week || slot.day || '').replace('_', ' ');
      if (!dayGroups[day]) dayGroups[day] = [];
      dayGroups[day].push(`${slot.start_time}-${slot.end_time}`);
    });

    return Object.entries(dayGroups)
      .slice(0, 2)
      .map(([day, times]) => `${day.substring(0, 3)} ${times[0]}`)
      .join(', ')
      .concat(availableDays.length > 2 ? '...' : '');
  };

  // Format subjects text (max 2 with +X more)
  const formatSubjects = () => {
    if (!teacher.subjects || teacher.subjects.length === 0) return 'No subjects';

    const subjectNames = teacher.subjects
      .map((s) => s.subject_name || s.name || s.sub_id || s)
      .slice(0, 2);
    const remaining = Math.max(0, (teacher.subjects?.length || 0) - 2);

    return subjectNames.join(', ') + (remaining > 0 ? ` +${remaining} more` : '');
  };

  // Truncate bio to 2 lines (~120 chars)
  const bioSnippet = teacher.bio
    ? teacher.bio.substring(0, 120) + (teacher.bio.length > 120 ? '...' : '')
    : 'No bio available';

  // Extract initials from name
  const initials = teacherName
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'T';

  const openBookingModal = async () => {
    onBookClick?.(teacher);

    if (!teacherId) {
      toast.error('Teacher identifier is missing for booking.');
      return;
    }

    try {
      const detail = await searchAPI.getTeacherDetail(teacherId);
      setBookingTeacherName(detail.full_name || detail.user_name || teacherName);
      setBookingSubjects(detail.subjects || teacher.subjects || []);
      setBookingAvailability(detail.availability || teacher.availability || []);
    } catch (error) {
      console.error('Failed to fetch teacher details for booking:', error);
      setBookingTeacherName(teacherName);
      setBookingSubjects(teacher.subjects || []);
      setBookingAvailability(teacher.availability || []);
    } finally {
      setShowBookingModal(true);
    }
  };

  return (
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardBody className="space-y-4">
          {/* Header: Avatar, Name, Rating */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3 flex-1">
              <Avatar
                initials={initials}
                size="lg"
                className="flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-900 truncate">
                  {teacherName}
                </h3>
                <div className="flex items-center gap-1 mt-1">
                  {/* Stars */}
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} className={i < Math.round(rating) ? 'text-yellow-400' : 'text-slate-300'}>
                        ★
                      </span>
                    ))}
                  </div>
                  <span className="text-sm text-slate-600">
                    {rating.toFixed(1)} ({reviewCount} {reviewCount === 1 ? 'review' : 'reviews'})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Subjects & Topics */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Subjects</p>
            <p className="text-sm text-slate-700">{formatSubjects()}</p>
          </div>

          {/* Price */}
          <div className="flex items-center justify-between py-2 px-3 bg-blue-50 rounded-lg">
            <span className="text-sm font-medium text-slate-700">Per 30-min Session:</span>
            <span className="text-lg font-bold text-blue-600">
              Rs. {teacher.per_30_mins_charges || '0.00'}
            </span>
          </div>

          {/* Availability */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Available</p>
            <p className="text-sm text-slate-700">{formatAvailability()}</p>
          </div>

          {/* Bio Snippet */}
          <div className="py-2 px-3 bg-slate-50 rounded-lg">
            <p className="text-sm text-slate-600 line-clamp-2">{bioSnippet}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outlined"
              className="flex-1"
              onClick={() => {
                if (!teacherId) return;
                navigate(`/teachers/${encodeURIComponent(teacherId)}`);
              }}
            >
              View Profile
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={openBookingModal}
            >
              Book Now
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Booking Modal */}
      {showBookingModal && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={() => setShowBookingModal(false)}
          teacherId={teacherId}
          teacherName={bookingTeacherName}
          subjects={bookingSubjects}
          availability={bookingAvailability}
        />
      )}
    </>
  );
}
