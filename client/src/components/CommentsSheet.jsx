import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from './Modal.jsx';
import Avatar from './Avatar.jsx';
import { api, timeAgo } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function CommentsSheet({ videoId, onClose, onCount }) {
  const { user, requireUser } = useAuth();
  const [comments, setComments] = useState(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/videos/${videoId}/comments`)
      .then((d) => setComments(d.comments))
      .catch((e) => setError(e.message));
  }, [videoId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!requireUser()) return;
    setBusy(true);
    setError('');
    try {
      const { comment } = await api(`/videos/${videoId}/comments`, { method: 'POST', body: { body } });
      const next = [comment, ...(comments || [])];
      setComments(next);
      onCount?.(next.length);
      setBody('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={comments ? `${comments.length} comments` : 'Comments'} onClose={onClose} variant="sheet">
      <ul className="comments">
        {comments === null && !error && <li className="muted">Loading…</li>}
        {comments?.length === 0 && <li className="muted">No comments yet. Start the conversation.</li>}
        {comments?.map((c) => (
          <li key={c.id} className="comment">
            <Link to={`/u/${c.author.username}`} onClick={onClose}>
              <Avatar user={c.author} size={32} />
            </Link>
            <div>
              <div className="comment-meta">
                <Link to={`/u/${c.author.username}`} onClick={onClose}>
                  {c.author.displayName}
                </Link>
                <span className="muted">· {timeAgo(c.createdAt)}</span>
              </div>
              <p>{c.body}</p>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="error">{error}</p>}
      <form className="comment-form" onSubmit={submit}>
        <input
          placeholder={user ? 'Add a comment…' : 'Sign up to comment'}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onFocus={() => !user && requireUser()}
          maxLength={500}
        />
        <button className="btn btn-primary" disabled={!body.trim() || busy}>
          Post
        </button>
      </form>
    </Modal>
  );
}
