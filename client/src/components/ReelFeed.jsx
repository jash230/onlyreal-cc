import { useCallback, useEffect, useRef, useState } from 'react';
import Reel from './Reel.jsx';
import { api } from '../api.js';

// Only reels near the active one keep a <video> element; the rest are cheap placeholders.
const KEEP_BEHIND = 1;
const KEEP_AHEAD = 2;
const PREFETCH_FROM_END = 4;
const JUMP_MS = 220;
const WHEEL_GESTURE_GAP_MS = 260;

let mutedPref = true; // shared across feeds for the session; browsers require muted autoplay at first

const newSeed = () => Math.random().toString(36).slice(2);

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function ReelFeed({ endpoint, empty, initial }) {
  const [videos, setVideos] = useState(initial || []);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(!initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(mutedPref);
  const containerRef = useRef(null);
  const activeRef = useRef(0);
  const countRef = useRef(0);
  const seedRef = useRef(newSeed()); // shuffles the For You order; new on every load or tab switch
  activeRef.current = active;
  countRef.current = videos.length;

  useEffect(() => {
    setVideos(initial || []);
    setPage(0);
    setHasMore(!initial);
    setError('');
    setActive(0);
    seedRef.current = newSeed();
    if (containerRef.current) containerRef.current.scrollTop = 0;
  }, [endpoint, initial]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !endpoint) return;
    setLoading(true);
    try {
      const d = await api(`${endpoint}?page=${page}&seed=${seedRef.current}`);
      setVideos((prev) => {
        const seen = new Set(prev.map((v) => v.id));
        return [...prev, ...d.videos.filter((v) => !seen.has(v.id))];
      });
      setHasMore(d.hasMore);
      setPage((p) => p + 1);
    } catch (e) {
      setError(e.message);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [endpoint, page, hasMore, loading]);

  // Fetch the next page while there are still a few reels left to watch.
  useEffect(() => {
    if (active >= videos.length - PREFETCH_FROM_END) loadMore();
  }, [active, videos.length, loadMore]);

  // Active reel = whichever is past the halfway point. One rAF-throttled listener
  // instead of an observer per reel, so the next clip starts as soon as it's mostly in view.
  useEffect(() => {
    const el = containerRef.current;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const i = Math.round(el.scrollTop / el.clientHeight);
        if (i !== activeRef.current) setActive(Math.min(Math.max(i, 0), Math.max(countRef.current - 1, 0)));
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Fast programmatic jump between reels (wheel / keyboard). Snap is paused while animating
  // so it doesn't fight the animation, then restored to land exactly on the reel.
  const jumpAnim = useRef({ frame: 0, running: false });
  const goTo = useCallback((index) => {
    const el = containerRef.current;
    if (!el) return;
    const i = Math.min(Math.max(index, 0), Math.max(countRef.current - 1, 0));
    const to = i * el.clientHeight;
    const anim = jumpAnim.current;
    cancelAnimationFrame(anim.frame);
    if (prefersReducedMotion()) {
      el.scrollTop = to;
      return;
    }
    const from = el.scrollTop;
    const start = performance.now();
    el.style.scrollSnapType = 'none';
    anim.running = true;
    const step = (now) => {
      const t = Math.min(1, (now - start) / JUMP_MS);
      el.scrollTop = from + (to - from) * (1 - Math.pow(1 - t, 3));
      if (t < 1) anim.frame = requestAnimationFrame(step);
      else {
        el.style.scrollSnapType = '';
        anim.running = false;
      }
    };
    anim.frame = requestAnimationFrame(step);
  }, []);

  // One wheel gesture = one reel. A gesture ends only once the wheel has been quiet for
  // WHEEL_GESTURE_GAP_MS: a single mouse-wheel flick spins 2–3 notches over ~250ms and
  // trackpad inertia keeps firing for up to a second, and neither may move a second reel.
  // A fresh trackpad flick during inertia still starts a new gesture: deltas had decayed
  // below half their peak and then spike back up. An accelerating mouse wheel only rises,
  // so it never qualifies.
  useEffect(() => {
    const el = containerRef.current;
    const w = { locked: false, last: 0, lastDelta: 0, peak: 0, decaying: false, timer: 0 };
    const unlockWhenQuiet = () => {
      clearTimeout(w.timer);
      w.timer = setTimeout(() => {
        if (performance.now() - w.last > WHEEL_GESTURE_GAP_MS && !jumpAnim.current.running) w.locked = false;
        else unlockWhenQuiet();
      }, 60);
    };
    const onWheel = (e) => {
      if (e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
      e.preventDefault();
      const delta = Math.abs(e.deltaY);
      if (delta > w.peak && !w.decaying) w.peak = delta;
      else if (delta < w.peak * 0.5) w.decaying = true;
      const freshFlick = w.decaying && delta > 20 && delta > w.lastDelta * 2;
      const now = performance.now();
      w.last = now;
      w.lastDelta = delta;
      if (w.locked && !(freshFlick && !jumpAnim.current.running)) return;
      if (delta < 4) return;
      w.locked = true;
      w.peak = delta;
      w.decaying = false;
      goTo(activeRef.current + Math.sign(e.deltaY));
      unlockWhenQuiet();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      clearTimeout(w.timer);
    };
  }, [goTo]);

  const toggleMute = useCallback(() => {
    setMuted((m) => (mutedPref = !m));
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.closest('input,textarea,select,[role="dialog"]') || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowDown' || e.key === 'j') goTo(activeRef.current + 1);
      else if (e.key === 'ArrowUp' || e.key === 'k') goTo(activeRef.current - 1);
      else if (e.key === 'm') toggleMute();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, toggleMute]);

  const onAuthorFollow = useCallback(
    (authorId, following) =>
      setVideos((vs) =>
        vs.map((v) => (v.author.id === authorId ? { ...v, author: { ...v.author, isFollowing: following } } : v))
      ),
    []
  );

  const onRemoved = useCallback((id) => setVideos((vs) => vs.filter((v) => v.id !== id)), []);

  return (
    <div className="reel-feed" ref={containerRef}>
      {videos.map((v, i) => (
        <Reel
          key={v.id}
          video={v}
          active={i === active}
          mounted={i >= active - KEEP_BEHIND && i <= active + KEEP_AHEAD}
          preload={i >= active ? 'auto' : 'metadata'}
          muted={muted}
          onToggleMute={toggleMute}
          onAuthorFollow={onAuthorFollow}
          onRemoved={onRemoved}
        />
      ))}
      {videos.length === 0 &&
        (loading || (hasMore && !error) ? (
          <div className="reel reel-skeleton" aria-busy="true" aria-label="Loading clips">
            <div className="reel-frame" />
          </div>
        ) : (
          <div className="reel-empty">{error || empty}</div>
        ))}
    </div>
  );
}
