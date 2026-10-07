// Deterministic tones from the brand palette for people without a photo.
const TONES = ['#7a1f33', '#4a2340', '#8a3b2a', '#2f3a52', '#5c4a2a'];

export default function Avatar({ user, size = 40, ring = false }) {
  const style = { width: size, height: size, fontSize: size * 0.42 };
  const cls = `avatar${ring ? ' avatar-ring' : ''}`;
  if (user?.avatarUrl) return <img className={cls} style={style} src={user.avatarUrl} alt="" />;
  const name = user?.displayName || user?.username || '?';
  const key = String(user?.id || name);
  const tone = TONES[[...key].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length];
  return (
    <span className={`${cls} avatar-fallback`} style={{ ...style, background: tone }} aria-hidden="true">
      {name[0].toUpperCase()}
    </span>
  );
}
