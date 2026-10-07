import Modal from './Modal.jsx';
import { useAuth } from '../AuthContext.jsx';

export default function LoginPrompt() {
  const { login, setAuthPrompt } = useAuth();
  return (
    <Modal title="Join OnlyReal" onClose={() => setAuthPrompt(false)}>
      <div className="form prompt">
        <img src="/logo-mark.png" alt="" width="66" height="48" />
        <p>Create an account to like clips, comment, follow creators and post your own. 18+ only.</p>
        <button className="btn btn-primary btn-lg" onClick={() => login(true)}>
          Create account
        </button>
        <button className="btn btn-glass btn-lg" onClick={() => login(false)}>
          Log in
        </button>
      </div>
    </Modal>
  );
}
