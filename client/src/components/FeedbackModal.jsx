import { useState } from 'react';
import Modal from './Modal.jsx';
import { api } from '../api.js';

export default function FeedbackModal({ onClose }) {
  const [message, setMessage] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setState('sending');
    setError('');
    try {
      await api('/feedback', { method: 'POST', body: { message } });
      setState('sent');
    } catch (err) {
      setError(err.message);
      setState('idle');
    }
  };

  return (
    <Modal title="Share feedback" onClose={onClose}>
      {state === 'sent' ? (
        <div className="form">
          <p>Thanks — we read every message.</p>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      ) : (
        <form className="form" onSubmit={submit}>
          <label>
            What's working, what isn't?
            <textarea rows={5} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} required />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" disabled={state === 'sending'}>
            {state === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </Modal>
  );
}
