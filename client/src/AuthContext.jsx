import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth as useClerkAuth, useClerk, useUser } from '@clerk/react';
import { api, setTokenGetter } from './api.js';

const AuthContext = createContext(null);

// Clerk owns sign-in; this layers the app profile (username, age-verified) on top.
export function AuthProvider({ children }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const { user: clerkUser } = useUser();
  const { openSignIn, openSignUp, signOut } = useClerk();
  const isAuthenticated = !!isSignedIn;
  const [user, setUser] = useState(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  // From /auth/me during onboarding: { ageVerified, underage } when the sign-in provider supplied a birthday.
  const [providerAge, setProviderAge] = useState({ ageVerified: false, underage: false });
  const [profileLoading, setProfileLoading] = useState(true);
  const [authPrompt, setAuthPrompt] = useState(false);

  // Assigned during render (not in an effect) so children's first requests already carry the token.
  setTokenGetter(isAuthenticated ? () => getToken() : null);

  useEffect(() => {
    if (!isLoaded) return;
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
  }, [isLoaded, isAuthenticated, clerkUser?.id]);

  // Clerk's modals keep the viewer on the current page; no redirect round-trip.
  const login = useCallback(
    (signup = false) => {
      setAuthPrompt(false);
      (signup ? openSignUp : openSignIn)();
    },
    [openSignIn, openSignUp]
  );

  const logout = useCallback(() => signOut({ redirectUrl: '/' }), [signOut]);

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
        clerkUser,
        loading: !isLoaded || profileLoading,
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
