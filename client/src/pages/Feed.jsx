import { useState } from 'react';
import ReelFeed from '../components/ReelFeed.jsx';
import { useAuth } from '../AuthContext.jsx';

const TABS = [
  ['foryou', 'For You'],
  ['following', 'Following'],
];

export default function Feed() {
  const { user, login } = useAuth();
  const [tab, setTab] = useState('foryou');
  const following = tab === 'following';

  return (
    <div className="feed-page">
      <div className="feed-tabs glass" role="tablist" style={{ '--tab': following ? 1 : 0 }}>
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
        <span className="feed-tabs-indicator" aria-hidden="true" />
      </div>
      {following && !user ? (
        <div className="reel-empty">
          <img src="/logo-mark.png" alt="" width="88" height="64" />
          <h2>Your people, all in one place</h2>
          <p>Log in to see new clips from the creators you follow.</p>
          <button className="btn btn-primary" onClick={() => login()}>
            Log in
          </button>
        </div>
      ) : (
        <ReelFeed
          key={tab}
          endpoint={following ? '/videos/following' : '/videos/feed'}
          empty={
            following ? (
              <>
                <h2>Nothing here yet</h2>
                <p>Follow creators from For You or Discover and their clips land here.</p>
              </>
            ) : (
              <>
                <h2>No clips yet</h2>
                <p>Be the first to post something real.</p>
              </>
            )
          }
        />
      )}
    </div>
  );
}
