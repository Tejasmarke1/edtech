import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import apiClient from '../../api/client';

const registerSchema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'teacher'], {
    errorMap: () => ({ message: 'Please select a valid role' }),
  }),
});

export default function RegisterPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);

  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      role: 'student',
    },
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      await apiClient.post('/auth/register', {
        user_name: data.email,
        password: data.password,
        full_name: data.full_name,
        role: data.role
      });

      navigate('/login', { state: { message: 'Registration successful! Please log in.' } });
    } catch (err) {
      setApiError(
        err.response?.data?.detail?.[0]?.msg ||
        err.response?.data?.detail ||
        'Failed to register account'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 overflow-hidden">
      <div className="w-full max-w-md">
        <Card className="p-8 shadow-2xl rounded-2xl border-0 !bg-white max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Create an account</h1>
            <p className="text-slate-500 font-medium">Join EduConnect Live today</p>
          </div>

          {apiError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Input
              label="Full Name"
              type="text"
              placeholder="John Doe"
              {...register('full_name')}
              error={errors.full_name?.message}
            />

            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              {...register('password')}
              error={errors.password?.message}
            />

            <div className="w-full">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">I am a...</label>
              <div className="relative">
                <select
                  className={`w-full border rounded-xl px-4 py-2.5 outline-none transition-all duration-200 text-slate-900 bg-white appearance-none ${errors.role
                      ? 'border-red-300 focus:border-red-500 focus:ring-4 focus:ring-red-500/10'
                      : 'border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 hover:border-slate-400'
                    }`}
                  {...register('role')}
                >
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </div>
              </div>
              {errors.role && <p className="mt-1.5 text-sm text-red-600 font-medium">{errors.role.message}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 mt-4 text-base shadow-blue-500/20"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Creating account...' : 'Sign Up'}
            </Button>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-slate-600">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 hover:underline transition-colors">
              Log in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
