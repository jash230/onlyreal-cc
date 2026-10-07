import { Link } from 'react-router-dom';
import { LipsIcon, PlayIcon } from './Icons.jsx';
import { compact } from '../api.js';

// Hovering a tile (desktop) previews the clip; touch devices just tap through.
const preview = (e, play) => {
  const v = e.currentTarget.querySelector('video');
  if (!v || !window.matchMedia('(hover: hover)').matches) return;
  if (play) v.play().catch(() => {});
  else {
    v.pause();
    v.currentTime = 0.5;
  }
};

export default function VideoGrid({ videos, empty, showAuthor = false }) {
  if (!videos.length) return <div className="grid-empty">{empty}</div>;
  return (
    <div className="video-grid">
      {videos.map((v) => (
        <Link
          key={v.id}
          to={`/v/${v.id}`}
          className="tile"
          onMouseEnter={(e) => preview(e, true)}
          onMouseLeave={(e) => preview(e, false)}
          aria-label={`${v.caption || 'Clip'} by @${v.author.username}`}
        >
          <video src={`${v.url}#t=0.5`} preload="metadata" muted playsInline loop />
          <div className="tile-shade">
            {showAuthor && <span className="tile-author">@{v.author.username}</span>}
            <span className="tile-stats">
              <span>
                <PlayIcon width={14} height={14} /> {compact(v.views)}
              </span>
              <span>
                <LipsIcon width={16} height={16} filled /> {compact(v.likeCount)}
              </span>
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
}
