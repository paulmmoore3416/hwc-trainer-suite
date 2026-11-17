import { Component, type ReactNode } from 'react';
import { logError } from '../lib/errors';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    logError(error, { kind: 'react-error-boundary', componentStack: info.componentStack?.slice(0, 3000) }, 'fatal');
  }
  render() {
    if (this.state.error) {
      return (
        <div className="mx-auto mt-20 max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow">
          <h1 className="text-lg font-semibold text-slate-900">Something went wrong on this page</h1>
          <p className="mt-2 text-sm text-slate-600">The problem has been logged for the administrator. You can go back and try again.</p>
          <div className="mt-5 flex justify-center gap-2">
            <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm" onClick={() => this.setState({ error: null })}>
              Try again
            </button>
            <button
              className="rounded-lg bg-brand-800 px-3 py-2 text-sm text-white"
              onClick={() => {
                window.location.hash = '#/';
                this.setState({ error: null });
              }}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
