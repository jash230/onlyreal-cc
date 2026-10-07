import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';

const REASONS = [
  ['underage', 'Someone appears to be under 18'],
  ['non_consensual', 'Non-consensual or leaked content'],
  ['illegal', 'Other illegal content'],
  ['copyright', 'Copyright / stolen content'],
  ['spam', 'Spam or scam'],
  ['other', 'Something else'],
];

export default function ReportModal({ videoId, onClose, onReported }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/videos/${videoId}/report`, { method: 'POST', body: { reason, details } });
      setDone(true);
      onReported?.(reason);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Report video" onClose={onClose}>
      {done ? (
        <div className="form">
          <p>Thanks. Our team will review this report. Reports of minors or non-consensual content hide the video immediately while we investigate.</p>
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <div className="radio-list">
            {REASONS.map(([value, label]) => (
              <label key={value} className={`radio${reason === value ? ' selected' : ''}`}>
                <input type="radio" name="reason" value={value} checked={reason === value} onChange={() => setReason(value)} />
                {label}
              </label>
            ))}
          </div>
          <label>
            Details (optional)
            <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-danger" disabled={!reason || busy}>
            {busy ? 'Sending…' : 'Submit report'}
          </button>
        </form>
      )}
    </Modal>
  );
}
