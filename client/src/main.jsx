import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { Auth0Provider } from '@auth0/auth0-react';
import App from './App.jsx';
import { AuthProvider } from './AuthContext.jsx';
import './styles.css';

const { VITE_AUTH0_DOMAIN: domain, VITE_AUTH0_CLIENT_ID: clientId, VITE_AUTH0_AUDIENCE: audience } = import.meta.env;

function Auth0WithRouter({ children }) {
  const navigate = useNavigate();
  return (
    <Auth0Provider
      domain={domain}
      clientId={clientId}
      authorizationParams={{ redirect_uri: window.location.origin, audience }}
      // Refresh tokens keep users signed in across reloads without third-party cookies.
      useRefreshTokens
      cacheLocation="localstorage"
      onRedirectCallback={(appState) => navigate(appState?.returnTo || '/', { replace: true })}
    >
      {children}
    </Auth0Provider>
  );
}

function MissingConfig() {
  return (
    <div className="page center">
      <h1>Auth0 is not configured</h1>
      <p className="muted">
        Copy <code>client/.env.example</code> to <code>client/.env</code> and fill in your Auth0 domain, client ID
        and API audience, then restart the dev server.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {domain && clientId && audience ? (
      <BrowserRouter>
        <Auth0WithRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </Auth0WithRouter>
      </BrowserRouter>
    ) : (
      <MissingConfig />
    )}
  </React.StrictMode>
);
