import { useAuth } from '../AuthContext.jsx';
import ProfileView from '../components/ProfileView.jsx';

export default function Me() {
  const { user, loading, login } = useAuth();
  if (loading) return <div className="page center"><div className="spinner" /></div>;
  if (!user) {
    return (
      <div className="page center join">
        <img src="/logo-mark.png" alt="" width="110" height="80" />
        <h1>Make it yours</h1>
        <p className="muted">Follow creators, leave a kiss on clips you love, and post your own. Adults only.</p>
        <div className="join-actions">
          <button className="btn btn-primary btn-lg" onClick={() => login(true)}>
            Create account
          </button>
          <button className="btn btn-glass btn-lg" onClick={() => login()}>
            Log in
          </button>
        </div>
      </div>
    );
  }
  return <ProfileView key={user.username} username={user.username} />;
}
