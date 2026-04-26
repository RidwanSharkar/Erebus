/** Co-op destructible instanced mushrooms — keep numeric gameplay values in sync with `backend/mushroomConstants.js`. */
export const MUSHROOM_MAX_HP = 10;
export const MUSHROOM_ERUPTION_PLAYER_DMG = 30;
export const MUSHROOM_ERUPTION_ENEMY_DMG = 100;
/** Horizontal XZ distance from mushroom origin for server AoE and tuning; visual is separate. */
export const MUSHROOM_ERUPTION_RADIUS = 3.5;

/** Max single hit accepted server-side (reduces obvious cheat spam). */
export const MUSHROOM_MAX_DAMAGE_PER_HIT = 500;

export const MUSHROOM_MELEE_RANGE = 5.5;
export const MUSHROOM_MELEE_CONE_RAD = Math.PI / 2;
export const MUSHROOM_ERUPTION_VFX_MS = 3500;
