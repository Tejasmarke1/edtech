import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  accessToken: localStorage.getItem('access_token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,
  isInitialized: false,

  setTokens: (accessToken, refreshToken) => {
    if (accessToken) localStorage.setItem('access_token', accessToken);
    if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
    set({ accessToken, refreshToken });
  },
  
  setUser: (user) => {
    // Persist user role for route guards
    if (user && user.role) {
      sessionStorage.setItem('user_role', user.role);
    }
    set({ user, isInitialized: true });
  },
  
  setInitialized: () => set({ isInitialized: true }),
  
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('user_role');
    set({ user: null, accessToken: null, refreshToken: null, isInitialized: true });
  },

  // Getter for user role - used in route guards
  getUserRole: () => {
    return sessionStorage.getItem('user_role') || null;
  },
}));
