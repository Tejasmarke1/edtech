import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Input from '../ui/Input';
import Button from '../ui/Button';
import apiClient from '../../api/client';
import { toast } from 'react-hot-toast';

const bookingSchema = z.object({
  subject_master_id: z.string().min(1, 'Subject is required'),
  slot_id: z.string().min(1, 'Time slot is required'),
  session_date: z.string().min(1, 'Date is required'),
  topic_description: z.string().optional()
});

function formatSlotLabel(slot) {
  const day = String(slot.day_of_week || '').replace('_', ' ');
  return `${day} ${slot.start_time} - ${slot.end_time}`.trim();
}

export default function BookingModal({ isOpen, onClose, teacherId, teacherName, subjects = [], availability = [] }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(bookingSchema),
    defaultValues: {
      subject_master_id: subjects[0]?.id || '',
      slot_id: availability[0]?.id || '',
      session_date: '',
      topic_description: ''
    }
  });

  if (!isOpen) return null;

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await apiClient.post('/sessions/request', {
        teacher_id: teacherId,
        subject_master_id: data.subject_master_id,
        slot_id: data.slot_id,
        session_date: data.session_date,
        topic_description: data.topic_description || ''
      });

      toast.success('Session requested successfully!');
      
      reset();
      onClose();
    } catch (err) {
      console.error(err);
      toast.error(err?.response?.data?.detail || 'Failed to request session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      
      {/* Modal */}
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative z-10 animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <h2 className="text-xl font-bold text-slate-900">Book Session</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          <div className="mb-4">
             <p className="text-sm text-slate-500">Requesting a session with <strong className="text-slate-900">{teacherName}</strong></p>
          </div>

          <div className="w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
            <select
              className={`w-full border rounded-xl px-4 py-2.5 outline-none transition-all duration-200 text-slate-900 bg-white ${
                errors.subject_master_id
                  ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-400'
              }`}
              {...register('subject_master_id')}
            >
              <option value="">Select a subject</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>{subject.subject_name}</option>
              ))}
            </select>
            {errors.subject_master_id && <p className="mt-1.5 text-sm text-red-600 font-medium">{errors.subject_master_id.message}</p>}
          </div>

          <div className="w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Time Slot</label>
            <select
              className={`w-full border rounded-xl px-4 py-2.5 outline-none transition-all duration-200 text-slate-900 bg-white ${
                errors.slot_id
                  ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                  : 'border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-400'
              }`}
              {...register('slot_id')}
            >
              <option value="">Select a slot</option>
              {availability.map((slot) => (
                <option key={slot.id} value={slot.id}>{formatSlotLabel(slot)}</option>
              ))}
            </select>
            {errors.slot_id && <p className="mt-1.5 text-sm text-red-600 font-medium">{errors.slot_id.message}</p>}
          </div>
          
          <Input 
            label="Session Date"
            type="date"
            {...register('session_date')}
            error={errors.session_date?.message}
          />
          
          <div className="w-full">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Topic Description (Optional)</label>
            <textarea
              className="w-full border border-slate-300 rounded-xl px-4 py-2.5 outline-none transition-all duration-200 text-slate-900 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
              rows="3"
              placeholder="What do you want to cover?"
              {...register('topic_description')}
            ></textarea>
          </div>
          
          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting || subjects.length === 0 || availability.length === 0}>
              {isSubmitting ? 'Requesting...' : 'Send Request'}
            </Button>
          </div>
          {(subjects.length === 0 || availability.length === 0) && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              This teacher must have at least one subject and one availability slot before you can book.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
