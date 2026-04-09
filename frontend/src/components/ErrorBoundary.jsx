import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoLogin = () => {
    window.location.href = '/login';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-sm p-8 text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-600 mb-6">
              The page hit an unexpected error. Please refresh, or sign in again.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
              >
                Refresh Page
              </button>
              <button
                type="button"
                onClick={this.handleGoLogin}
                className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 font-semibold hover:bg-slate-100"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
