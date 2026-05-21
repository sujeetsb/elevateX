'use client';

import React, { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { hasError: boolean; message: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Something went wrong.' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center aurora-bg"
          style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#e2e8f0' }}
        >
          <p style={{ color: 'var(--cp-text-primary)', fontWeight: 700, fontSize: '1.1rem' }}>We hit a snag</p>
          <p style={{ color: 'var(--cp-text-muted)', maxWidth: '28rem', fontSize: '0.9rem' }}>{this.state.message}</p>
          <button
            type="button"
            className="btn-primary rounded-xl px-6 py-3"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
