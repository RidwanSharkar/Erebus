/**
 * Co-op random grass preset pool (prep ThroneRoom) — keep count in sync with
 * `RANDOM_GRASS_PRESET_COUNT` in src/components/environment/StylizedGrass.tsx.
 * Excludes purple/grey (boss / ash-black look).
 */
const COOP_RANDOM_GRASS_PRESET_COUNT = 26;

function rollCoopGrassPresetIndex() {
  return Math.floor(Math.random() * COOP_RANDOM_GRASS_PRESET_COUNT);
}

module.exports = {
  COOP_RANDOM_GRASS_PRESET_COUNT,
  rollCoopGrassPresetIndex,
};
