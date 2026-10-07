import { useEffect, useRef, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { HomeIcon, SearchIcon, PlusIcon, UserIcon, MoreIcon } from './Icons.jsx';
import { useAuth } from '../AuthContext.jsx';
import Avatar from './Avatar.jsx';

// Floating glass dock: a vertical rail on desktop, a bottom dock on phones.
export default function Nav({ onFeedback }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => setMoreOpen(false), [pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const close = (e) => !moreRef.current?.contains(e.target) && setMoreOpen(false);
    const esc = (e) => e.key === 'Escape' && setMoreOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [moreOpen]);

  const item = ({ isActive }) => `dock-item${isActive ? ' is-active' : ''}`;

  return (
    <nav className="dock glass" aria-label="Main">
      <Link to="/" className="dock-logo" aria-label="OnlyReal home">
        <img src="/logo-mark.png" alt="" width="44" height="32" />
      </Link>

      <NavLink to="/" end className={item}>
        {({ isActive }) => (
          <>
            <span className="dock-icon">
              <HomeIcon filled={isActive} />
            </span>
            <span>Feed</span>
          </>
        )}
      </NavLink>
      <NavLink to="/search" className={item}>
        <span className="dock-icon">
          <SearchIcon />
        </span>
        <span>Search</span>
      </NavLink>
      <NavLink to="/upload" className={({ isActive }) => `dock-item dock-upload${isActive ? ' is-active' : ''}`}>
        <span className="dock-icon">
          <span className="upload-key">
            <PlusIcon />
          </span>
        </span>
        <span>Upload</span>
      </NavLink>
      <NavLink to="/me" className={item}>
        {({ isActive }) => (
          <>
            <span className="dock-icon">
              {user ? <Avatar user={user} size={26} ring={isActive} /> : <UserIcon filled={isActive} />}
            </span>
            <span>Account</span>
          </>
        )}
      </NavLink>

      <div className="dock-more" ref={moreRef}>
        <button
          className="dock-item"
          aria-expanded={moreOpen}
          aria-haspopup="menu"
          onClick={() => setMoreOpen((o) => !o)}
        >
          <span className="dock-icon">
            <MoreIcon />
          </span>
          <span>More</span>
        </button>
        {moreOpen && (
          <div className="popover glass" role="menu">
            <button role="menuitem" onClick={() => (setMoreOpen(false), onFeedback())}>
              Share feedback
            </button>
            <Link role="menuitem" to="/legal/guidelines">Community guidelines</Link>
            <Link role="menuitem" to="/legal/terms">Terms of service</Link>
            <Link role="menuitem" to="/legal/2257">18 U.S.C. 2257</Link>
          </div>
        )}
      </div>
    </nav>
  );
}
