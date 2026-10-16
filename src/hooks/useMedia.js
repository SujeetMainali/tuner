import { useEffect, useState } from 'react';

/** The phone layout (bottom tab bar, upright keyboards) is used below this width. */
export const PHONE_QUERY = '(max-width: 899px)';

/**
 * Whether a media query matches. False on the server and on the first client render, so the
 * prerendered page and the app agree; it settles right after mounting.
 */
export function useMedia(query = PHONE_QUERY) {
  const [match, setMatch] = useState(false);
  useEffect(() => {
    const mq = matchMedia(query);
    const on = () => setMatch(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}
