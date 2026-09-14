/**
 * Shared spectral / ghost material look (Leviathan-style MeshStandardMaterial patch).
 * Only patch materials that already belong to a cloned scene — never mutate GLTF cache mats.
 */

import {
  Color,
  DoubleSide,
  Material,
  Mesh,
  MeshStandardMaterial,
  Object3D,
} from 'three';

export type SpectralPalette = 'leviathan' | 'deathdealer';

const PALETTE = {
  leviathan: {
    baseOpacity: 0.68,
    color: new Color('#9be7ff'),
    emissive: new Color('#c8f4ff'),
    emissiveIntensity: 0.95,
    rimRgb: '0.78, 0.94, 1.0',
    cacheKey: 'spectral-leviathan-v1',
  },
  deathdealer: {
    baseOpacity: 0.58,
    color: new Color('#ff6a5c'),
    emissive: new Color('#ff544e'),
    emissiveIntensity: 1.05,
    rimRgb: '1.0, 0.55, 0.48',
    cacheKey: 'spectral-deathdealer-v1',
  },
} as const;

type SpectralUniforms = {
  uTime: { value: number };
  uFade: { value: number };
};

type SpectralMaterial = MeshStandardMaterial & {
  userData: MeshStandardMaterial['userData'] & {
    spectralUniforms?: SpectralUniforms;
    spectralBackup?: SpectralBackup;
    spectralActive?: boolean;
  };
};

type SpectralBackup = {
  transparent: boolean;
  opacity: number;
  depthWrite: boolean;
  side: import('three').Side;
  metalness: number;
  roughness: number;
  color: Color;
  emissive: Color;
  emissiveIntensity: number;
  customProgramCacheKey?: () => string;
};

function patchSpectralMaterial(mat: Material, palette: SpectralPalette): void {
  const cfg = PALETTE[palette];
  const stdCandidate = mat as MeshStandardMaterial;
  if (!stdCandidate.isMeshStandardMaterial) {
    const anyMat = mat as Material & {
      transparent?: boolean;
      opacity?: number;
      depthWrite?: boolean;
      side?: number;
      color?: Color;
      emissive?: Color;
      emissiveIntensity?: number;
      metalness?: number;
      roughness?: number;
      userData?: Record<string, unknown>;
    };
    anyMat.transparent = true;
    anyMat.opacity = cfg.baseOpacity;
    if ('depthWrite' in anyMat) anyMat.depthWrite = false;
    if ('side' in anyMat) anyMat.side = DoubleSide;
    if (anyMat.color) anyMat.color.lerp(cfg.color, 0.55);
    if (anyMat.emissive) {
      anyMat.emissive.copy(cfg.emissive);
      anyMat.emissiveIntensity = cfg.emissiveIntensity;
    }
    if (typeof anyMat.metalness === 'number') anyMat.metalness = 0;
    if (typeof anyMat.roughness === 'number') anyMat.roughness = Math.max(anyMat.roughness, 0.72);
    if (anyMat.userData) anyMat.userData.spectralActive = true;
    mat.needsUpdate = true;
    return;
  }

  const std = mat as SpectralMaterial;
  if (std.userData.spectralActive) return;

  std.userData.spectralBackup = {
    transparent: std.transparent,
    opacity: std.opacity,
    depthWrite: std.depthWrite,
    side: std.side,
    metalness: std.metalness,
    roughness: std.roughness,
    color: std.color.clone(),
    emissive: std.emissive.clone(),
    emissiveIntensity: std.emissiveIntensity,
    customProgramCacheKey: std.customProgramCacheKey,
  };

  std.transparent = true;
  std.opacity = cfg.baseOpacity;
  std.depthWrite = false;
  std.side = DoubleSide;
  std.metalness = 0;
  std.roughness = Math.max(std.roughness, 0.72);
  std.color.lerp(cfg.color, 0.55);
  std.emissive.copy(cfg.emissive);
  std.emissiveIntensity = cfg.emissiveIntensity;

  const uniforms: SpectralUniforms = {
    uTime: { value: 0 },
    uFade: { value: 1 },
  };
  std.userData.spectralUniforms = uniforms;
  std.userData.spectralActive = true;
  std.customProgramCacheKey = () => cfg.cacheKey;

  const rimRgb = cfg.rimRgb;
  std.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uFade = uniforms.uFade;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
varying float vSpectralFresnel;`,
      )
      .replace(
        '#include <skinning_vertex>',
        `#include <skinning_vertex>
{
  float shimmer = sin(uTime * 3.4 + transformed.x * 7.0 + transformed.z * 5.0) * 0.028
    + sin(uTime * 5.1 + transformed.y * 9.0) * 0.012;
  transformed += objectNormal * shimmer;
}`,
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
{
  vec3 viewN = normalize(normalMatrix * objectNormal);
  vec3 viewDir = normalize(-mvPosition.xyz);
  float ndotv = abs(dot(viewN, viewDir));
  vSpectralFresnel = pow(1.0 - clamp(ndotv, 0.0, 1.0), 2.2);
}`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uFade;
varying float vSpectralFresnel;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float rim = mix(0.55, 1.0, vSpectralFresnel);
diffuseColor.a *= rim * uFade;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${rimRgb}), vSpectralFresnel * 0.45);`,
      );
  };

  std.needsUpdate = true;
}

function restoreSpectralMaterial(mat: Material): void {
  const std = mat as SpectralMaterial;
  if (!std.isMeshStandardMaterial || !std.userData?.spectralActive) return;
  const backup = std.userData.spectralBackup;
  if (backup) {
    std.transparent = backup.transparent;
    std.opacity = backup.opacity;
    std.depthWrite = backup.depthWrite;
    std.side = backup.side;
    std.metalness = backup.metalness;
    std.roughness = backup.roughness;
    std.color.copy(backup.color);
    std.emissive.copy(backup.emissive);
    std.emissiveIntensity = backup.emissiveIntensity;
  }
  delete std.userData.spectralUniforms;
  delete std.userData.spectralBackup;
  std.userData.spectralActive = false;
  // Clear shader patch so the material recompiles to the stock program.
  std.onBeforeCompile = () => {};
  if (backup?.customProgramCacheKey) {
    std.customProgramCacheKey = backup.customProgramCacheKey;
  } else {
    std.customProgramCacheKey = () => '';
  }
  std.needsUpdate = true;
}

/** Apply spectral look to all meshes under `root` (cloned materials only). */
export function applySpectralLook(root: Object3D, palette: SpectralPalette = 'deathdealer'): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat) patchSpectralMaterial(mat, palette);
    }
  });
}

/** Restore materials previously patched by `applySpectralLook`. */
export function clearSpectralLook(root: Object3D): void {
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (mat) restoreSpectralMaterial(mat);
    }
  });
}

/** Drive shimmer time (+ optional travel fade) on patched spectral materials. */
export function updateSpectralUniforms(
  root: Object3D | null,
  fade: number,
  time: number,
): void {
  if (!root) return;
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const uniforms = (mat as SpectralMaterial).userData?.spectralUniforms;
      if (!uniforms) continue;
      uniforms.uFade.value = fade;
      uniforms.uTime.value = time;
    }
  });
}
