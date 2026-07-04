/** True only on localhost dev — gates the in-game performance HUD. */
export function isDevPerformanceHudEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}
