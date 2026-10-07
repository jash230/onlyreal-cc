import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

// Shown after the first sign-in, until the account has a username and verified age.
// Not dismissable: the only way out is finishing or logging out.
export default function OnboardingModal() {
  const { clerkUser, completeOnboarding, logout, providerAge } = useAuth();
  const suggested = (clerkUser?.username || clerkUser?.primaryEmailAddress?.emailAddress.split('@')[0] || '')
    .replace(/[^a-z0-9_.]/gi, '')
    .slice(0, 24);
  const [form, setForm] = useState({
    username: suggested.length >= 3 ? suggested : '',
    displayName: clerkUser?.fullName || '',
    birthDate: '',
    acceptTerms: false,
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await completeOnboarding(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (providerAge.underage) {
    return (
      <div className="modal-backdrop modal-center">
        <div className="modal" role="alertdialog" aria-modal="true" aria-label="OnlyReal is 18+ only">
          <header className="modal-head">
            <h2>OnlyReal is 18+ only</h2>
          </header>
          <div className="modal-body form">
            <p className="muted">The birthday on your Google account shows you're under 18, so you can't create an account.</p>
            <button className="btn btn-ghost btn-lg" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop modal-center">
      <div className="modal" role="dialog" aria-modal="true" aria-label="Finish setting up">
        <header className="modal-head">
          <h2>Finish setting up your account</h2>
        </header>
        <div className="modal-body">
          <form className="form" onSubmit={submit}>
            <label>
              Username
              <input value={form.username} onChange={set('username')} required autoFocus />
              <small>3–24 letters, numbers, _ or .</small>
            </label>
            <label>
              Display name
              <input value={form.displayName} onChange={set('displayName')} maxLength={50} placeholder="Optional" />
            </label>
            {providerAge.ageVerified ? (
              <p className="muted small">Your age was confirmed from your Google account.</p>
            ) : (
              <label>
                Date of birth
                <input type="date" value={form.birthDate} onChange={set('birthDate')} required />
                <small>You must be 18 or older. We never show your birthday.</small>
              </label>
            )}
            <label className="check">
              <input type="checkbox" checked={form.acceptTerms} onChange={set('acceptTerms')} />
              <span>
                I agree to the <Link to="/legal/terms" target="_blank">Terms</Link> and{' '}
                <Link to="/legal/guidelines" target="_blank">Community Guidelines</Link>
              </span>
            </label>
            {error && <p className="error" role="alert">{error}</p>}
            <button className="btn btn-primary btn-lg" disabled={busy}>
              {busy ? 'Please wait…' : 'Continue'}
            </button>
            <p className="switch">
              Not you?{' '}
              <button type="button" className="link" onClick={logout}>
                Log out
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
