import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReelFeed from '../components/ReelFeed.jsx';
import { BackIcon, TrashIcon } from '../components/Icons.jsx';
import { api } from '../api.js';

export default function VideoPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setVideo(null);
    api(`/videos/${id}`)
      .then((d) => setVideo(d.video))
      .catch((e) => setError(e.message));
  }, [id]);

  const initial = useMemo(() => (video ? [video] : null), [video]);

  const remove = async () => {
    if (!confirm('Delete this clip? This cannot be undone.')) return;
    await api(`/videos/${id}`, { method: 'DELETE' });
    navigate('/me');
  };

  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'));

  if (error) {
    return (
      <div className="page center">
        <h1>Clip unavailable</h1>
        <p className="muted">It may have been removed by its creator or hidden while we review a report.</p>
        <button className="btn btn-ghost" onClick={() => navigate('/')}>
          Back to the feed
        </button>
      </div>
    );
  }
  if (!video) {
    return (
      <div className="feed-page">
        <div className="reel reel-skeleton" aria-busy="true">
          <div className="reel-frame" />
        </div>
      </div>
    );
  }

  return (
    <div className="feed-page">
      <div className="clip-bar">
        <button className="icon-btn glass" onClick={back} aria-label="Back">
          <BackIcon />
        </button>
        {video.author.isMe && (
          <button className="btn btn-glass" onClick={remove}>
            <TrashIcon width={18} height={18} /> Delete
          </button>
        )}
      </div>
      <ReelFeed initial={initial} empty="" />
    </div>
  );
}
