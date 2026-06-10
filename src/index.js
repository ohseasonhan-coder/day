import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { unregister } from './serviceWorkerRegistration';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <ToastProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ToastProvider>
  </React.StrictMode>
);

unregister();
