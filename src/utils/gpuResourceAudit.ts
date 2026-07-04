'use client';

import type { Material, Mesh, Object3D, Scene, WebGLRenderer } from 'three';

export interface GpuProgramGroup {
  programId: number;
  materialCount: number;
  sampleOwner: string;
  sampleType: string;
  isTroika: boolean;
}

export interface GpuResourceAuditResult {
  memory: {
    geometries: number;
    textures: number;
    programs: number;
  };
  scene: {
    objects: number;
    meshes: number;
    troikaTextMeshes: number;
    troikaTextures: number;
  };
  programGroups: GpuProgramGroup[];
  troikaMaterials: number;
  uniqueProgramsFromMaterials: number;
}

function resolveOwnerName(obj: Object3D): string {
  let cur: Object3D | null = obj;
  while (cur) {
    if (cur.name) return cur.name;
    cur = cur.parent;
  }
  return '(unnamed)';
}

function isTroikaTextMesh(obj: Object3D): boolean {
  const mesh = obj as Mesh & {
    isMesh?: boolean;
    text?: string;
    sync?: () => void;
    material?: Material | Material[];
  };
  if (!mesh.isMesh) return false;
  if (typeof mesh.sync === 'function' && typeof mesh.text === 'string') return true;
  const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
  return mats.some((m) => {
    const mat = m as Material & { isTroikaTextMaterial?: boolean; troikaTextMaterial?: boolean };
    return mat.isTroikaTextMaterial === true || mat.troikaTextMaterial === true;
  });
}

function collectMaterialTextures(material: Material, out: Set<unknown>): void {
  const mat = material as Material & Record<string, unknown>;
  for (const key of Object.keys(mat)) {
    const val = mat[key];
    if (val && typeof val === 'object' && 'isTexture' in val && (val as { isTexture?: boolean }).isTexture) {
      out.add(val);
    }
  }
}

/**
 * Walk the scene and group live materials by their compiled WebGL program.
 * Intended for dev-only diagnostics via window.erebusGpuAudit().
 */
export function runGpuResourceAudit(
  gl: WebGLRenderer,
  scene: Scene,
): GpuResourceAuditResult {
  const rendererProps = (gl as WebGLRenderer & { properties?: Map<Material, { currentProgram?: { id: number } | null }> })
    .properties;

  const programMap = new Map<
    number,
    { count: number; sampleOwner: string; sampleType: string; isTroika: boolean }
  >();
  const troikaTextures = new Set<unknown>();
  let troikaTextMeshes = 0;
  let meshes = 0;
  let objects = 0;
  let troikaMaterials = 0;

  scene.traverse((obj) => {
    objects++;
    const mesh = obj as Mesh & { isMesh?: boolean; material?: Material | Material[] };
    if (!mesh.isMesh) return;
    meshes++;

    if (isTroikaTextMesh(mesh)) {
      troikaTextMeshes++;
    }

    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : mesh.material
        ? [mesh.material]
        : [];

    for (const material of materials) {
      if (!material) continue;

      const isTroika =
        isTroikaTextMesh(mesh) ||
        (material as Material & { isTroikaTextMaterial?: boolean }).isTroikaTextMaterial === true;
      if (isTroika) {
        troikaMaterials++;
        collectMaterialTextures(material, troikaTextures);
      }

      const program = rendererProps?.get(material)?.currentProgram ?? null;
      const programId = program?.id ?? -1;
      const owner = resolveOwnerName(mesh);
      const existing = programMap.get(programId);
      if (existing) {
        existing.count++;
      } else {
        programMap.set(programId, {
          count: 1,
          sampleOwner: owner,
          sampleType: material.type,
          isTroika,
        });
      }
    }
  });

  const programGroups: GpuProgramGroup[] = Array.from(programMap.entries())
    .map(([programId, data]) => ({
      programId,
      materialCount: data.count,
      sampleOwner: data.sampleOwner,
      sampleType: data.sampleType,
      isTroika: data.isTroika,
    }))
    .sort((a, b) => b.materialCount - a.materialCount);

  return {
    memory: {
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      programs: gl.info.programs?.length ?? 0,
    },
    scene: {
      objects,
      meshes,
      troikaTextMeshes,
      troikaTextures: troikaTextures.size,
    },
    programGroups,
    troikaMaterials,
    uniqueProgramsFromMaterials: programGroups.filter((g) => g.programId >= 0).length,
  };
}

/** Pretty-print audit to console and return structured result. */
export function logGpuResourceAudit(gl: WebGLRenderer, scene: Scene): GpuResourceAuditResult {
  const result = runGpuResourceAudit(gl, scene);

  // eslint-disable-next-line no-console
  console.group('[erebusGpuAudit] GPU resource audit');
  // eslint-disable-next-line no-console
  console.log('renderer.info.memory', result.memory);
  // eslint-disable-next-line no-console
  console.log('scene complexity', result.scene);
  // eslint-disable-next-line no-console
  console.log(
    `troika: ${result.scene.troikaTextMeshes} text meshes, ${result.troikaMaterials} materials, ${result.scene.troikaTextures} textures`,
  );
  // eslint-disable-next-line no-console
  console.log(
    `unique programs (from live materials): ${result.uniqueProgramsFromMaterials} / renderer.info.programs: ${result.memory.programs}`,
  );
  // eslint-disable-next-line no-console
  console.table(
    result.programGroups.slice(0, 25).map((g) => ({
      programId: g.programId,
      materials: g.materialCount,
      type: g.sampleType,
      troika: g.isTroika,
      sampleOwner: g.sampleOwner.slice(0, 60),
    })),
  );
  // eslint-disable-next-line no-console
  console.groupEnd();

  return result;
}
