import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import BookingModal from '../../components/modals/BookingModal';
import apiClient from '../../api/client';
import toast from 'react-hot-toast';

function toMinutes(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return null;
  return Math.max(1, Math.round(Number(seconds) / 60));
}

export default function TeacherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const fetchTeacherDetail = async () => {
      setIsLoading(true);
      try {
        const { data } = await apiClient.get(`/search/teachers/${encodeURIComponent(id)}/detail`);
        setTeacher(data);
      } catch (error) {
        console.error('Failed to fetch teacher detail', error);
        toast.error(error?.response?.data?.detail || 'Failed to load teacher profile');
        setTeacher(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTeacherDetail();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (!teacher) return <div className="text-center py-12">Teacher not found.</div>;

  const subjects = teacher.subjects || [];
  const videos = teacher.videos || [];
  const availability = teacher.availability || [];
  const teacherName = teacher.full_name || teacher.user_name || 'Teacher';
  const ratingAvg = Number(teacher.rating_avg || 0);
  const ratingCount = Number(teacher.rating_count || 0);
  const initials = String(teacherName).slice(0, 1).toUpperCase();

  return (
    <div className="max-w-5xl mx-auto py-8 space-y-6">
      <Button variant="ghost" className="mb-6 -ml-4" onClick={() => navigate(-1)}>
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back
      </Button>

      <Card className="p-8">
        <div className="flex flex-col md:flex-row items-start gap-8">
          <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center font-bold text-3xl flex-shrink-0">
             {initials}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-slate-900">{teacherName}</h1>
            <p className="text-lg font-medium text-blue-600 mt-1">
              {subjects.map((s) => s.subject_name).join(', ') || 'General'}
            </p>

            <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
              <span className="text-amber-500">★</span>
              <span className="font-semibold text-slate-900">{ratingAvg.toFixed(1)}</span>
              <span>({ratingCount || 'N/A'} reviews)</span>
              <span className="text-slate-400">|</span>
              <span>Rs. {teacher.per_30_mins_charges || 0} / 30 min</span>
            </div>

            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2">About</h3>
              <p className="text-slate-700 leading-relaxed max-w-2xl">
                {teacher.bio || 'No biography added yet.'}
              </p>
            </div>

            <div className="mt-8">
              <Button onClick={() => setIsModalOpen(true)}>Book Session</Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Subjects</h3>
          {subjects.length === 0 ? (
            <p className="text-slate-500">No subjects listed yet.</p>
          ) : (
            <div className="space-y-2">
              {subjects.map((subject) => (
                <div key={subject.id || subject.sub_id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  {subject.subject_name || subject.sub_id}
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-slate-900 mb-3">Availability</h3>
          {availability.length === 0 ? (
            <p className="text-slate-500">No availability published.</p>
          ) : (
            <div className="space-y-2">
              {availability.slice(0, 6).map((slot) => (
                <div key={slot.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <span className="font-medium">{String(slot.day_of_week || '').toUpperCase()}</span>
                  <span className="mx-2 text-slate-400">•</span>
                  <span>{slot.start_time} - {slot.end_time}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h3 className="text-lg font-semibold text-slate-900 mb-3">Demo Videos</h3>
        {videos.length === 0 ? (
          <p className="text-slate-500">No demo videos available yet.</p>
        ) : (
          <div className="space-y-3">
            {videos.map((video) => (
              <div key={video.id} className="rounded-xl border border-slate-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">Demo Clip</p>
                  <p className="text-sm text-slate-600">Duration: {toMinutes(video.duration_seconds) || 'N/A'} min</p>
                </div>
                <a
                  href={video.video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Play Video
                </a>
              </div>
            ))}
          </div>
        )}
      </Card>

      <BookingModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        teacherId={teacher.user_name}
        teacherName={teacherName}
        subjects={subjects}
        availability={availability}
      />
    </div>
  );
}
