import type { BufferAttribute, Material, Object3D } from 'three';
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
} from '@/utils/three-exports';

/** Native XZ cell size for frustum chunks (before `DUNGEON_NEXUS_MODEL_SCALE`). */
export const DUNGEON_CULL_CELL_NATIVE = 48;
/** Native XZ cell size for defense arena frustum chunks (before `DEFENSE_ARENA_MODEL_SCALE`). */
export const DEFENSE_CULL_CELL_NATIVE = 48;

const NOOP_RAYCAST: Mesh['raycast'] = () => {};

function cellKey(x: number, z: number, cellSize: number): string {
  return `${Math.floor(x / cellSize)},${Math.floor(z / cellSize)}`;
}

function readAttrComponent(
  attr: BufferAttribute,
  index: number,
  component: number,
): number {
  switch (component) {
    case 0:
      return attr.getX(index);
    case 1:
      return attr.getY(index);
    case 2:
      return attr.getZ(index);
    case 3:
      return attr.getW(index);
    default:
      return attr.array[index * attr.itemSize + component]!;
  }
}

function extractTriangles(src: BufferGeometry, indices: number[]): BufferGeometry {
  const remap = new Map<number, number>();
  const newIndex: number[] = [];
  for (let i = 0; i < indices.length; i++) {
    const old = indices[i]!;
    let next = remap.get(old);
    if (next === undefined) {
      next = remap.size;
      remap.set(old, next);
    }
    newIndex.push(next);
  }

  const vertexCount = remap.size;
  const orderedOld = new Array<number>(vertexCount);
  for (const [old, neu] of remap) {
    orderedOld[neu] = old;
  }

  const out = new BufferGeometry();
  const names = Object.keys(src.attributes);
  for (let n = 0; n < names.length; n++) {
    const name = names[n]!;
    const attr = src.getAttribute(name) as BufferAttribute;
    const itemSize = attr.itemSize;
    const array = new Float32Array(vertexCount * itemSize);
    for (let i = 0; i < vertexCount; i++) {
      const old = orderedOld[i]!;
      for (let k = 0; k < itemSize; k++) {
        array[i * itemSize + k] = readAttrComponent(attr, old, k);
      }
    }
    out.setAttribute(
      name,
      new Float32BufferAttribute(array, itemSize, attr.normalized),
    );
  }
  out.setIndex(newIndex);
  out.userData.dungeonChunk = true;
  out.computeBoundingSphere();
  return out;
}

function splitGeometryByXZ(geometry: BufferGeometry, cellSize: number): BufferGeometry[] {
  const position = geometry.getAttribute('position');
  if (!position) return [geometry];

  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  if (
    bb
    && (bb.max.x - bb.min.x) <= cellSize
    && (bb.max.z - bb.min.z) <= cellSize
  ) {
    return [geometry];
  }

  const indexAttr = geometry.index;
  const triCount = indexAttr ? indexAttr.count / 3 : position.count / 3;
  if (triCount <= 0) return [geometry];

  const buckets = new Map<string, number[]>();
  for (let t = 0; t < triCount; t++) {
    const a = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const b = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const c = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;
    const cx = (position.getX(a) + position.getX(b) + position.getX(c)) / 3;
    const cz = (position.getZ(a) + position.getZ(b) + position.getZ(c)) / 3;
    const key = cellKey(cx, cz, cellSize);
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(a, b, c);
  }

  if (buckets.size <= 1) return [geometry];

  const parts: BufferGeometry[] = [];
  for (const triIndices of buckets.values()) {
    parts.push(extractTriangles(geometry, triIndices));
  }
  return parts;
}

function splitMeshesSpatially(root: Object3D, cellSize: number): void {
  const meshes: Mesh[] = [];
  root.traverse((child) => {
    if ((child as Mesh).isMesh) meshes.push(child as Mesh);
  });

  for (let m = 0; m < meshes.length; m++) {
    const mesh = meshes[m]!;
    const parts = splitGeometryByXZ(mesh.geometry, cellSize);
    if (parts.length <= 1) {
      if (!mesh.geometry.userData.dungeonChunk) {
        mesh.geometry = mesh.geometry.clone();
        mesh.geometry.userData.dungeonChunk = true;
        mesh.geometry.computeBoundingSphere();
      }
      continue;
    }
    const parent = mesh.parent;
    if (!parent) continue;
    for (let i = 0; i < parts.length; i++) {
      const chunk = mesh.clone();
      chunk.geometry = parts[i]!;
      chunk.name = mesh.name ? `${mesh.name}_xz${i}` : `xz${i}`;
      parent.add(chunk);
    }
    parent.remove(mesh);
  }
}

function toUnlitMaterial(material: Material): MeshBasicMaterial {
  const src = material as Material & {
    map?: MeshBasicMaterial['map'];
    color?: { clone: () => Color };
    side?: MeshBasicMaterial['side'];
  };
  const unlit = new MeshBasicMaterial({
    map: src.map ?? null,
    color: src.color ? src.color.clone() : new Color(0xffffff),
    side: src.side,
    fog: true,
    toneMapped: true,
  });
  unlit.userData.dungeonUnlit = true;
  return unlit;
}

function disposeBoundsTree(geometry: BufferGeometry): void {
  const geo = geometry as BufferGeometry & { disposeBoundsTree?: () => void };
  if (typeof geo.disposeBoundsTree === 'function') {
    geo.disposeBoundsTree();
  }
}

/**
 * Unlit visual map: spatially chunked for frustum culling, no raycasts.
 * Shared by dungeon (plus a hidden collider) and defense (visual only).
 */
export function prepareStaticMapVisual(
  source: Object3D,
  options: { cellSize: number; name: string },
): Group {
  const visual = source.clone(true) as Group;
  visual.name = options.name;
  splitMeshesSpatially(visual, options.cellSize);

  visual.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    mesh.raycast = NOOP_RAYCAST;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const converted = mats.map((mat) => toUnlitMaterial(mat));
    mesh.material = converted.length === 1 ? converted[0]! : converted;
  });

  return visual;
}

/**
 * Visual cave: unlit, no raycasts, spatially chunked for frustum culling.
 * Hidden collider: same chunks, BVH-friendly, used only by mesh walking.
 */
export function prepareDungeonMapScenes(source: Object3D): {
  visual: Group;
  collider: Group;
} {
  const visual = prepareStaticMapVisual(source, {
    cellSize: DUNGEON_CULL_CELL_NATIVE,
    name: 'dungeon-lair-visual',
  });

  const collider = visual.clone(true) as Group;
  collider.name = 'dungeon-lair-collider';
  collider.visible = false;
  collider.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.visible = false;
    mesh.frustumCulled = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
  });

  return { visual, collider };
}

function visitMapScenes(
  root: Object3D,
  disposeMats: boolean,
  seenGeo: Set<BufferGeometry>,
): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    if (disposeMats) {
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (let i = 0; i < mats.length; i++) {
        const mat = mats[i];
        if (mat?.userData?.dungeonUnlit) mat.dispose();
      }
    }
    const geo = mesh.geometry;
    if (!geo?.userData?.dungeonChunk || seenGeo.has(geo)) return;
    seenGeo.add(geo);
    disposeBoundsTree(geo);
    geo.dispose();
  });
}

export function disposeStaticMapVisual(visual: Object3D): void {
  visitMapScenes(visual, true, new Set<BufferGeometry>());
}

export function disposeDungeonMapScenes(visual: Object3D, collider: Object3D): void {
  const seenGeo = new Set<BufferGeometry>();
  visitMapScenes(visual, true, seenGeo);
  visitMapScenes(collider, false, seenGeo);
}
