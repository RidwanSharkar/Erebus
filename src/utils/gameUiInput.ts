export const BLOCK_GAME_INPUT_ATTR = 'data-block-game-input';
export const BLOCK_GAME_INPUT_SELECTOR = `[${BLOCK_GAME_INPUT_ATTR}]`;

/** True when the event target is inside HUD/modal UI that should consume pointer input. */
export function isEventOverGameUi(event: Event): boolean {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return target.closest(BLOCK_GAME_INPUT_SELECTOR) !== null;
}

/** True when the event target is a field where the user is typing text. */
export function isEventInTextEntry(event: Event): boolean {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
