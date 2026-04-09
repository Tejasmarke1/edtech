import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/routing/ProtectedRoute';
import RoleProtectedRoute from './components/routing/RoleProtectedRoute';
import TeacherOnboardingGuard from './components/routing/TeacherOnboardingGuard';
import RatingsPromptManager from './components/ratings/RatingsPromptManager';
import PaymentModal from './components/PaymentModal';
import { Toaster } from 'react-hot-toast';

import { useAuthStore } from './stores/authStore';
import apiClient from './api/client';

const DemoPage = lazy(() => import('./pages/DemoPage'));

// Student Pages
const Dashboard = lazy(() => import('./pages/student/Dashboard'));
const FindTeachers = lazy(() => import('./pages/student/FindTeachers'));
const TeacherDetail = lazy(() => import('./pages/student/TeacherDetail'));
const MySessions = lazy(() => import('./pages/student/MySessions'));
const Payments = lazy(() => import('./pages/student/Payments'));
const StudentProfile = lazy(() => import('./pages/student/StudentProfile'));

// Teacher Pages
const TeacherDashboard = lazy(() => import('./pages/teacher/TeacherDashboard'));
const TeacherProfile = lazy(() => import('./pages/teacher/TeacherProfile'));
const Wallet = lazy(() => import('./pages/teacher/Wallet'));
const OnboardingWizard = lazy(() => import('./pages/teacher/OnboardingWizard'));
const TeacherSessions = lazy(() => import('./pages/teacher/TeacherSessions'));

// Auth Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'));

// Session Pages
const MeetingPage = lazy(() => import('./pages/session/MeetingPage'));
const SessionDetail = lazy(() => import('./pages/session/SessionDetail'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));

function RouteLoadingFallback() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-blue-600 mx-auto mb-3" />
        <p className="text-sm font-medium text-slate-600">Loading page...</p>
      </div>
    </div>
  );
}

function AppInit({ children }) {
  const { accessToken, setUser, logout, setInitialized } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      if (accessToken) {
        try {
          const { data } = await apiClient.get('/auth/me');
          setUser(data);
        } catch (error) {
          console.error('Failed to verify token:', error);
          logout();
        }
      } else {
        setInitialized();
      }
    };
    
    initAuth();
  }, [accessToken, setUser, logout, setInitialized]);

  return children;
}

function App() {
  const user = useAuthStore((state) => state.user);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppInit>
          <Toaster position="bottom-right" />
          <RatingsPromptManager />
          <PaymentModal user={user} />
          <Suspense fallback={<RouteLoadingFallback />}>
            <Routes>
          {/* Public Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* Protected Routes - Base ProtectedRoute checks authentication */}
          <Route element={<ProtectedRoute />}>
            {/* Root redirect - will go to ProtectedRoute which redirects to /dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* Student Routes - wrapped in RoleProtectedRoute */}
            <Route element={<RoleProtectedRoute requiredRole="student" />}>
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/teachers" element={<FindTeachers />} />
                <Route path="/teachers/:id" element={<TeacherDetail />} />
                <Route path="/my-sessions" element={<MySessions />} />
                <Route path="/sessions/:sessionId" element={<SessionDetail />} />
                <Route path="/payments" element={<Payments />} />
                <Route path="/sessions/:sessionId/join" element={<MeetingPage />} />
                <Route path="/sessions/:sessionId/meeting" element={<MeetingPage />} />
                <Route path="/profile" element={<StudentProfile />} />
                <Route path="/demo" element={<DemoPage />} />
              </Route>
            </Route>

            {/* Teacher Onboarding Route - no guard here, accessed right after registration */}
            <Route element={<RoleProtectedRoute requiredRole="teacher" />}>
              <Route path="/teacher/onboarding" element={<OnboardingWizard />} />
            </Route>

            {/* Teacher Routes - wrapped in OnboardingGuard */}
            <Route element={<RoleProtectedRoute requiredRole="teacher" />}>
              <Route element={<TeacherOnboardingGuard />}>
                <Route element={<AppLayout />}>
                  <Route path="/teacher-dashboard" element={<TeacherDashboard />} />
                  <Route path="/teacher-sessions" element={<TeacherSessions />} />
                  <Route path="/teacher/sessions/:sessionId" element={<SessionDetail />} />
                  <Route path="/teacher/sessions/:sessionId/join" element={<MeetingPage />} />
                  <Route path="/teacher/sessions/:sessionId/meeting" element={<MeetingPage />} />
                  <Route path="/sessions/:sessionId" element={<SessionDetail />} />
                  <Route path="/teacher-wallet" element={<Wallet />} />
                  <Route path="/sessions/:sessionId/join" element={<MeetingPage />} />
                  <Route path="/sessions/:sessionId/meeting" element={<MeetingPage />} />
                  <Route path="/teacher-profile" element={<TeacherProfile />} />
                  <Route path="/demo" element={<DemoPage />} />
                </Route>
              </Route>
            </Route>

            {/* Shared protected routes (all authenticated users) */}
            <Route element={<AppLayout />}>
              <Route path="/notifications" element={<NotificationsPage />} />
            </Route>
          </Route>

          {/* Catch-all - redirect to login */}
          <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </Suspense>
        </AppInit>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;

