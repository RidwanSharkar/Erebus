import {
  BufferGeometry,
  DynamicDrawUsage,
  InstancedBufferAttribute,
  InstancedMesh,
  Material,
  MeshStandardMaterial,
} from 'three';

export const INSTANCE_OPACITY_ATTR = 'aInstanceOpacity';
export const INSTANCE_EMISSIVE_ATTR = 'aInstanceEmissive';

type FalloffMaterial = MeshStandardMaterial & {
  userData: MeshStandardMaterial['userData'] & {
    instancedFalloffPatched?: boolean;
    instancedFalloffEmissive?: boolean;
  };
};

/**
 * Ensure a per-instance float attribute exists on `geometry` (shared geos OK when
 * all consumers use the same relative falloff curve).
 */
export function ensureInstanceFloatAttribute(
  geometry: BufferGeometry,
  name: string,
  count: number,
  fill = 1,
): InstancedBufferAttribute {
  const existing = geometry.getAttribute(name) as InstancedBufferAttribute | undefined;
  if (existing && existing.count >= count) {
    return existing;
  }
  const data = new Float32Array(count);
  data.fill(fill);
  const attr = new InstancedBufferAttribute(data, 1);
  attr.setUsage(DynamicDrawUsage);
  geometry.setAttribute(name, attr);
  return attr;
}

/** Write a dense float array into an instance attribute and mark it dirty. */
export function writeInstanceFloatAttribute(
  geometry: BufferGeometry,
  name: string,
  values: ArrayLike<number>,
): void {
  const attr = ensureInstanceFloatAttribute(geometry, name, values.length, 1);
  const arr = attr.array as Float32Array;
  for (let i = 0; i < values.length; i++) {
    arr[i] = values[i];
  }
  attr.needsUpdate = true;
}

/**
 * Patch MeshStandardMaterial so fragment opacity (and optionally emissive) are
 * multiplied by per-instance attributes. Keeps draw-call collapse while restoring
 * trail/glow falloff that was previously per-mesh material.opacity.
 */
export function enableInstancedMaterialFalloff(
  material: MeshStandardMaterial,
  options: { emissive?: boolean } = {},
): MeshStandardMaterial {
  const mat = material as FalloffMaterial;
  const wantEmissive = options.emissive === true;
  if (mat.userData.instancedFalloffPatched && mat.userData.instancedFalloffEmissive === wantEmissive) {
    return mat;
  }

  mat.transparent = true;
  mat.userData.instancedFalloffPatched = true;
  mat.userData.instancedFalloffEmissive = wantEmissive;

  const cacheKey = `instanced-falloff-o${wantEmissive ? 'e' : ''}`;
  mat.customProgramCacheKey = () => cacheKey;

  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute float ${INSTANCE_OPACITY_ATTR};
varying float vInstanceOpacity;
${wantEmissive ? `attribute float ${INSTANCE_EMISSIVE_ATTR};\nvarying float vInstanceEmissive;` : ''}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vInstanceOpacity = ${INSTANCE_OPACITY_ATTR};
${wantEmissive ? `vInstanceEmissive = ${INSTANCE_EMISSIVE_ATTR};` : ''}`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying float vInstanceOpacity;
${wantEmissive ? 'varying float vInstanceEmissive;' : ''}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.a *= vInstanceOpacity;`,
      );

    if (wantEmissive) {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vInstanceEmissive;',
      );
    }
  };

  mat.needsUpdate = true;
  return mat;
}

/**
 * Convenience: attach static index falloff `1 - i/count` used by Viper/Cobra trails.
 * Safe on shared module geometries because every consumer uses the same curve.
 */
export function attachLinearTrailOpacityFalloff(
  geometry: BufferGeometry,
  count: number,
): void {
  const values = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    values[i] = 1 - i / count;
  }
  writeInstanceFloatAttribute(geometry, INSTANCE_OPACITY_ATTR, values);
}

/** Mark instance attribute dirty after writing through InstancedMesh.geometry. */
export function markInstanceAttrNeedsUpdate(mesh: InstancedMesh | null, name: string): void {
  if (!mesh) return;
  const attr = mesh.geometry.getAttribute(name);
  if (attr) attr.needsUpdate = true;
}

/** Type guard helper for disposing only non-shared falloff mats. */
export function isFalloffPatchedMaterial(material: Material | null | undefined): boolean {
  return !!(material as FalloffMaterial | null | undefined)?.userData?.instancedFalloffPatched;
}
