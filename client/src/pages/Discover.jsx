import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from '../components/Avatar.jsx';
import VideoGrid from '../components/VideoGrid.jsx';
import { SearchIcon, CloseIcon } from '../components/Icons.jsx';
import { api, compact } from '../api.js';

export default function Discover() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState(null);
  const [trending, setTrending] = useState(null);

  useEffect(() => {
    api('/videos/trending').then((d) => setTrending(d.videos)).catch(() => setTrending([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api(`/users/search?q=${encodeURIComponent(q)}`).then((d) => setUsers(d.users)).catch(() => setUsers([]));
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="page page-wide">
      <header className="page-head">
        <h1>Discover</h1>
        <label className="search">
          <SearchIcon />
          <input
            type="search"
            placeholder="Search creators by name or @handle"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search creators"
          />
          {q && (
            <button type="button" className="search-clear" onClick={() => setQ('')} aria-label="Clear search">
              <CloseIcon width={18} height={18} />
            </button>
          )}
        </label>
      </header>

      <section aria-labelledby="creators-h">
        <h2 id="creators-h" className="section-title">
          {q ? `Creators matching “${q}”` : 'Creators to follow'}
        </h2>
        <div className="creator-row">
          {users === null &&
            Array.from({ length: 5 }, (_, i) => <div key={i} className="creator-card skeleton" aria-hidden="true" />)}
          {users?.length === 0 && <p className="muted">No creators match that. Try a shorter name.</p>}
          {users?.map((u) => (
            <Link key={u.id} to={`/u/${u.username}`} className="creator-card">
              <Avatar user={u} size={72} ring />
              <strong>{u.displayName}</strong>
              <span className="muted">@{u.username}</span>
              <span className="creator-followers">
                <b>{compact(u.followers)}</b> followers
              </span>
            </Link>
          ))}
        </div>
      </section>

      {!q && (
        <section aria-labelledby="trending-h">
          <h2 id="trending-h" className="section-title">
            Trending this week
          </h2>
          {trending === null ? (
            <div className="video-grid" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="tile skeleton" />
              ))}
            </div>
          ) : (
            <VideoGrid videos={trending} showAuthor empty={<p className="muted">Nothing is trending yet this week.</p>} />
          )}
        </section>
      )}
    </div>
  );
}
