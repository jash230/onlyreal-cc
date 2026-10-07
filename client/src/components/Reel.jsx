import { memo, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import CommentsSheet from './CommentsSheet.jsx';
import ReportModal from './ReportModal.jsx';
import { LipsIcon, CommentIcon, ShareIcon, FlagIcon, MuteIcon, PlayIcon, TrashIcon } from './Icons.jsx';
import { api, compact, timeAgo } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

const DOUBLE_TAP_MS = 240;

function Reel({ video, active, mounted, preload, muted, onToggleMute, onAuthorFollow, onRemoved }) {
  const { requireUser, isAdmin } = useAuth();
  const videoRef = useRef(null);
  const barRef = useRef(null);
  const tapTimer = useRef(0);
  const viewed = useRef(false);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [liked, setLiked] = useState(video.liked);
  const [likeCount, setLikeCount] = useState(video.likeCount);
  const [commentCount, setCommentCount] = useState(video.commentCount);
  const [sparks, setSparks] = useState(0);
  const [stamps, setStamps] = useState([]);
  const [expanded, setExpanded] = useState(false);
  const [panel, setPanel] = useState(null); // 'comments' | 'report'
  const [toast, setToast] = useState('');

  // Play/pause follows the active reel; the first play counts a view.
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      setPaused(false);
      el.play().catch(() => setPaused(true));
      if (!viewed.current) {
        viewed.current = true;
        api(`/videos/${video.id}/view`, { method: 'POST' }).catch(() => {});
      }
    } else {
      el.pause();
      setExpanded(false);
    }
  }, [active, mounted, video.id]);

  // Progress bar driven by rAF on the active reel only — no React re-render per frame.
  useEffect(() => {
    if (!active) return;
    let frame;
    const tick = () => {
      const el = videoRef.current;
      if (el && barRef.current && el.duration) barRef.current.style.transform = `scaleX(${el.currentTime / el.duration})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  useEffect(() => () => clearTimeout(tapTimer.current), []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play();
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };

  const like = async (fromDoubleTap = false) => {
    if (!requireUser()) return;
    if (fromDoubleTap && liked) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((c) => c + (next ? 1 : -1));
    if (next) setSparks((s) => s + 1);
    try {
      const d = await api(`/videos/${video.id}/like`, { method: 'POST' });
      setLiked(d.liked);
      setLikeCount(d.likeCount);
    } catch {
      setLiked(!next);
      setLikeCount((c) => c + (next ? -1 : 1));
    }
  };

  // Single tap pauses; double tap leaves a kiss where you tapped and likes the clip.
  const onStageClick = (e) => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = 0;
      const box = e.currentTarget.getBoundingClientRect();
      const stamp = { id: Date.now(), x: e.clientX - box.left, y: e.clientY - box.top, r: Math.random() * 30 - 15 };
      setStamps((s) => [...s, stamp]);
      setTimeout(() => setStamps((s) => s.filter((x) => x.id !== stamp.id)), 900);
      like(true);
      return;
    }
    tapTimer.current = setTimeout(() => {
      tapTimer.current = 0;
      togglePlay();
    }, DOUBLE_TAP_MS);
  };

  const seek = (e) => {
    const el = videoRef.current;
    if (!el?.duration) return;
    const box = e.currentTarget.getBoundingClientRect();
    el.currentTime = ((e.clientX - box.left) / box.width) * el.duration;
  };

  const follow = async () => {
    if (!requireUser()) return;
    try {
      const d = await api(`/users/${video.author.username}/follow`, { method: 'POST' });
      onAuthorFollow?.(video.author.id, d.following);
      flash(d.following ? `Following @${video.author.username}` : 'Unfollowed');
    } catch (e) {
      flash(e.message);
    }
  };

  const share = async () => {
    const url = `${location.origin}/v/${video.id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: 'OnlyReal' });
      else {
        await navigator.clipboard.writeText(url);
        flash('Link copied');
      }
    } catch {
      /* share cancelled */
    }
  };

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  };

  const remove = async () => {
    if (!confirm(`Delete this clip by @${video.author.username}? This cannot be undone.`)) return;
    try {
      await api(`/videos/${video.id}`, { method: 'DELETE' });
      onRemoved?.(video.id);
    } catch (e) {
      flash(e.message);
    }
  };

  const { author } = video;

  return (
    <section className={`reel${active ? ' is-active' : ''}`} aria-label={`Clip by @${author.username}`}>
      <div className="reel-frame">
        <div className="reel-stage" onClick={onStageClick}>
          {mounted ? (
            <video
              ref={videoRef}
              src={video.url}
              loop
              playsInline
              muted={muted}
              preload={preload}
              onWaiting={() => active && setBuffering(true)}
              onPlaying={() => setBuffering(false)}
            />
          ) : (
            <div className="reel-placeholder" />
          )}
          {stamps.map((s) => (
            <img
              key={s.id}
              className="kiss-stamp"
              src="/logo-mark.png"
              alt=""
              style={{ left: s.x, top: s.y, '--r': `${s.r}deg` }}
            />
          ))}
          {paused && (
            <span className="reel-paused" aria-hidden="true">
              <PlayIcon width={40} height={40} />
            </span>
          )}
          {buffering && !paused && <span className="reel-buffering" aria-hidden="true" />}
        </div>

        <button className="reel-mute glass" onClick={onToggleMute} aria-label={muted ? 'Unmute (M)' : 'Mute (M)'}>
          <MuteIcon muted={muted} />
        </button>

        <div className="reel-info">
          <div className="reel-byline">
            <Link to={`/u/${author.username}`} className="reel-author">
              <Avatar user={author} size={36} />
              <span className="reel-name">{author.displayName}</span>
            </Link>
            {!author.isMe && (
              <button className={`follow-pill${author.isFollowing ? ' is-following' : ''}`} onClick={follow}>
                {author.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
          {video.caption && (
            <p className={`reel-caption${expanded ? ' is-open' : ''}`} onClick={() => setExpanded((x) => !x)}>
              {video.caption}
            </p>
          )}
          <p className="reel-meta">
            <span>@{author.username}</span>
            <time dateTime={video.createdAt}>{timeAgo(video.createdAt)} ago</time>
          </p>
        </div>

        <div
          className="reel-progress"
          onClick={seek}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={-1}
        >
          <div ref={barRef} />
        </div>
      </div>

      <aside className="reel-actions">
        <button
          className={`action action-like${liked ? ' is-on' : ''}`}
          onClick={() => like()}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike' : 'Like'}
        >
          <span className="action-icon">
            <LipsIcon filled={liked} />
            {sparks > 0 && (
              <span key={sparks} className="sparks" aria-hidden="true">
                {Array.from({ length: 8 }, (_, i) => (
                  <i key={i} style={{ '--a': `${i * 45}deg` }} />
                ))}
              </span>
            )}
          </span>
          <span className="action-count">{compact(likeCount)}</span>
        </button>
        <button className="action" onClick={() => setPanel('comments')} aria-label="Comments">
          <span className="action-icon">
            <CommentIcon />
          </span>
          <span className="action-count">{compact(commentCount)}</span>
        </button>
        <button className="action" onClick={share} aria-label="Share">
          <span className="action-icon">
            <ShareIcon />
          </span>
          <span className="action-count">Share</span>
        </button>
        {(isAdmin || author.isMe) && (
          <button className="action action-quiet" onClick={remove} aria-label="Delete clip">
            <span className="action-icon">
              <TrashIcon />
            </span>
          </button>
        )}
        {!author.isMe && (
          <button className="action action-quiet" onClick={() => setPanel('report')} aria-label="Report">
            <span className="action-icon">
              <FlagIcon />
            </span>
          </button>
        )}
      </aside>

      <div className="toast" role="status" aria-live="polite">
        {toast && <span>{toast}</span>}
      </div>
      {panel === 'comments' && (
        <CommentsSheet videoId={video.id} onClose={() => setPanel(null)} onCount={setCommentCount} />
      )}
      {panel === 'report' && (
        <ReportModal
          videoId={video.id}
          onClose={() => setPanel(null)}
          onReported={(reason) => (reason === 'underage' || reason === 'non_consensual') && onRemoved?.(video.id)}
        />
      )}
    </section>
  );
}

// Re-render only reels whose props change (active/mounted flip for ~3 reels per scroll).
export default memo(Reel);
