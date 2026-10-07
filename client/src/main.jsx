import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import App from './App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import './styles.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Matches the app's dark tokens in styles.css so Clerk's sign-in modals feel native.
const appearance = {
  variables: {
    colorPrimary: '#ff2d6f',
    colorBackground: '#15151c',
    colorForeground: '#f4f4f7',
    colorMutedForeground: '#9a9aab',
    colorNeutral: '#f4f4f7',
    colorInput: '#1e1e28',
    colorInputForeground: '#f4f4f7',
    colorBorder: '#2a2a36',
    colorDanger: '#ff4d4d',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    borderRadius: '14px',
  },
};

function MissingConfig() {
  return (
    <div className="page center">
      <h1>Clerk is not configured</h1>
      <p className="muted">
        Copy <code>client/.env.example</code> to <code>client/.env.local</code>, add your Clerk publishable key, then
        restart the dev server.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {PUBLISHABLE_KEY ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" appearance={appearance}>
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <MissingConfig />
    )}
  </React.StrictMode>
);
