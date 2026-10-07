import { Link } from 'react-router-dom';

const KEY = 'onlyreal.ageVerified';

export function hasPassedAgeGate() {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export default function AgeGate({ onPass }) {
  const pass = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* storage unavailable: gate shows again next visit */
    }
    onPass();
  };

  return (
    <main className="gate">
      <div className="gate-glow" aria-hidden="true" />
      <div className="gate-inner">
        <img className="gate-lips" src="/icon-512.png" alt="" width="220" height="220" />
        <span className="gate-wordmark">
          <img src="/logo.svg" alt="OnlyReal" width="251" height="64" />
        </span>
        <h1 className="gate-title">No porn. OnlyReal.</h1>
        <p className="gate-copy">
          18+ only. By entering you agree to our <Link to="/legal/terms">Terms</Link>.
        </p>
        <div className="gate-actions">
          <button className="btn btn-primary btn-lg" onClick={pass} autoFocus>
            I'm 18+, enter
          </button>
          <a className="btn btn-glass btn-lg" href="https://www.google.com" rel="noreferrer">
            Leave
          </a>
        </div>
      </div>
    </main>
  );
}
