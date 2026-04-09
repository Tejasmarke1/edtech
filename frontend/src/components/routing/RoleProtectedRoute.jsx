import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

/**
 * Route wrapper that checks if user has required role
 * Usage: <Route element={<RoleProtectedRoute requiredRole="teacher" />} >
 */
export default function RoleProtectedRoute({ requiredRole }) {
  const { user, isInitialized } = useAuthStore();

  // Still initializing - show nothing or loading spinner
  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but wrong role
  if (requiredRole && user.role !== requiredRole) {
    // Redirect to appropriate dashboard based on actual role
    const redirectPath = user.role === 'teacher' ? '/teacher-dashboard' : '/dashboard';
    return <Navigate to={redirectPath} replace />;
  }

  // All checks passed
  return <Outlet />;
}
