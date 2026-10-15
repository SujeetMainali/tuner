/** The app mark: a tuner dial over harmonium keys (same drawing as public/favicon.svg). */
export default function Logo({ size = 34 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#211816" />
      <path d="M6 17a10 10 0 0 1 20 0" fill="none" stroke="#6b5a54" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M13.4 7.3a10 10 0 0 1 5.2 0" fill="none" stroke="#5cc48f" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M16 17 17.7 9.2" stroke="#dcaa4c" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="16" cy="17" r="2.1" fill="#dcaa4c" />
      <g fill="#e8dfd6">
        <rect x="5" y="22" width="6.6" height="6" rx="1" />
        <rect x="12.7" y="22" width="6.6" height="6" rx="1" />
        <rect x="20.4" y="22" width="6.6" height="6" rx="1" />
      </g>
      <g fill="#211816">
        <rect x="10" y="22" width="3.4" height="3.4" rx=".6" />
        <rect x="18.6" y="22" width="3.4" height="3.4" rx=".6" />
      </g>
    </svg>
  );
}
