import { type Mesh, type Object3D } from 'three';

/** WoW enemy item submesh groups (Main-hand_Item48023_0, _1, …). */
const WOW_ITEM_PREFIX_RE =
  /^(Main-hand_Item\d+|Off-hand_Item\d+|Shoulder[ _]?\([LR]\)_Item\d+|Head_Item\d+)/;

/** Player weapon GLB geoset splits (glaive_*_Geoset0, _Geoset1, …). */
const GEOSET_PREFIX_RE = /^(.*)_Geoset\d+$/;

/** WoW glow quads are typically 1–2 tris. */
const GLOW_SHELL_MAX_INDEX_COUNT = 12; // ≤4 triangles
/** Larger flat glow slabs on non-geoset item shells. */
const FLAT_GLOW_SHELL_MAX_TRIANGLES = 12;
/** Tiny geoset shells: hide by index count alone (shared vertex buffers break bbox flatness). */
const GEOSET_GLOW_SHELL_MAX_INDEX_COUNT = FLAT_GLOW_SHELL_MAX_TRIANGLES * 3; // ≤12 tris
const SUBSTANTIAL_MESH_MIN_INDEX_COUNT = 36; // ≥12 triangles
const FLAT_GLOW_MIN_AXIS = 0.02;
const FLAT_GLOW_MIN_SPAN = 0.08;

function meshGroupKey(name: string): string | null {
  const wowMatch = WOW_ITEM_PREFIX_RE.exec(name);
  if (wowMatch) return wowMatch[1];
  const geosetMatch = GEOSET_PREFIX_RE.exec(name);
  if (geosetMatch) return geosetMatch[1];
  return null;
}

function isGeosetMesh(name: string): boolean {
  return GEOSET_PREFIX_RE.test(name);
}

function meshIndexCount(mesh: Mesh): number {
  return mesh.geometry?.index?.count ?? 0;
}

function isFlatGlowShell(mesh: Mesh): boolean {
  if (!mesh.geometry) return false;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const box = mesh.geometry.boundingBox;
  if (!box) return false;
  const dx = box.max.x - box.min.x;
  const dy = box.max.y - box.min.y;
  const dz = box.max.z - box.min.z;
  const minDim = Math.min(dx, dy, dz);
  const maxDim = Math.max(dx, dy, dz);
  return minDim < FLAT_GLOW_MIN_AXIS && maxDim > FLAT_GLOW_MIN_SPAN;
}

/**
 * Hide WoW glow/placeholder shells when a mesh group also has real geometry.
 * Covers enemy item submeshes (Death Knight sword _2) and player weapon geosets
 * (GOODBOW Geoset0 = body; Geoset1–4 = smoke/energy effect subsets).
 *
 * For `_GeosetN` groups, keeps only the primary (largest index count) mesh and
 * hides the rest — effect geosets share vertex buffers so bbox flatness fails.
 */
export function hideStrayGlowShellMeshes(root: Object3D): void {
  const groups = new Map<string, Mesh[]>();

  root.traverse((obj) => {
    const mesh = obj as Mesh & { isMesh?: boolean };
    // Include SkinnedMesh — weapon geosets (GOODBOW etc.) are skinned.
    if (!mesh.isMesh) return;
    const key = meshGroupKey(mesh.name);
    if (!key) return;
    const list = groups.get(key);
    if (list) list.push(mesh);
    else groups.set(key, [mesh]);
  });

  for (const meshes of Array.from(groups.values())) {
    if (meshes.length < 2) continue;
    const hasSubstantial = meshes.some(
      (m) => meshIndexCount(m) >= SUBSTANTIAL_MESH_MIN_INDEX_COUNT,
    );
    if (!hasSubstantial) continue;

    const maxGeosetIndexCount = meshes.reduce((max, m) => {
      if (!isGeosetMesh(m.name)) return max;
      return Math.max(max, meshIndexCount(m));
    }, 0);

    for (const mesh of meshes) {
      const indexCount = meshIndexCount(mesh);
      // Primary geoset rule: keep the largest geoset; hide all others in the group
      // (GOODBOW Geoset1–4 smoke/energy planes; DRUIDBOW/BEASTMASTER effect shells).
      if (
        isGeosetMesh(mesh.name) &&
        maxGeosetIndexCount > 0 &&
        indexCount < maxGeosetIndexCount
      ) {
        mesh.visible = false;
        continue;
      }
      // Tiny geoset shells (shared vertex buffers break bbox flatness).
      if (
        isGeosetMesh(mesh.name) &&
        indexCount <= GEOSET_GLOW_SHELL_MAX_INDEX_COUNT
      ) {
        mesh.visible = false;
        continue;
      }
      if (indexCount <= GLOW_SHELL_MAX_INDEX_COUNT) {
        mesh.visible = false;
        continue;
      }
      if (indexCount / 3 <= FLAT_GLOW_SHELL_MAX_TRIANGLES && isFlatGlowShell(mesh)) {
        mesh.visible = false;
      }
    }
  }
}
