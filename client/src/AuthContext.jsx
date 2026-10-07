import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { api, setTokenGetter } from './api.js';

const AuthContext = createContext(null);
const GOOGLE_BIRTHDAY = import.meta.env.VITE_GOOGLE_BIRTHDAY === 'true';

// Auth0 owns sign-in; this layers the app profile (username, age-verified) on top.
export function AuthProvider({ children }) {
  const {
    isLoading: auth0Loading,
    isAuthenticated,
    user: auth0User,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();
  const [user, setUser] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // From /auth/me during onboarding: { ageVerified, underage } when the sign-in provider supplied a birthday.
  const [providerAge, setProviderAge] = useState({ ageVerified: false, underage: false });
  const [profileLoading, setProfileLoading] = useState(true);
  const [authPrompt, setAuthPrompt] = useState(false);

  // Assigned during render (not in an effect) so children's first requests already carry the token.
  setTokenGetter(isAuthenticated ? getAccessTokenSilently : null);

  useEffect(() => {
    if (auth0Loading) return;
    if (!isAuthenticated) {
      setUser(null);
      setNeedsOnboarding(false);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    api('/auth/me')
      .then((d) => {
        setUser(d.user);
        setNeedsOnboarding(d.needsOnboarding);
        setProviderAge({ ageVerified: !!d.ageVerified, underage: !!d.underage });
      })
      .catch(() => setUser(null))
      .finally(() => setProfileLoading(false));
  }, [auth0Loading, isAuthenticated]);

  const login = useCallback(
    (signup = false) =>
      loginWithRedirect({
        appState: { returnTo: window.location.pathname },
        authorizationParams: {
          ...(signup && { screen_hint: 'signup' }),
          // Asks Google for the birthday so onboarding can verify age without a typed date.
          // Off until the Google connection uses your own OAuth keys (see README).
          ...(GOOGLE_BIRTHDAY && { connection_scope: 'https://www.googleapis.com/auth/user.birthday.read' }),
        },
      }),
    [loginWithRedirect]
  );

  const logout = useCallback(
    () => auth0Logout({ logoutParams: { returnTo: window.location.origin } }),
    [auth0Logout]
  );

  const completeOnboarding = useCallback(async (fields) => {
    const d = await api('/auth/onboard', { method: 'POST', body: fields });
    setUser(d.user);
    setNeedsOnboarding(false);
  }, []);

  // Returns true if the viewer can act; otherwise prompts them to sign in.
  const requireUser = useCallback(() => {
    if (user) return true;
    if (!isAuthenticated) setAuthPrompt(true);
    return false;
  }, [user, isAuthenticated]);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        auth0User,
        loading: auth0Loading || profileLoading,
        isAuthenticated,
        needsOnboarding,
        providerAge,
        login,
        logout,
        completeOnboarding,
        requireUser,
        authPrompt,
        setAuthPrompt,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
