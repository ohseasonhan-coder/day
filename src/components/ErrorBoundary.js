import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || '',
    };
  }

  componentDidCatch(error, info) {
    console.error('App render failed:', error, info);
  }

  handleRefresh = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
      }
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F7F8FB',
        padding: 24,
        color: '#1F2937',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 420,
          background: 'white',
          border: '1px solid #E5E7EB',
          borderRadius: 18,
          padding: 24,
          boxShadow: '0 12px 30px rgba(15, 23, 42, 0.08)',
        }}>
          <div style={{ fontSize: 22, fontWeight: 900, marginBottom: 8 }}>앱을 다시 불러와야 해요</div>
          <div style={{ fontSize: 14, lineHeight: 1.65, color: '#6B7280', marginBottom: 18 }}>
            화면을 그리는 중 문제가 생겼습니다. 저장된 기록은 자동으로 지우지 않으니, 먼저 새로고침을 시도해 주세요.
          </div>
          {this.state.errorMessage && (
            <div style={{
              fontSize: 12,
              lineHeight: 1.5,
              color: '#6B7280',
              background: '#F3F4F6',
              borderRadius: 12,
              padding: 12,
              marginBottom: 16,
              wordBreak: 'break-word',
            }}>
              {this.state.errorMessage}
            </div>
          )}
          <button
            type="button"
            onClick={this.handleRefresh}
            style={{
              width: '100%',
              height: 44,
              borderRadius: 12,
              background: '#4F7FFF',
              color: 'white',
              fontSize: 14,
              fontWeight: 900,
            }}
          >
            캐시 정리 후 새로고침
          </button>
        </div>
      </div>
    );
  }
}
