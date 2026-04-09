import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import NotificationCenter from '../NotificationCenter';

const iconClass = 'h-5 w-5';

const navIcons = {
  dashboard: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
    </svg>
  ),
  findTeachers: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.3-4.3m1.8-4.7a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
    </svg>
  ),
  sessions: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  payments: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h5M5 6h14a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" />
    </svg>
  ),
  notifications: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0a3 3 0 11-6 0m6 0H9" />
    </svg>
  ),
  profile: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5.1 19a9 9 0 0113.8 0M12 12a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  ),
  wallet: (
    <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-2m0-6h4v6h-4a2 2 0 110-6z" />
    </svg>
  ),
};

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine if user is teacher or student
  const isTeacher = user?.role === 'teacher';

  const displayName = useMemo(() => {
    return user?.profile?.full_name || user?.name || user?.user_name || 'User';
  }, [user]);

  // Get user initials from name
  const userInitials = useMemo(() => {
    const source = displayName;
    if (!source) return 'U';
    const parts = source.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  }, [displayName]);

  const profilePath = isTeacher ? '/teacher-profile' : '/profile';

  // Get page title from current route
  const pageTitle = useMemo(() => {
    const pathname = location.pathname;
    if (pathname === '/dashboard' || pathname === '/teacher-dashboard') return 'Dashboard';
    if (pathname === '/teachers') return 'Find Learning Options';
    if (pathname === '/teacher-sessions') return 'My Sessions';
    if (pathname === '/teacher-wallet') return 'Wallet';
    if (pathname === '/my-sessions') return 'My Sessions';
    if (pathname.startsWith('/sessions/') && pathname.endsWith('/meeting')) return 'Live Meeting';
    if (pathname.startsWith('/sessions/') && !pathname.endsWith('/join')) return 'Session Details';
    if (pathname === '/payments') return 'Payments';
    if (pathname.includes('/sessions/') && (pathname.includes('/join') || pathname.includes('/meeting'))) return 'Join Session';
    if (pathname === '/profile') return 'Profile';
    if (pathname === '/teacher-profile') return 'Profile';
    if (pathname === '/notifications') return 'Notifications';
    if (pathname === '/demo') return 'Demo';
    return 'Dashboard';
  }, [location.pathname]);

  // Define menu items based on role
  const menuItems = useMemo(() => {
    if (isTeacher) {
      return [
        {
          label: 'Dashboard',
          href: '/teacher-dashboard',
          icon: navIcons.dashboard,
          activePrefixes: ['/teacher-dashboard'],
        },
        {
          label: 'My Sessions',
          href: '/teacher-sessions',
          icon: navIcons.sessions,
          activePrefixes: ['/teacher-sessions', '/sessions'],
        },
        {
          label: 'Wallet',
          href: '/teacher-wallet',
          icon: navIcons.wallet,
          activePrefixes: ['/teacher-wallet'],
        },
        {
          label: 'Notifications',
          href: '/notifications',
          icon: navIcons.notifications,
          activePrefixes: ['/notifications'],
        },
        {
          label: 'Profile',
          href: '/teacher-profile',
          icon: navIcons.profile,
          activePrefixes: ['/teacher-profile'],
        },
      ];
    } else {
      return [
        {
          label: 'Dashboard',
          href: '/dashboard',
          icon: navIcons.dashboard,
          activePrefixes: ['/dashboard'],
        },
        {
          label: 'Find Learning Options',
          href: '/teachers',
          icon: navIcons.findTeachers,
          activePrefixes: ['/teachers'],
        },
        {
          label: 'My Sessions',
          href: '/my-sessions',
          icon: navIcons.sessions,
          activePrefixes: ['/my-sessions', '/sessions'],
        },
        {
          label: 'Payments',
          href: '/payments',
          icon: navIcons.payments,
          activePrefixes: ['/payments'],
        },
        {
          label: 'Notifications',
          href: '/notifications',
          icon: navIcons.notifications,
          activePrefixes: ['/notifications'],
        },
        {
          label: 'Profile',
          href: '/profile',
          icon: navIcons.profile,
          activePrefixes: ['/profile'],
        },
      ];
    }
  }, [isTeacher]);

  // Check if a menu item is active
  const isMenuItemActive = (item) => {
    const pathname = location.pathname;
    return item.activePrefixes?.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      window.addEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  return (
    <div className="h-screen w-screen bg-slate-50 text-slate-900 font-sans flex overflow-hidden">
      
      {/* Sidebar - fixed width */}
      <aside className="w-72 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-r border-slate-800 text-white flex-shrink-0 hidden md:flex flex-col shadow-xl z-20">
        <div className="h-16 flex items-center px-6 border-b border-slate-800/80">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center font-bold mr-3 shadow-lg shadow-blue-500/30">E</div>
          <span className="font-bold text-lg tracking-tight">EduConnect</span>
        </div>
        <div className="p-4 flex-1">
          <div className="px-3 py-2 text-xs text-slate-300 font-semibold uppercase tracking-[0.16em] mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            {isTeacher ? 'Teacher' : 'Student'}
          </div>
          <nav className="space-y-1.5" aria-label="Primary">
            {menuItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`group relative block px-3 py-3 rounded-xl text-base font-semibold no-underline hover:no-underline focus:no-underline transition-all duration-200 flex items-center gap-3 ${
                  isMenuItemActive(item)
                    ? 'bg-blue-600/95 text-white shadow-lg shadow-blue-900/40'
                    : 'text-slate-200 hover:text-white hover:bg-slate-800/80'
                }`}
                aria-current={isMenuItemActive(item) ? 'page' : undefined}
              >
                {isMenuItemActive(item) && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-blue-300" aria-hidden="true" />}
                <span className={`${isMenuItemActive(item) ? 'text-white' : 'text-slate-300 group-hover:text-slate-100'}`}>{item.icon}</span>
                <span className="line-clamp-1">{item.label}</span>
              </Link>
            ))}
          </nav>
        </div>
        
        {/* Logout Button */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={logout}
            className="w-full px-3 py-2.5 rounded-xl font-semibold text-slate-200 hover:text-white hover:bg-red-600/20 transition-colors duration-200 text-base"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Navbar - fixed top inside main */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-6 lg:px-8 flex-shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="md:hidden h-9 w-9 rounded-lg border border-slate-200 text-slate-700 flex items-center justify-center"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="md:hidden w-8 h-8 bg-blue-600 rounded-lg text-white flex items-center justify-center font-bold">E</div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-800">{pageTitle}</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <NotificationCenter />

            {/* User Avatar with initials */}
            <button
              type="button"
              title={`Open profile: ${displayName}`}
              aria-label="Open profile"
              onClick={() => navigate(profilePath)}
              className="h-9 w-9 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold border border-blue-200 shadow-sm cursor-pointer hover:bg-blue-200 transition-colors"
            >
              {userInitials}
            </button>
          </div>
        </header>

        {mobileMenuOpen && (
          <>
            <button
              type="button"
              className="md:hidden fixed inset-0 z-30 bg-slate-900/55"
              aria-label="Close navigation menu"
              onClick={() => setMobileMenuOpen(false)}
            />
            <aside
              id="mobile-navigation"
              className="md:hidden fixed left-0 top-0 bottom-0 z-40 w-72 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-r border-slate-800 text-white flex flex-col"
            >
              <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center font-bold shadow-lg shadow-blue-500/30">E</div>
                  <span className="font-bold text-lg tracking-tight">EduConnect</span>
                </div>
                <button
                  type="button"
                  className="h-8 w-8 rounded-lg border border-slate-700 text-slate-200 flex items-center justify-center"
                  aria-label="Close navigation menu"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto">
                <div className="px-3 py-2 text-xs text-slate-300 font-semibold uppercase tracking-[0.16em] mb-3 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-400" />
                  {isTeacher ? 'Teacher' : 'Student'}
                </div>
                <nav className="space-y-1.5" aria-label="Mobile primary">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`group relative block px-3 py-3 rounded-xl font-semibold no-underline hover:no-underline focus:no-underline transition-colors ${
                    isMenuItemActive(item)
                      ? 'bg-blue-600/95 text-white'
                      : 'text-slate-100 hover:bg-slate-800/80'
                  }`}
                  aria-current={isMenuItemActive(item) ? 'page' : undefined}
                >
                  {isMenuItemActive(item) && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-blue-300" aria-hidden="true" />}
                  <span className={`mr-2 inline-flex ${isMenuItemActive(item) ? 'text-white' : 'text-slate-300 group-hover:text-slate-100'}`} aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
                </nav>
              </div>

              <div className="p-4 border-t border-slate-800">
              <button
                type="button"
                onClick={logout}
                className="w-full px-3 py-2.5 rounded-xl text-left font-semibold text-slate-100 hover:bg-red-600/20"
              >
                Logout
              </button>
              </div>
            </aside>
          </>
        )}

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      
    </div>
  );
}

