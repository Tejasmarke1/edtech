import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import apiClient from '../../api/client';
import { useAuthStore } from '../../stores/authStore';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export default function LoginPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { setTokens, setUser } = useAuthStore();
  
  const successMessage = location.state?.message;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      const formData = new URLSearchParams();
      formData.append('username', data.email);
      formData.append('password', data.password);

      const response = await apiClient.post('/auth/login', formData, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      
      const { access_token, refresh_token } = response.data;
      
      // Store tokens synchronously so interceptor reads them immediately
      setTokens(access_token, refresh_token);
      
      // Fetch user data right after login
      const userRes = await apiClient.get('/auth/me');
      setUser(userRes.data);
      
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setApiError(
        err.response?.data?.detail || 'Invalid email or password. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 overflow-hidden">
      <div className="w-full max-w-md">
        <Card className="p-8 shadow-2xl rounded-2xl border-0 !bg-white">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 mb-2">Welcome Back</h1>
            <p className="text-slate-500 font-medium">Log in to your account</p>
          </div>
          
          {successMessage && (
            <div className="mb-6 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-sm font-medium">
              {successMessage}
            </div>
          )}

          {apiError && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm font-medium">
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Input 
              label="Email address" 
              type="email" 
              placeholder="you@example.com"
              {...register('email')}
              error={errors.email?.message}
            />
            
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="block text-sm font-semibold text-slate-700">Password</label>
                <span className="text-sm font-medium text-slate-500">Password reset coming soon</span>
              </div>
              <Input 
                type="password" 
                placeholder="••••••••"
                {...register('password')}
                error={errors.password?.message}
              />
            </div>
            
            <Button 
              type="submit" 
              variant="primary" 
              className="w-full py-3 mt-2 text-base shadow-blue-500/20"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
          
          <div className="mt-8 text-center text-sm font-medium text-slate-600">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-600 hover:text-blue-700 hover:underline transition-colors">
              Register here
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
