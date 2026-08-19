/**
 * Co-op random sky preset pool — keep count in sync with
 * `RANDOM_SKY_PRESET_COUNT` in src/components/environment/CustomSky.tsx.
 */
const COOP_RANDOM_SKY_PRESET_COUNT = 34;

/**
 * Sky Temple blue-only sky pool — keep count in sync with
 * `SKY_TEMPLE_BLUE_SKY_PRESET_COUNT` in src/components/environment/CustomSky.tsx.
 */
const COOP_SKY_TEMPLE_BLUE_SKY_PRESET_COUNT = 7;

function rollCoopSkyPresetIndex() {
  return Math.floor(Math.random() * COOP_RANDOM_SKY_PRESET_COUNT);
}

function rollSkyTempleSkyPresetIndex() {
  return Math.floor(Math.random() * COOP_SKY_TEMPLE_BLUE_SKY_PRESET_COUNT);
}

module.exports = {
  COOP_RANDOM_SKY_PRESET_COUNT,
  COOP_SKY_TEMPLE_BLUE_SKY_PRESET_COUNT,
  rollCoopSkyPresetIndex,
  rollSkyTempleSkyPresetIndex,
};
