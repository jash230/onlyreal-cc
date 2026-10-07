import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Avatar from './Avatar.jsx';
import VideoGrid from './VideoGrid.jsx';
import Modal from './Modal.jsx';
import { api, compact, uploadFile } from '../api.js';
import { useAuth } from '../AuthContext.jsx';

export default function ProfileView({ username }) {
  const { requireUser, logout, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [videos, setVideos] = useState(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    api(`/users/${encodeURIComponent(username)}`)
      .then((d) => setProfile(d.user))
      .catch((e) => setError(e.message));
    api(`/videos/user/${encodeURIComponent(username)}`)
      .then((d) => setVideos(d.videos))
      .catch(() => setVideos([]));
  }, [username]);

  if (error) {
    return (
      <div className="page center">
        <h1>Profile not found</h1>
        <p className="muted">No one goes by @{username}. Check the spelling or find creators in Search.</p>
        <Link className="btn btn-glass" to="/search">
          Go to Search
        </Link>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="page">
        <div className="profile-head skeleton-head" aria-busy="true" />
      </div>
    );
  }

  const follow = async () => {
    if (!requireUser()) return;
    const d = await api(`/users/${profile.username}/follow`, { method: 'POST' });
    setProfile({ ...profile, isFollowing: d.following, followers: d.followers });
  };

  return (
    <div className="page">
      <header className="profile-head">
        <Avatar user={profile} size={112} ring />
        <div className="profile-meta">
          <h1 className="profile-name">{profile.displayName}</h1>
          <p className="profile-handle">@{profile.username}</p>
          {profile.bio && <p className="bio">{profile.bio}</p>}
          <dl className="stats">
            <div>
              <dt>Followers</dt>
              <dd>{compact(profile.followers)}</dd>
            </div>
            <div>
              <dt>Following</dt>
              <dd>{compact(profile.following)}</dd>
            </div>
            <div>
              <dt>Likes</dt>
              <dd>{compact(profile.likes)}</dd>
            </div>
          </dl>
          <div className="row">
            {profile.isMe ? (
              <>
                <button className="btn btn-glass" onClick={() => setEditing(true)}>
                  Edit profile
                </button>
                <Link className="btn btn-primary" to="/upload">
                  Post a clip
                </Link>
              </>
            ) : (
              <button className={`btn ${profile.isFollowing ? 'btn-glass' : 'btn-primary'}`} onClick={follow}>
                {profile.isFollowing ? 'Following' : 'Follow'}
              </button>
            )}
          </div>
        </div>
      </header>

      <h2 className="section-title">
        Clips <span className="count">{videos?.length ?? ''}</span>
      </h2>
      {videos === null ? (
        <div className="video-grid" aria-hidden="true">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="tile skeleton" />
          ))}
        </div>
      ) : (
        <VideoGrid
          videos={videos}
          empty={
            profile.isMe ? (
              <>
                <p>You haven’t posted anything yet. Your first clip shows up here.</p>
                <Link className="btn btn-primary" to="/upload">
                  Post your first clip
                </Link>
              </>
            ) : (
              <p>@{profile.username} hasn’t posted any clips yet.</p>
            )
          }
        />
      )}

      {profile.isMe && (
        <footer className="profile-foot">
          <button className="link-quiet" onClick={logout}>
            Log out
          </button>
        </footer>
      )}

      {editing && (
        <EditProfile
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(u) => {
            setProfile(u);
            setUser(u);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

function EditProfile({ profile, onClose, onSaved }) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const avatarUrl = avatar ? await uploadFile('avatars', profile.id, avatar) : undefined;
      const { user } = await api('/users/me', { method: 'PATCH', body: { displayName, bio, avatarUrl } });
      onSaved(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <label>
          Photo
          <input type="file" accept="image/*" onChange={(e) => setAvatar(e.target.files[0])} />
        </label>
        <label>
          Display name
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={50} />
        </label>
        <label>
          Bio
          <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </Modal>
  );
}
