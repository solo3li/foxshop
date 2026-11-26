import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught uncaught error in Supervisor dashboard:', error, errorInfo);
  }

  public handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{ padding: '40px', textAlign: 'center', fontFamily: 'sans-serif', backgroundColor: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
          <h2 style={{ fontSize: '24px', color: '#ef4444', marginBottom: '12px' }}>
            حدث خطأ غير متوقع في لوحة العمليات
          </h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
            {this.state.error?.message || 'نعتذر عن حدوث هذا الخطأ في نظام المراقبة. يمكنك إعادة المحاولة أو تحديث الصفحة.'}
          </p>
          <button
            onClick={this.handleRetry}
            style={{
              backgroundColor: '#6366f1',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              cursor: 'pointer',
              fontSize: '16px',
            }}
          >
            إعادة المحاولة
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
