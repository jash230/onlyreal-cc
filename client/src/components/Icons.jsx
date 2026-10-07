// One icon language: 24px grid, 1.75 stroke, round caps.
const base = {
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

export const HomeIcon = ({ filled, ...p }) => (
  <svg {...base} {...p}>
    <path d="M4 10.2 12 4l8 6.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9v5.5H5.5A1.5 1.5 0 0 1 4 19z" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);
export const PlusIcon = (p) => (
  <svg {...base} strokeWidth={2.25} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const UserIcon = ({ filled, ...p }) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="8.5" r="3.75" fill={filled ? 'currentColor' : 'none'} />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);

// Brand "like": a pair of lips that fills lipstick red.
export const LipsIcon = ({ filled, ...p }) => (
  <svg {...base} {...p}>
    <path
      d="M2 12c2.4-3.4 4.8-5.4 7.1-5.4 1.3 0 2.1.7 2.9 1.5.8-.8 1.6-1.5 2.9-1.5 2.3 0 4.7 2 7.1 5.4-2.3 3.6-5.6 6-10 6s-7.7-2.4-10-6z"
      fill={filled ? 'currentColor' : 'none'}
    />
    <path d="M2.6 12c3.2.9 6.2 1.3 9.4 1.3s6.2-.4 9.4-1.3" stroke={filled ? 'rgba(20,10,14,.55)' : 'currentColor'} />
  </svg>
);
export const CommentIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-4.4A8 8 0 1 1 20.5 11.5z" />
  </svg>
);
export const ShareIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M14 4.5 21 11l-7 6.5V14c-5 0-8.2 1.4-10.5 5 .7-5.5 3.6-9.6 10.5-10.5z" />
  </svg>
);
export const FlagIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M5 21V4.5M5 4.5h11.5l-2 4 2 4H5" />
  </svg>
);
export const MuteIcon = ({ muted, ...p }) => (
  <svg {...base} {...p}>
    <path d="M11 5.5 6.5 9H3.5v6h3l4.5 3.5z" />
    {muted ? <path d="m21 9.5-5 5M16 9.5l5 5" /> : <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />}
  </svg>
);
export const PlayIcon = (p) => (
  <svg {...base} fill="currentColor" stroke="none" {...p}>
    <path d="M8 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8A.8.8 0 0 0 8 5.2z" />
  </svg>
);
export const CloseIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const SearchIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </svg>
);
export const ChatIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 5.5h15v10.5H9l-4.5 3.5z" />
  </svg>
);
export const TrashIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7" />
  </svg>
);
export const MoreIcon = (p) => (
  <svg {...base} {...p}>
    <circle cx="5.5" cy="12" r="1.2" fill="currentColor" />
    <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18.5" cy="12" r="1.2" fill="currentColor" />
  </svg>
);
export const BackIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M15 5 8 12l7 7" />
  </svg>
);
export const UploadIcon = (p) => (
  <svg {...base} {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" />
  </svg>
);
