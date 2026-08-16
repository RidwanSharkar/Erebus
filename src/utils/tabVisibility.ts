/**
 * Module-level tab visibility tracker.
 * Background tabs freeze rAF while socket handlers keep running; coop VFX
 * uses this to drop cosmetic events while hidden and for a short resume grace.
 */

const RESUME_VFX_GRACE_MS = 400;

let hidden = false;
let lastVisibleAtMs = 0;
let installed = false;
const visibleListeners = new Set<() => void>();

function readDocumentHidden(): boolean {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'hidden' || document.hidden === true;
}

function setHidden(next: boolean): void {
  if (next === hidden) return;
  hidden = next;
  if (!next) {
    lastVisibleAtMs = Date.now();
    for (const cb of visibleListeners) {
      try {
        cb();
      } catch {
        // Listeners must not break the rest of the resume path.
      }
    }
  }
}

function onVisibilityChange(): void {
  setHidden(readDocumentHidden());
}

function onWindowBlur(): void {
  setHidden(true);
}

function onWindowFocus(): void {
  if (!readDocumentHidden()) setHidden(false);
}

function install(): void {
  if (installed || typeof window === 'undefined' || typeof document === 'undefined') return;
  installed = true;
  hidden = readDocumentHidden();
  lastVisibleAtMs = 0;
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('blur', onWindowBlur);
  window.addEventListener('focus', onWindowFocus);
}

install();

export function isTabHidden(): boolean {
  return hidden;
}

export function msSinceTabVisible(): number {
  if (hidden) return Number.POSITIVE_INFINITY;
  if (lastVisibleAtMs <= 0) return Number.POSITIVE_INFINITY;
  return Date.now() - lastVisibleAtMs;
}

/** Subscribe to the moment the tab becomes visible. Returns an unsubscribe. */
export function onTabBecameVisible(cb: () => void): () => void {
  visibleListeners.add(cb);
  return () => {
    visibleListeners.delete(cb);
  };
}

/** Drop remote cosmetic VFX while hidden or during the first frames after restore. */
export function shouldDropRemoteVfx(): boolean {
  return hidden || msSinceTabVisible() < RESUME_VFX_GRACE_MS;
}
