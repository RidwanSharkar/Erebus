/**
 * Co-op random sky preset pool — keep count in sync with
 * `RANDOM_SKY_PRESET_COUNT` in src/components/environment/CustomSky.tsx.
 */
const COOP_RANDOM_SKY_PRESET_COUNT = 34;

function rollCoopSkyPresetIndex() {
  return Math.floor(Math.random() * COOP_RANDOM_SKY_PRESET_COUNT);
}

module.exports = {
  COOP_RANDOM_SKY_PRESET_COUNT,
  rollCoopSkyPresetIndex,
};
