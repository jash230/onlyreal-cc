import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';
import { api, uploadFile } from '../api.js';
import { UploadIcon } from '../components/Icons.jsx';

const MAX_MB = 200;

export default function Upload() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [caption, setCaption] = useState('');
  const [attestAge, setAttestAge] = useState(false);
  const [attestConsent, setAttestConsent] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  if (!user) {
    return (
      <div className="page center join">
        <span className="dropzone-icon">
          <UploadIcon width={28} height={28} />
        </span>
        <h1>Post your first clip</h1>
        <p className="muted">Create an account to share vertical videos with people who follow you.</p>
        <div className="join-actions">
          <button className="btn btn-primary btn-lg" onClick={() => login(true)}>
            Create account
          </button>
          <button className="btn btn-glass btn-lg" onClick={() => login()}>
            Log in
          </button>
        </div>
      </div>
    );
  }

  const pick = (f) => {
    setError('');
    if (!f) return;
    if (!f.type.startsWith('video/')) return setError('That file is not a video.');
    if (f.size > MAX_MB * 1024 * 1024) return setError(`Videos must be under ${MAX_MB} MB.`);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      setProgress(0);
      const url = await uploadFile('videos', file, setProgress);
      const { video } = await api('/videos', { method: 'POST', body: { url, caption, attestAge, attestConsent } });
      navigate(`/v/${video.id}`);
    } catch (err) {
      setError(err.message);
      setProgress(null);
    }
  };

  const uploading = progress !== null;

  return (
    <div className="page page-wide">
      <header className="page-head">
        <h1>Post a clip</h1>
      </header>
      <form className="upload" onSubmit={submit}>
        <div
          className={`dropzone${file ? ' has-file' : ''}`}
          onClick={() => !uploading && inputRef.current.click()}
          // Keyboard users choose a file the same way; the real file input is hidden.
          role="button"
          tabIndex={uploading ? -1 : 0}
          aria-label={file ? `Selected video: ${file.name}. Press Enter to choose a different one.` : 'Choose a video to upload'}
          aria-disabled={uploading || undefined}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !uploading) {
              e.preventDefault();
              inputRef.current.click();
            }
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pick(e.dataTransfer.files[0]);
          }}
        >
          {preview ? (
            <video src={preview} autoPlay muted loop playsInline />
          ) : (
            <div className="dropzone-empty">
              <span className="dropzone-icon">
                <UploadIcon width={28} height={28} />
              </span>
              <strong>Drop a vertical video here</strong>
              <span className="muted">or click to choose one. MP4, WebM or MOV up to {MAX_MB} MB. Shoot 9:16 for full screen.</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            hidden
            onChange={(e) => pick(e.target.files[0])}
          />
        </div>

        <div className="form">
          <label>
            Caption
            <textarea
              rows={3}
              maxLength={300}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Say something about this clip"
            />
            <small>{caption.length}/300</small>
          </label>

          <fieldset className="attest">
            <legend>Before you post, confirm</legend>
            <label className="check">
              <input type="checkbox" checked={attestAge} onChange={(e) => setAttestAge(e.target.checked)} />
              <span>Every person appearing in this video was 18 or older at the time it was recorded.</span>
            </label>
            <label className="check">
              <input type="checkbox" checked={attestConsent} onChange={(e) => setAttestConsent(e.target.checked)} />
              <span>
                Every person appearing consented to being recorded and to this video being published on OnlyReal, and I
                own the rights to it. I agree to the <Link to="/legal/guidelines">Community Guidelines</Link>.
              </span>
            </label>
          </fieldset>

          {error && <p className="error" role="alert">{error}</p>}
          {uploading && (
            <div
              className="progress"
              role="progressbar"
              aria-label="Upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
            >
              <div style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          <div className="row">
            {file && !uploading && (
              <button
                type="button"
                className="btn btn-glass"
                onClick={() => {
                  setFile(null);
                  setPreview('');
                }}
              >
                Change video
              </button>
            )}
            <button className="btn btn-primary btn-lg" disabled={!file || !attestAge || !attestConsent || uploading}>
              {uploading ? `Uploading ${Math.round(progress * 100)}%` : 'Post'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
