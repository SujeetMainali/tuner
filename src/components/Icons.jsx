/* Stroke icons used across the app. Decorative: each is aria-hidden; the control around it has the name. */

const Svg = ({ size = 20, sw = 2, children, fill = 'none', ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
    {children}
  </svg>
);

export const IconHome = (p) => <Svg {...p}><path d="m3 11 9-7 9 7" /><path d="M5 10v10h14V10" /></Svg>;
export const IconTune = (p) => <Svg {...p}><path d="M4 16a8 8 0 0 1 16 0" /><path d="m12 16 3-6" /></Svg>;
export const IconKeys = (p) => <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v10M15 4v10M9 14v6M15 14v6" /></Svg>;
export const IconMusic = (p) => <Svg {...p}><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></Svg>;
export const IconList = (p) => <Svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></Svg>;
export const IconSliders = (p) => <Svg {...p}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Svg>;
export const IconBack = (p) => <Svg size={22} {...p}><path d="m15 5-7 7 7 7" /></Svg>;
export const IconChevron = (p) => <Svg size={18} {...p}><path d="m9 6 6 6-6 6" /></Svg>;
export const IconChevronDown = (p) => <Svg size={20} {...p}><path d="m6 9 6 6 6-6" /></Svg>;
export const IconChevronUp = (p) => <Svg size={20} {...p}><path d="m6 15 6-6 6 6" /></Svg>;
export const IconArrow = (p) => <Svg size={18} sw={2.2} {...p}><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></Svg>;
export const IconCheck = (p) => <Svg size={13} sw={3.5} {...p}><path d="m5 12 5 5 9-10" /></Svg>;
export const IconClose = (p) => <Svg size={16} sw={2.2} {...p}><path d="M18 6 6 18M6 6l12 12" /></Svg>;
export const IconInfo = (p) => <Svg size={18} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></Svg>;
export const IconDown = (p) => <Svg size={18} sw={2.2} {...p}><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></Svg>;
export const IconUp = (p) => <Svg size={18} sw={2.2} {...p}><path d="M12 19V5" /><path d="m6 11 6-6 6 6" /></Svg>;
export const IconSpeaker = (p) => <Svg size={18} {...p}><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M15.5 8.5a5 5 0 0 1 0 7" /></Svg>;
export const IconMic = (p) => <Svg {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></Svg>;
export const IconLock = (p) => <Svg size={18} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></Svg>;
export const IconClock = (p) => <Svg size={18} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Svg>;
export const IconWave = (p) => <Svg size={18} {...p}><path d="M3 12h3l3-7 4 14 3-7h5" /></Svg>;
export const IconRotate = (p) => <Svg size={16} {...p}><rect x="3" y="8" width="18" height="12" rx="2" /><path d="M7 8V6a5 5 0 0 1 9-3" /><path d="m16 1 0 2.5-2.5 0" /></Svg>;
export const IconLoop = (p) => <Svg size={18} {...p}><path d="m17 2 4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="m7 22-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></Svg>;
export const IconDownload = (p) => <Svg size={16} {...p}><path d="M12 4v11" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></Svg>;
export const IconPlay = ({ size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>;
export const IconPause = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
);
/** The Swara mark: an eighth note. */
export const IconNote = (p) => <Svg sw={2.2} {...p}><circle cx="9" cy="18" r="3" /><path d="M12 18V4l6 3.2" /></Svg>;

export const NAV_ICONS = { home: IconHome, tune: IconTune, play: IconKeys, riyaz: IconMusic, report: IconList };
