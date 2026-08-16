/**
 * Shared registry for GLB model optimization / validation.
 *
 * Base-scene files keep mesh + textures + skeleton (loaded via useGLTF for rendering).
 * All other GLBs in the same character set are animation-only (clips stripped of mesh).
 */
import { readdir } from 'node:fs/promises';
import path from 'node:path';

/** Relative to public/models — keep renderable payload. */
export const BASE_SCENE_REL_PATHS = new Set([
  // Top-level Mixamo / Assimp characters
  'ally_idle.glb',
  'boss_idle.glb',
  'character_idle.glb',
  'ghoul_idle.glb',
  'knight_idle.glb',
  'martyr_idle.glb',
  'nemesis_idle.glb',
  'paladin_idle.glb',
  'sentinel_idle.glb',
  'shade_idle.glb',
  'spectre_idle.glb',
  'templar_idle.glb',
  'titan_walk.glb',
  'valkyrie_idle.glb',
  'viper_idle.glb',
  'warlock_idle.glb',
  'weaver_idle.glb',
  'wraith_idle.glb',
  'zombie_idle.glb',
  // Top-level WoW single-file / swim bases
  'SkyRay_swim.glb',
  'basilisk_swim.glb',
  // Enemy subdirectory WoW exports (idle / walk base per React model component)
  'assassin/buchess_walk.glb',
  'bear/ursoc_idle.glb',
  'birdofprey/dreadsquall_flyIdle.glb',
  'colossus/colossus_idle.glb',
  'deathknight/deathknight_idle.glb',
  'demonspawn/Abysslick_idle.glb',
  'dragon/azugeros_idle.glb',
  'frost/frostqueen_idle.glb',
  'giant/AncientGiant_idle.glb',
  'medusa/Azshara_idle.glb',
  'serpent/serpent_idle.glb',
  'shaman/shaman_idle.glb',
  'spider/BoneSpider_idle.glb',
  'spine/tentacle_death.glb',
  'tiger/Tiger_idle.glb',
  'treant/AncientofWar_idle.glb',
  'wolf/wolf_idle.glb',
  'wyvern/drake_idle.glb',
  // Static environment skydomes (must keep meshes + textures)
  'environ/SKY.glb',
  'environ/SKY2.glb',
  'environ/sky3.glb',
  'environ/sky4.glb',
  'environ/skybox.glb',
  // Baked static VFX (no skin / animation; used as instanced trail puffs)
  'environ/arcaneEffectTrail.glb',
]);

/** Directories under public/models that are static props — skip mesh-strip pipeline. */
export const SKIP_OPTIMIZE_DIRS = new Set(['items', 'trinket', 'environ']);

/**
 * WoW-export folders (and top-level WoW prefixes) that use bone_* skeletons,
 * not Assimp/Mixamo track naming.
 */
export const WOW_MODEL_DIR_PREFIXES = [
  'assassin/',
  'bear/',
  'birdofprey/',
  'colossus/',
  'deathknight/',
  'demonspawn/',
  'dragon/',
  'frost/',
  'giant/',
  'medusa/',
  'serpent/',
  'shaman/',
  'spider/',
  'spine/',
  'tiger/',
  'treant/',
  'wolf/',
  'wyvern/',
];

export const WOW_TOP_LEVEL_PREFIXES = ['paladin_', 'SkyRay_', 'basilisk_'];

export function toModelsRelativePath(modelsDir, filePath) {
  return path.relative(modelsDir, filePath).split(path.sep).join('/');
}

export function isBaseScene(modelsDir, filePath) {
  return BASE_SCENE_REL_PATHS.has(toModelsRelativePath(modelsDir, filePath));
}

export function isWowModel(modelsDir, filePath) {
  const rel = toModelsRelativePath(modelsDir, filePath);
  if (WOW_MODEL_DIR_PREFIXES.some((prefix) => rel.startsWith(prefix))) return true;
  const basename = path.basename(rel);
  return WOW_TOP_LEVEL_PREFIXES.some((prefix) => basename.startsWith(prefix));
}

function shouldSkipDir(name) {
  return SKIP_OPTIMIZE_DIRS.has(name) || name.startsWith('.');
}

/**
 * Recursively list all .glb files under modelsDir, excluding items/ and trinket/.
 * Returns absolute paths sorted by relative path.
 */
export async function listAllModelGlbs(modelsDir) {
  const results = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) continue;
        await walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith('.glb')) {
        results.push(path.join(dir, entry.name));
      }
    }
  }

  await walk(modelsDir);
  results.sort((a, b) =>
    toModelsRelativePath(modelsDir, a).localeCompare(toModelsRelativePath(modelsDir, b)),
  );
  return results;
}

export function formatBytes(bytes) {
  const mb = bytes / 1024 / 1024;
  return `${mb.toFixed(mb >= 10 ? 1 : 2)} MB`;
}
