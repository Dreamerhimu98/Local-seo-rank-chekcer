import React, { Component } from 'react';
import type { ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import './index.css';
import App from './App';

class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, info: any) {
    console.error('ErrorBoundary caught:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '30px', fontFamily: 'sans-serif', maxWidth: '650px', margin: '50px auto', background: '#fff', borderRadius: '10px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', border: '1px solid #fee2e2'}}>
          <h2 style={{color: '#dc2626', marginTop: 0, fontSize: '20px'}}>Workspace Error Encountered</h2>
          <p style={{fontSize: '14px', color: '#4b5563'}}>The application ran into an unexpected error while rendering:</p>
          <pre style={{background: '#fef2f2', padding: '14px', borderRadius: '6px', overflowX: 'auto', fontSize: '12px', color: '#991b1b', lineHeight: 1.5}}>
            {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
          </pre>
          <div style={{display: 'flex', gap: '10px', marginTop: '18px'}}>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{background: '#dc2626', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'}}
            >
              Reset Stored Cache & Reload
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db', padding: '10px 18px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px'}}
            >
              Try Reloading
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
