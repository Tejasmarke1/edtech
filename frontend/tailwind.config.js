/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class', // Enable dark mode
    theme: {
        extend: {
            // 0.1.1 Color Palette & Theming
            colors: {
                // Brand colors
                primary: {
                    50: '#f0f9ff',
                    100: '#e0f2fe',
                    200: '#bae6fd',
                    300: '#7dd3fc',
                    400: '#38bdf8',
                    500: '#0ea5e9', // Main brand color
                    600: '#0284c7',
                    700: '#0369a1',
                    800: '#075985',
                    900: '#0c3d66',
                },
                // Role specific colors
                student: {
                    DEFAULT: '#0ea5e9', // Blue
                    light: '#e0f2fe',
                },
                teacher: {
                    DEFAULT: '#16a34a', // Green
                    light: '#f0fdf4',
                },
                // Status colors
                success: '#10b981',
                warning: '#f59e0b',
                error: '#ef4444',
                info: '#3b82f6',
                // Semantic colors
                'text-primary': '#1e293b',
                'text-secondary': '#64748b',
                'text-tertiary': '#94a3b8',
                'bg-surface': '#ffffff',
                'bg-surface-light': '#f8fafc',
                'border-subtle': '#e2e8f0',
            },
            // 0.1.2 Typography System
            fontFamily: {
                'sans': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                'heading': ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                'display': ['Montserrat', 'ui-sans-serif', 'system-ui', 'sans-serif'],
            },
            fontSize: {
                // Display/Hero
                'display': ['48px', { lineHeight: '1.2', letterSpacing: '0%' }],
                'display-md': ['40px', { lineHeight: '1.2', letterSpacing: '0%' }],
                'display-sm': ['32px', { lineHeight: '1.2', letterSpacing: '0%' }],
                // Heading 1
                'h1': ['32px', { lineHeight: '1.2', letterSpacing: '0%' }],
                'h1-md': ['28px', { lineHeight: '1.2', letterSpacing: '0%' }],
                // Heading 2
                'h2': ['24px', { lineHeight: '1.2', letterSpacing: '0%' }],
                'h2-md': ['20px', { lineHeight: '1.2', letterSpacing: '0%' }],
                // Heading 3
                'h3': ['18px', { lineHeight: '1.2', letterSpacing: '0%' }],
                // Body
                'body-lg': ['16px', { lineHeight: '1.6', letterSpacing: '0.5%' }],
                'body': ['14px', { lineHeight: '1.6', letterSpacing: '0.5%' }],
                'body-sm': ['12px', { lineHeight: '1.6', letterSpacing: '0.5%' }],
                // Label/Button
                'label': ['14px', { lineHeight: '1.5', letterSpacing: '0.5%' }],
                'button': ['16px', { lineHeight: '1.5', letterSpacing: '0.5%' }],
            },
            fontWeight: {
                'thin': '100',
                'extralight': '200',
                'light': '300',
                'normal': '400',
                'medium': '500',
                'semibold': '600',
                'bold': '700',
                'extrabold': '800',
                'black': '900',
            },
            lineHeight: {
                'tight': '1.2',
                'normal': '1.5',
                'relaxed': '1.6',
            },
            letterSpacing: {
                'tighter': '-0.05em',
                'tight': '-0.025em',
                'normal': '0em',
                'wide': '0.025em',
                'wider': '0.05em',
                'widest': '0.1em',
            },
            // 0.1.3 Spacing System (multiples of 4px)
            spacing: {
                '0': '0px',
                '0.5': '2px',
                '1': '4px',
                '2': '8px',
                '3': '12px',
                '4': '16px',
                '5': '20px',
                '6': '24px',
                '8': '32px',
                '10': '40px',
                '12': '48px',
                '14': '56px',
                '16': '64px',
                '18': '72px',
                '20': '80px',
                '24': '96px',
            },
            // 0.1.4 Border Radius
            borderRadius: {
                'none': '0px',
                'sm': '4px',
                'base': '6px',
                'lg': '8px',
                'xl': '12px',
                '2xl': '16px',
                '3xl': '20px',
                'full': '9999px',
            },
            // 0.1.5 Shadow/Elevation System
            boxShadow: {
                'none': 'none',
                'sm': '0 4px 4px rgba(0, 0, 0, 0.1)',
                'md': '0 8px 8px rgba(0, 0, 0, 0.15)',
                'lg': '0 16px 16px rgba(0, 0, 0, 0.2)',
                'xl': '0 25px 25px rgba(0, 0, 0, 0.25)',
                'primary': '0 8px 16px rgba(15, 165, 233, 0.15)',
                'warning': '0 8px 16px rgba(245, 158, 11, 0.15)',
                'error': '0 8px 16px rgba(239, 68, 68, 0.15)',
            },
            // Transitions
            transitionDuration: {
                'super-fast': '50ms',
                'fast': '100ms',
                'standard': '150ms',
                'moderate': '200ms',
                'slow': '250ms',
                'slower': '400ms',
                'slowest': '600ms',
            },
            transitionTimingFunction: {
                'ease-in-out': 'cubic-bezier(0.4, 0, 0.2, 1)',
                'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
                'ease-in': 'cubic-bezier(0.4, 0, 1, 1)',
            },
            // 0.6.1 Responsive Breakpoints
            screens: {
                'sm': '640px',   // mobile
                'md': '1024px',  // tablet
                'lg': '1280px',  // desktop
                'xl': '1536px',  // large desktop
            },
        },
    },
    plugins: [],
};