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
        <h1 className="gate-title">Real people. Unfiltered clips. Adults only.</h1>
        <p className="gate-copy">
          OnlyReal contains sexually explicit material. Enter only if you're at least 18 (or the age of majority where you
          live) and viewing adult content is legal for you. By entering you agree to our{' '}
          <Link to="/legal/terms">Terms</Link>.
        </p>
        <div className="gate-actions">
          <button className="btn btn-primary btn-lg" onClick={pass} autoFocus>
            I'm 18 or older, enter
          </button>
          <a className="btn btn-glass btn-lg" href="https://www.google.com" rel="noreferrer">
            Leave
          </a>
        </div>
        <p className="gate-fine">
          This site is labeled with RTA. Parents can block it with device-level parental controls.
        </p>
      </div>
    </main>
  );
}
