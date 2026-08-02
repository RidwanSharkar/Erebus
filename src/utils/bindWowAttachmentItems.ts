import {
  Vector3,
  type Material,
  type Mesh,
  type Object3D,
  type SkinnedMesh,
} from 'three';
import { hideStrayGlowShellMeshes } from '@/utils/hideStrayGlowShellMeshes';

/**
 * WoW M2 exports keep equipment (weapons, pauldrons, helm) as non-skinned
 * meshes parented to the model root. At runtime WoW re-parents them to
 * attachment bones; Three.js does not. Reparent here so items follow the
 * skeleton during animation.
 */

const ATTACHMENT_RULES: Array<{
  pattern: RegExp;
  boneName: string;
  /** Extra local translation after reparent (WoW head-slot attachment offset). */
  localOffset?: [number, number, number];
  /**
   * `preserveWorld` (default): keep bind-pose world transform after reparent —
   * correct for weapons whose hand bone moves a lot between bind and Ready2H.
   * `snapToBone`: reset local transform to identity — required for pauldrons
   * whose verts are authored in attachment-bone-local space near Y≈0.
   */
  reparentMode?: 'preserveWorld' | 'snapToBone';
}> = [
  { pattern: /^Main-hand_Item/, boneName: 'bone_HandR' },
  { pattern: /^Off-hand_Item/, boneName: 'bone_HandL' },
  { pattern: /^Shoulder[ _]?\(L\)_Item/, boneName: 'bone_ShoulderL', reparentMode: 'snapToBone' },
  { pattern: /^Shoulder[ _]?\(R\)_Item/, boneName: 'bone_ShoulderR', reparentMode: 'snapToBone' },
  // Helm verts are authored near model origin; +Y lifts them onto the cranium.
  { pattern: /^Head_Item/, boneName: 'bone_Head', localOffset: [0, 0.17, 0] },
];

/** Bones whose skinned verts make up the head/face geoset (hide when helm equipped). */
const HEAD_GEOSSET_BONE_NAMES = new Set(['bone_Head', 'bone_Jaw']);
const HEAD_WEIGHT_THRESHOLD = 0.35;

/**
 * Bones whose skinned verts form the bare shoulder volume (hide when pauldrons
 * equipped). Mirror of head geoset suppress — shoulder attachment bones only.
 */
const SHOULDER_GEOSSET_BONE_NAMES = new Set([
  'bone_ShoulderL',
  'bone_ShoulderR',
  'bone_ShoulderL_p',
  'bone_ShoulderR_p',
]);
const SHOULDER_WEIGHT_THRESHOLD = 0.35;
/**
 * Vertical band around the shoulder bone (meters) used when carving the body
 * shell that sticks out past pauldron XZ extent.
 */
const SHOULDER_CARVE_Y_BAND = 0.40;
/**
 * Inset applied to the pauldron world AABB so flush body verts at the silhouette
 * edge are treated as occluding (carve slightly into the pad outline).
 */
const PAULDRON_SILHOUETTE_INSET = 0.01;
/**
 * Expand the pauldron AABB when collecting candidate body verts. Orc torso can
 * sit ~25cm past mail pads on +X; 3cm is not enough to find those wrappers.
 */
const PAULDRON_ASSOC_EXPAND = 0.30;
/**
 * Gate for the radial fallback carve: run when body max radius at the shoulder
 * band still reaches within this distance of pad max radius (meters). Catches
 * flush-or-buried orc shells that AABB carve left under the pad silhouette.
 */
const PAULDRON_BURIED_RADIAL_GATE = 0.05;
/**
 * Carve outer-half body verts past padMaxR minus this inset so the torso shell
 * cannot sit flush under sparse mail pads and occlude them.
 */
const PAULDRON_BURIED_RADIAL_INSET = 0.01;
/**
 * When body outer radius at the shoulder band exceeds padMaxR by this much
 * (meters), treat pads as deeply buried (orc shaman compact mail). Enables a
 * stronger carve that also removes inner-half body verts under the pad AABB —
 * the normal outer-half-only pass leaves those and the pads stay occluded.
 */
const PAULDRON_DEEP_BURIAL_THRESHOLD = 0.15;
/** Wider Y band for deep-burial carve so tall orc shoulder shells are cleared. */
const SHOULDER_CARVE_Y_BAND_DEEP = 0.55;
/** Extra silhouette expand (meters) when deep-carving under compact mail pads. */
const PAULDRON_DEEP_SILHOUETTE_EXPAND = 0.02;
/** Deeper radial inset for deep burial so flush wrappers past padMaxR drop. */
const PAULDRON_DEEP_RADIAL_INSET = 0.04;
/** Only carve base-body geosets — never gloves/arms/cloak splits. */
const BODY_GEOSSET0_RE = /Geoset0$/i;

/** Bare-torso split geosets WoW hides when shoulder/chest armor is equipped. */
const TORSO_GEOSSET_RE = /Torso\d/i;

/** Strip trailing `_N` submesh suffix so Head_Item22418_0 and _1 share a group. */
const ITEM_PREFIX_RE = /^(Main-hand_Item\d+|Off-hand_Item\d+|Shoulder[ _]?\([LR]\)_Item\d+|Head_Item\d+)/;

function reparentPreserveWorld(child: Object3D, bone: Object3D): void {
  child.updateMatrixWorld(true);
  bone.updateMatrixWorld(true);
  const worldMatrix = child.matrixWorld.clone();
  bone.add(child);
  child.matrix.copy(worldMatrix);
  child.matrix.decompose(child.position, child.quaternion, child.scale);
  child.matrixAutoUpdate = true;
}

/** Parent to bone with identity local transform (item verts are bone-local). */
function reparentSnapToBone(child: Object3D, bone: Object3D): void {
  bone.add(child);
  child.position.set(0, 0, 0);
  child.quaternion.identity();
  child.scale.set(1, 1, 1);
  child.matrixAutoUpdate = true;
  child.updateMatrixWorld(true);
}

function recomputeItemBounds(item: Object3D): void {
  const mesh = item as Mesh;
  if (!mesh.isMesh || !mesh.geometry) return;
  mesh.geometry.computeBoundingSphere();
  mesh.geometry.computeBoundingBox();
}

function resolveRule(meshName: string) {
  for (const rule of ATTACHMENT_RULES) {
    if (rule.pattern.test(meshName)) return rule;
  }
  return null;
}

function getPrimaryMaterial(mesh: Mesh): Material | null {
  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return mat ?? null;
}

function isPlaceholderMaterial(mat: Material | null): boolean {
  if (!mat) return true;
  const name = mat.name ?? '';
  // WoW exports leave untextured duplicate shells as `data-1` / `data-N`.
  if (/^data-\d+$/i.test(name)) return true;
  const withMap = mat as Material & { map?: unknown };
  if (!withMap.map && !/^mat_/i.test(name)) return true;
  return false;
}

/**
 * Remove triangles primarily weighted to head/jaw bones so the skinned face
 * does not poke through the helmet (WoW hides head geosets when helm is on).
 */
function suppressSkinnedGeosetByBones(
  root: Object3D,
  boneNames: Set<string>,
  weightThreshold: number,
): void {
  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.skeleton) return;

    const boneIndices = new Set<number>();
    mesh.skeleton.bones.forEach((bone, i) => {
      if (boneNames.has(bone.name)) boneIndices.add(i);
    });
    if (boneIndices.size === 0) return;

    const geometry = mesh.geometry;
    const skinIndex = geometry.getAttribute('skinIndex');
    const skinWeight = geometry.getAttribute('skinWeight');
    const index = geometry.getIndex();
    if (!skinIndex || !skinWeight || !index) return;

    const isMarkedVert = new Uint8Array(skinIndex.count);
    for (let i = 0; i < skinIndex.count; i++) {
      let markedW = 0;
      const indices = [
        skinIndex.getX(i),
        skinIndex.getY(i),
        skinIndex.getZ(i),
        skinIndex.getW(i),
      ];
      const weights = [
        skinWeight.getX(i),
        skinWeight.getY(i),
        skinWeight.getZ(i),
        skinWeight.getW(i),
      ];
      for (let j = 0; j < 4; j++) {
        if (boneIndices.has(indices[j])) markedW += weights[j];
      }
      if (markedW > weightThreshold) isMarkedVert[i] = 1;
    }

    const kept: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      // Drop triangle if majority of verts are marked-bone-weighted.
      if (isMarkedVert[a] + isMarkedVert[b] + isMarkedVert[c] >= 2) continue;
      kept.push(a, b, c);
    }

    if (kept.length === index.count) return;

    // Clone so we do not mutate the shared GLTF cache geometry.
    const cloned = geometry.clone();
    cloned.setIndex(kept);
    cloned.computeBoundingSphere();
    mesh.geometry = cloned;
  });
}

/**
 * Remove triangles primarily weighted to head/jaw bones so the skinned face
 * does not poke through the helmet (WoW hides head geosets when helm is on).
 */
function suppressSkinnedHeadGeoset(root: Object3D): void {
  suppressSkinnedGeosetByBones(root, HEAD_GEOSSET_BONE_NAMES, HEAD_WEIGHT_THRESHOLD);
}

/**
 * Remove triangles primarily weighted to shoulder attachment bones so the
 * skinned body does not bury pauldron meshes (WoW hides those geosets when
 * shoulders are equipped).
 */
function suppressSkinnedShoulderGeoset(root: Object3D): void {
  suppressSkinnedGeosetByBones(root, SHOULDER_GEOSSET_BONE_NAMES, SHOULDER_WEIGHT_THRESHOLD);
}

/**
 * Carve Geoset0 triangles that wrap past the pauldron world AABB at shoulder
 * height. Orc mail pads sit inside the torso shell; a radial XZ + lateral
 * half-space carve misses body verts that occlude along +X (WoW forward).
 * Comparing body verts to each pauldron's world AABB removes wrapping shell
 * on any axis without gutting slim-race chests whose pads already protrude.
 */
function carveBodyGeosetPastPauldrons(root: Object3D, shoulderItems: Object3D[]): void {
  if (shoulderItems.length === 0) return;
  root.updateMatrixWorld(true);

  const charCenter = new Vector3();
  const mainBone = root.getObjectByName('bone_Main');
  if (mainBone) mainBone.getWorldPosition(charCenter);

  type ShoulderSide = {
    boneY: number;
    /** Pauldron world AABB (verts within the shoulder Y band). */
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    /** Pad center in XZ — used for outer-half filter (away from spine). */
    padCx: number;
    padCz: number;
    /** Unit XZ direction from character center toward pad center. */
    outwardX: number;
    outwardZ: number;
    /** Min/max horizontal distance from character center among pauldron verts. */
    minXz: number;
    maxXz: number;
  };

  const sides: ShoulderSide[] = [];
  const tmp = new Vector3();

  for (const boneName of ['bone_ShoulderL', 'bone_ShoulderR'] as const) {
    const bone = root.getObjectByName(boneName);
    if (!bone) continue;
    bone.getWorldPosition(tmp);
    const boneY = tmp.y;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    let minXz = Infinity;
    let maxXz = 0;
    let hasVerts = false;

    for (const item of shoulderItems) {
      if (item.parent !== bone) continue;
      const mesh = item as Mesh;
      if (!mesh.isMesh || !mesh.geometry) continue;
      const position = mesh.geometry.getAttribute('position');
      if (!position) continue;
      for (let i = 0; i < position.count; i++) {
        tmp.fromBufferAttribute(position, i);
        mesh.localToWorld(tmp);
        if (Math.abs(tmp.y - boneY) > SHOULDER_CARVE_Y_BAND) continue;
        hasVerts = true;
        if (tmp.x < minX) minX = tmp.x;
        if (tmp.x > maxX) maxX = tmp.x;
        if (tmp.z < minZ) minZ = tmp.z;
        if (tmp.z > maxZ) maxZ = tmp.z;
        const xz = Math.hypot(tmp.x - charCenter.x, tmp.z - charCenter.z);
        if (xz < minXz) minXz = xz;
        if (xz > maxXz) maxXz = xz;
      }
    }
    if (!hasVerts || maxXz <= 0) continue;

    const padCx = (minX + maxX) * 0.5;
    const padCz = (minZ + maxZ) * 0.5;
    let outwardX = padCx - charCenter.x;
    let outwardZ = padCz - charCenter.z;
    const outLen = Math.hypot(outwardX, outwardZ);
    if (outLen < 1e-8) continue;
    outwardX /= outLen;
    outwardZ /= outLen;

    sides.push({
      boneY,
      minX,
      maxX,
      minZ,
      maxZ,
      padCx,
      padCz,
      outwardX,
      outwardZ,
      minXz,
      maxXz,
    });
  }

  if (sides.length === 0) return;

  const worldVert = new Vector3();

  /** Body vert wraps past this pauldron's silhouette on the outer half. */
  const isOccludingBodyVert = (v: Vector3, side: ShoulderSide): boolean => {
    if (Math.abs(v.y - side.boneY) > SHOULDER_CARVE_Y_BAND) return false;

    // Expanded AABB — only consider body near this pad (not the far arm/hip).
    if (
      v.x < side.minX - PAULDRON_ASSOC_EXPAND ||
      v.x > side.maxX + PAULDRON_ASSOC_EXPAND ||
      v.z < side.minZ - PAULDRON_ASSOC_EXPAND ||
      v.z > side.maxZ + PAULDRON_ASSOC_EXPAND
    ) {
      return false;
    }

    // Inside inset silhouette — under the pad, keep.
    if (
      v.x >= side.minX + PAULDRON_SILHOUETTE_INSET &&
      v.x <= side.maxX - PAULDRON_SILHOUETTE_INSET &&
      v.z >= side.minZ + PAULDRON_SILHOUETTE_INSET &&
      v.z <= side.maxZ - PAULDRON_SILHOUETTE_INSET
    ) {
      return false;
    }

    // Skip chest/spine side: closer to center than the pad's inner edge.
    const xz = Math.hypot(v.x - charCenter.x, v.z - charCenter.z);
    if (xz < side.minXz - 0.02) return false;

    // Outer half of the pad (away from spine) OR past radial silhouette OR past
    // the pad's +X (WoW forward) face. Forward catch is required: orc torso
    // wraps in front of compact mail pads while still inside radial maxXz, and
    // those verts fail the lateral outer-half test (outward is mostly ±Z).
    const onOuterHalf =
      (v.x - side.padCx) * side.outwardX + (v.z - side.padCz) * side.outwardZ >=
      -PAULDRON_SILHOUETTE_INSET;
    const pastRadial = xz >= side.maxXz - PAULDRON_SILHOUETTE_INSET;
    const pastForward = v.x >= side.maxX - PAULDRON_SILHOUETTE_INSET;
    return onOuterHalf || pastRadial || pastForward;
  };

  // Only carve when the body shell actually buries a pauldron (orc). Slim races
  // whose pauldrons already protrude skip this pass.
  let anyBuried = false;
  root.traverse((obj) => {
    if (anyBuried) return;
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.visible) return;
    if (!BODY_GEOSSET0_RE.test(mesh.name)) return;
    const position = mesh.geometry.getAttribute('position');
    const index = mesh.geometry.getIndex();
    if (!position || !index) return;
    mesh.updateMatrixWorld(true);
    const seen = new Set<number>();
    for (let t = 0; t < index.count; t++) {
      const i = index.getX(t);
      if (seen.has(i)) continue;
      seen.add(i);
      worldVert.fromBufferAttribute(position, i);
      mesh.localToWorld(worldVert);
      for (const side of sides) {
        if (!isOccludingBodyVert(worldVert, side)) continue;
        const xz = Math.hypot(worldVert.x - charCenter.x, worldVert.z - charCenter.z);
        const pastAabb =
          worldVert.x > side.maxX + 0.02 ||
          worldVert.x < side.minX - 0.02 ||
          worldVert.z > side.maxZ + 0.02 ||
          worldVert.z < side.minZ - 0.02;
        // Buried when body extends past the pad radially OR past any AABB face.
        if (xz > side.maxXz + 0.02 || pastAabb) {
          anyBuried = true;
          return;
        }
      }
    }
  });
  if (!anyBuried) return;

  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.visible) return;
    if (!BODY_GEOSSET0_RE.test(mesh.name)) return;

    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    if (!position || !index) return;

    mesh.updateMatrixWorld(true);
    const occluding = new Uint8Array(position.count);
    for (let i = 0; i < position.count; i++) {
      worldVert.fromBufferAttribute(position, i);
      mesh.localToWorld(worldVert);
      for (const side of sides) {
        if (isOccludingBodyVert(worldVert, side)) {
          occluding[i] = 1;
          break;
        }
      }
    }

    const kept: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      // Drop if any vert is in the occluding outer shell (majority rule leaves
      // stray outer verts welded to kept faces, which still bury pauldrons).
      if (occluding[a] + occluding[b] + occluding[c] >= 1) continue;
      kept.push(a, b, c);
    }

    if (kept.length === index.count) return;

    const cloned = geometry.clone();
    cloned.setIndex(kept);
    cloned.computeBoundingSphere();
    mesh.geometry = cloned;
  });
}

/**
 * Fallback after AABB carve: when compact mail pads (orc shaman) remain buried
 * or flush under the torso shell, drop Geoset0 triangles whose verts sit past
 * (or just under) padMaxR on the outer half of each shoulder — including body
 * verts the AABB pass kept inside the pad silhouette. Gated so slim races /
 * clearly protruding plate pads are untouched.
 *
 * Deep burial (pre-carve body outer R − padMaxR ≥ threshold): also carve
 * inner-half body verts under the pad AABB. Must be measured BEFORE the AABB
 * carve — that pass removes the outer shell and would otherwise hide the
 * burial depth so deep mode never activates.
 */
function carveBodyGeosetPastBuriedPauldronsRadial(
  root: Object3D,
  shoulderItems: Object3D[],
  deepBurial: boolean,
): void {
  if (shoulderItems.length === 0) return;
  root.updateMatrixWorld(true);

  const charCenter = new Vector3();
  const mainBone = root.getObjectByName('bone_Main');
  if (mainBone) mainBone.getWorldPosition(charCenter);

  type RadialSide = {
    boneY: number;
    padMaxR: number;
    padCx: number;
    padCz: number;
    outwardX: number;
    outwardZ: number;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  };

  const sides: RadialSide[] = [];
  const tmp = new Vector3();

  for (const boneName of ['bone_ShoulderL', 'bone_ShoulderR'] as const) {
    const bone = root.getObjectByName(boneName);
    if (!bone) continue;
    bone.getWorldPosition(tmp);
    const boneY = tmp.y;

    let padMaxR = 0;
    let sumX = 0;
    let sumZ = 0;
    let vertCount = 0;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const item of shoulderItems) {
      if (item.parent !== bone) continue;
      const mesh = item as Mesh;
      if (!mesh.isMesh || !mesh.geometry) continue;
      const position = mesh.geometry.getAttribute('position');
      if (!position) continue;
      for (let i = 0; i < position.count; i++) {
        tmp.fromBufferAttribute(position, i);
        mesh.localToWorld(tmp);
        if (Math.abs(tmp.y - boneY) > SHOULDER_CARVE_Y_BAND) continue;
        const xz = Math.hypot(tmp.x - charCenter.x, tmp.z - charCenter.z);
        if (xz > padMaxR) padMaxR = xz;
        if (tmp.x < minX) minX = tmp.x;
        if (tmp.x > maxX) maxX = tmp.x;
        if (tmp.z < minZ) minZ = tmp.z;
        if (tmp.z > maxZ) maxZ = tmp.z;
        sumX += tmp.x;
        sumZ += tmp.z;
        vertCount += 1;
      }
    }
    if (vertCount === 0 || padMaxR <= 0) continue;

    const padCx = sumX / vertCount;
    const padCz = sumZ / vertCount;
    let outwardX = padCx - charCenter.x;
    let outwardZ = padCz - charCenter.z;
    const outLen = Math.hypot(outwardX, outwardZ);
    if (outLen < 1e-8) continue;
    outwardX /= outLen;
    outwardZ /= outLen;

    sides.push({
      boneY,
      padMaxR,
      padCx,
      padCz,
      outwardX,
      outwardZ,
      minX,
      maxX,
      minZ,
      maxZ,
    });
  }

  if (sides.length === 0) return;

  const worldVert = new Vector3();

  const isOuterHalf = (v: Vector3, side: RadialSide): boolean =>
    (v.x - side.padCx) * side.outwardX + (v.z - side.padCz) * side.outwardZ >= 0;

  // Gate: body still reaches within GATE of padMaxR on the outer half (buried or flush),
  // OR deep burial was already measured on the pre-carve mesh.
  let anyBuried = deepBurial;
  if (!anyBuried) {
    root.traverse((obj) => {
      if (anyBuried) return;
      const mesh = obj as SkinnedMesh;
      if (!mesh.isSkinnedMesh || !mesh.visible) return;
      if (!BODY_GEOSSET0_RE.test(mesh.name)) return;
      const position = mesh.geometry.getAttribute('position');
      const index = mesh.geometry.getIndex();
      if (!position || !index) return;
      mesh.updateMatrixWorld(true);
      const seen = new Set<number>();
      for (let t = 0; t < index.count; t++) {
        const i = index.getX(t);
        if (seen.has(i)) continue;
        seen.add(i);
        worldVert.fromBufferAttribute(position, i);
        mesh.localToWorld(worldVert);
        for (const side of sides) {
          if (Math.abs(worldVert.y - side.boneY) > SHOULDER_CARVE_Y_BAND) continue;
          if (!isOuterHalf(worldVert, side)) continue;
          const bodyR = Math.hypot(
            worldVert.x - charCenter.x,
            worldVert.z - charCenter.z,
          );
          if (bodyR > side.padMaxR - PAULDRON_BURIED_RADIAL_GATE) {
            anyBuried = true;
            return;
          }
        }
      }
    });
  }
  if (!anyBuried) return;

  const yBand = deepBurial ? SHOULDER_CARVE_Y_BAND_DEEP : SHOULDER_CARVE_Y_BAND;
  const radialInset = deepBurial
    ? PAULDRON_DEEP_RADIAL_INSET
    : PAULDRON_BURIED_RADIAL_INSET;
  const silExpand = deepBurial
    ? PAULDRON_DEEP_SILHOUETTE_EXPAND
    : PAULDRON_SILHOUETTE_INSET;

  const isRadialOccluder = (v: Vector3, side: RadialSide): boolean => {
    if (Math.abs(v.y - side.boneY) > yBand) return false;
    const bodyR = Math.hypot(v.x - charCenter.x, v.z - charCenter.z);
    const inSilhouette =
      v.x >= side.minX - silExpand &&
      v.x <= side.maxX + silExpand &&
      v.z >= side.minZ - silExpand &&
      v.z <= side.maxZ + silExpand;

    if (deepBurial) {
      // Compact mail on bulky races: body under the full pad footprint (both
      // halves) occludes the pads. Outer-half-only left ~60% of silhouette verts.
      // Pad AABB is lateral (shoulders); carving the full footprint is safe.
      if (inSilhouette) {
        return true;
      }
      if (!isOuterHalf(v, side)) return false;
      // Outer shell near the pad — past padMaxR with deeper inset.
      if (
        v.x >= side.minX - PAULDRON_ASSOC_EXPAND &&
        v.x <= side.maxX + PAULDRON_ASSOC_EXPAND &&
        v.z >= side.minZ - PAULDRON_ASSOC_EXPAND &&
        v.z <= side.maxZ + PAULDRON_ASSOC_EXPAND &&
        bodyR > side.padMaxR - radialInset
      ) {
        return true;
      }
      return false;
    }

    // Standard flush/mild burial: outer half only (slim races / protruding plate).
    if (!isOuterHalf(v, side)) return false;
    if (bodyR > side.padMaxR - radialInset) return true;
    if (inSilhouette && bodyR >= side.padMaxR * 0.5) return true;
    return false;
  };

  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh || !mesh.visible) return;
    if (!BODY_GEOSSET0_RE.test(mesh.name)) return;

    const geometry = mesh.geometry;
    const position = geometry.getAttribute('position');
    const index = geometry.getIndex();
    if (!position || !index) return;

    mesh.updateMatrixWorld(true);
    const occluding = new Uint8Array(position.count);
    for (let i = 0; i < position.count; i++) {
      worldVert.fromBufferAttribute(position, i);
      mesh.localToWorld(worldVert);
      for (const side of sides) {
        if (isRadialOccluder(worldVert, side)) {
          occluding[i] = 1;
          break;
        }
      }
    }

    const kept: number[] = [];
    for (let t = 0; t < index.count; t += 3) {
      const a = index.getX(t);
      const b = index.getX(t + 1);
      const c = index.getX(t + 2);
      if (occluding[a] + occluding[b] + occluding[c] >= 1) continue;
      kept.push(a, b, c);
    }

    if (kept.length === index.count) return;

    const cloned = geometry.clone();
    cloned.setIndex(kept);
    cloned.computeBoundingSphere();
    mesh.geometry = cloned;
  });
}

/**
 * Max (bodyOuterR − padMaxR) at the shoulder Y band on Geoset0, outer half of
 * each pad. Call BEFORE body carves so AABB removal does not hide burial depth.
 */
function measurePauldronBurialDepth(
  root: Object3D,
  shoulderItems: Object3D[],
): number {
  if (shoulderItems.length === 0) return 0;
  root.updateMatrixWorld(true);

  const charCenter = new Vector3();
  const mainBone = root.getObjectByName('bone_Main');
  if (mainBone) mainBone.getWorldPosition(charCenter);

  const tmp = new Vector3();
  let maxBurial = 0;

  for (const boneName of ['bone_ShoulderL', 'bone_ShoulderR'] as const) {
    const bone = root.getObjectByName(boneName);
    if (!bone) continue;
    bone.getWorldPosition(tmp);
    const boneY = tmp.y;

    let padMaxR = 0;
    let sumX = 0;
    let sumZ = 0;
    let vertCount = 0;

    for (const item of shoulderItems) {
      if (item.parent !== bone) continue;
      const mesh = item as Mesh;
      if (!mesh.isMesh || !mesh.geometry) continue;
      const position = mesh.geometry.getAttribute('position');
      if (!position) continue;
      for (let i = 0; i < position.count; i++) {
        tmp.fromBufferAttribute(position, i);
        mesh.localToWorld(tmp);
        if (Math.abs(tmp.y - boneY) > SHOULDER_CARVE_Y_BAND) continue;
        const xz = Math.hypot(tmp.x - charCenter.x, tmp.z - charCenter.z);
        if (xz > padMaxR) padMaxR = xz;
        sumX += tmp.x;
        sumZ += tmp.z;
        vertCount += 1;
      }
    }
    if (vertCount === 0 || padMaxR <= 0) continue;

    const padCx = sumX / vertCount;
    const padCz = sumZ / vertCount;
    let outwardX = padCx - charCenter.x;
    let outwardZ = padCz - charCenter.z;
    const outLen = Math.hypot(outwardX, outwardZ);
    if (outLen < 1e-8) continue;
    outwardX /= outLen;
    outwardZ /= outLen;

    root.traverse((obj) => {
      const mesh = obj as SkinnedMesh;
      if (!mesh.isSkinnedMesh || !mesh.visible) return;
      if (!BODY_GEOSSET0_RE.test(mesh.name)) return;
      const position = mesh.geometry.getAttribute('position');
      const index = mesh.geometry.getIndex();
      if (!position || !index) return;
      mesh.updateMatrixWorld(true);
      const seen = new Set<number>();
      for (let t = 0; t < index.count; t++) {
        const i = index.getX(t);
        if (seen.has(i)) continue;
        seen.add(i);
        tmp.fromBufferAttribute(position, i);
        mesh.localToWorld(tmp);
        if (Math.abs(tmp.y - boneY) > SHOULDER_CARVE_Y_BAND) continue;
        if ((tmp.x - padCx) * outwardX + (tmp.z - padCz) * outwardZ < 0) continue;
        const bodyR = Math.hypot(tmp.x - charCenter.x, tmp.z - charCenter.z);
        const burial = bodyR - padMaxR;
        if (burial > maxBurial) maxBurial = burial;
      }
    });
  }

  return maxBurial;
}

/**
 * WoW hides bare-torso split geosets (`*_Torso1`) under shoulder/chest armor;
 * exports still include them and they bury pauldrons on bulky races (orc).
 */
function hideTorsoGeosets(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    if (!TORSO_GEOSSET_RE.test(mesh.name)) return;
    mesh.visible = false;
  });
}

/** Give duplicate helm shells the plate material from the textured helm mesh. */
function unifyHelmMaterials(root: Object3D, headItems: Object3D[]): void {
  let helmMat: Material | null = null;
  for (const item of headItems) {
    const mesh = item as Mesh;
    const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (mat && /helm/i.test(mat.name ?? '')) {
      helmMat = mat;
      break;
    }
  }
  if (!helmMat) return;

  for (const item of headItems) {
    const mesh = item as Mesh;
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map(() => helmMat!);
    } else if (mesh.material !== helmMat) {
      mesh.material = helmMat;
    }
  }
}

/**
 * Hide untextured `data-1` duplicate item shells when a group also has real
 * equipment materials (e.g. Head_Item22418_0 vs Head_Item22418_1).
 */
function hidePlaceholderItemSubmeshes(root: Object3D): void {
  const groups = new Map<string, Mesh[]>();

  root.traverse((obj) => {
    const mesh = obj as Mesh & { isMesh?: boolean; isSkinnedMesh?: boolean };
    if (!mesh.isMesh || mesh.isSkinnedMesh) return;
    const match = ITEM_PREFIX_RE.exec(mesh.name);
    if (!match) return;
    const key = match[1];
    const list = groups.get(key);
    if (list) list.push(mesh);
    else groups.set(key, [mesh]);
  });

  for (const meshes of Array.from(groups.values())) {
    if (meshes.length < 2) continue;
    let hasReal = false;
    let hasPlaceholder = false;
    for (const mesh of meshes) {
      if (isPlaceholderMaterial(getPrimaryMaterial(mesh))) hasPlaceholder = true;
      else hasReal = true;
    }
    if (!hasReal || !hasPlaceholder) continue;
    for (const mesh of meshes) {
      if (isPlaceholderMaterial(getPrimaryMaterial(mesh))) {
        mesh.visible = false;
      }
    }
  }
}

/**
 * WoW hides tabard/cape (BoneTail) geosets under plate/mail armor; exports still
 * include them as skinned `data-1` meshes that can protrude as flat bright slabs.
 * Some exports name them `Bone/Tail` (slash) instead of `BoneTail`.
 */
function hideBoneTailGeosets(root: Object3D): void {
  root.traverse((obj) => {
    const mesh = obj as SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    if (!/Bone\/?Tail/i.test(mesh.name)) return;
    mesh.visible = false;
  });
}

/** Reparent WoW item display meshes onto their attachment bones. */
export function bindWowAttachmentItems(root: Object3D): void {
  const items: Object3D[] = [];
  root.traverse((obj) => {
    const mesh = obj as Object3D & { isMesh?: boolean; isSkinnedMesh?: boolean };
    if (!mesh.isMesh || mesh.isSkinnedMesh) return;
    if (resolveRule(mesh.name)) items.push(mesh);
  });

  const headItems: Object3D[] = [];
  const shoulderItems: Object3D[] = [];

  for (const item of items) {
    const rule = resolveRule(item.name);
    if (!rule) continue;
    const bone = root.getObjectByName(rule.boneName);
    if (!bone) continue;
    if (rule.reparentMode === 'snapToBone') {
      reparentSnapToBone(item, bone);
    } else {
      reparentPreserveWorld(item, bone);
    }
    if (rule.localOffset) {
      item.position.x += rule.localOffset[0];
      item.position.y += rule.localOffset[1];
      item.position.z += rule.localOffset[2];
    }
    recomputeItemBounds(item);
    if (rule.pattern.source.includes('Head_Item')) {
      headItems.push(item);
    }
    if (rule.pattern.source.includes('Shoulder')) {
      shoulderItems.push(item);
      // Draw pauldrons after skinned body so they win close depth fights.
      item.renderOrder = 1;
    }
  }

  if (headItems.length > 0) {
    unifyHelmMaterials(root, headItems);
    suppressSkinnedHeadGeoset(root);
  }

  if (shoulderItems.length > 0) {
    hideTorsoGeosets(root);
    suppressSkinnedShoulderGeoset(root);
    // Measure burial on the intact body — AABB carve strips the outer shell and
    // would make deep-burial detection fail for orc compact mail.
    const deepBurial =
      measurePauldronBurialDepth(root, shoulderItems) >=
      PAULDRON_DEEP_BURIAL_THRESHOLD;
    carveBodyGeosetPastPauldrons(root, shoulderItems);
    // Compact mail pads on bulky races (orc shaman) can remain buried after
    // the AABB carve — radial pass removes remaining outer-shell wrappers.
    carveBodyGeosetPastBuriedPauldronsRadial(root, shoulderItems, deepBurial);
    for (const item of shoulderItems) {
      const mesh = item as Mesh;
      if (!mesh.isMesh) continue;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const mat of mats) {
        if (mat && 'depthWrite' in mat) {
          (mat as Material & { depthWrite: boolean }).depthWrite = true;
        }
      }
    }
  }

  hidePlaceholderItemSubmeshes(root);
  hideStrayGlowShellMeshes(root);
  hideBoneTailGeosets(root);
}
