'use client';

/**
 * Weaver Nexus corruption beam — visuals match Icebeam silhouette, toxic green palette.
 */

import { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Color,
  Vector3,
  Group,
  Mesh,
  CylinderGeometry,
  TorusGeometry,
  BoxGeometry,
  SphereGeometry,
  MeshStandardMaterial,
} from '@/utils/three-exports';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const _lightWorldPos = new Vector3();

/** Keep in sync with backend `enemyAI.js` (`boss3StartGreenBeam` / BOSS3_GREEN_BEAM_*). */
const BOSS3_GREEN_BEAM_RANGE = 22;
const BOSS3_GREEN_BEAM_START_OFFSET = 0.65;
const BOSS3_GREEN_BEAM_HALF_WIDTH = 0.52;
const BOSS3_GREEN_BEAM_ORIGIN_Y = 2.8;
const BOSS3_GREEN_BEAM_AXIS_Y = 2.65;
const BOSS3_GREEN_BEAM_PITCH_RAD = (10 * Math.PI) / 180;

const BEAM_SEGMENT_LENGTH = BOSS3_GREEN_BEAM_RANGE - BOSS3_GREEN_BEAM_START_OFFSET;
const BEAM_AXIS_MID_Z = (BOSS3_GREEN_BEAM_START_OFFSET + BOSS3_GREEN_BEAM_RANGE) / 2;
const BEAM_RADIUS_SCALE = BOSS3_GREEN_BEAM_HALF_WIDTH / 0.375;

const BEAM_HOLD_SEC = 8;
const BEAM_BRI_GAIN = 24;

const MAX_SPIRALS = 6;
const MAX_SHARDS = 48;

const _scratchA = new Color();
const _scratchB = new Color();

interface Boss3GreenBeamProps {
  onComplete: () => void;
  isActive: boolean;
  startTime: number;
  intensity?: number;
}

function updateGreenCylinderUniforms(
  mats: ReturnType<typeof createGreenCylinderMaterials>,
  colorHex: string,
  emissiveHex: string,
  intens: number,
  fadeProg: number,
): void {
  const vx = intens * fadeProg * BEAM_BRI_GAIN;
  _scratchA.set(colorHex);
  _scratchB.set(emissiveHex);
  mats.core.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.12);
  mats.core.uniforms.uOpacity.value = 0.95 * fadeProg;
  mats.core.uniforms.uBrightnessMul.value = vx;

  mats.inner.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.22);
  mats.inner.uniforms.uOpacity.value = 0.78 * fadeProg;
  mats.inner.uniforms.uBrightnessMul.value = (10 / 50) * vx;

  mats.outer.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.3);
  mats.outer.uniforms.uOpacity.value = 0.62 * fadeProg;
  mats.outer.uniforms.uBrightnessMul.value = (2 / 50) * vx;

  mats.outermost.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.38);
  mats.outermost.uniforms.uOpacity.value = 0.58 * fadeProg;
  mats.outermost.uniforms.uBrightnessMul.value = (0.75 / 50) * vx;

  mats.core.uniforms.uWhiteMix.value = 0.28;
  mats.inner.uniforms.uWhiteMix.value = 0.24;
  mats.outer.uniforms.uWhiteMix.value = 0.22;
  mats.outermost.uniforms.uWhiteMix.value = 0.19;
}

function createGreenCylinderMaterials() {
  const placeholder = new Color('#5cff9a');
  return {
    core: createBeamCylinderAdditiveMaterial(placeholder, 0.95, 0.3),
    inner: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.78, 0.26),
    outer: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.62, 0.22),
    outermost: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.58, 0.19),
  };
}

function getGreenBeamColors(activeTime: number): { color: string; emissive: string } {
  const t = 0.5 + 0.5 * Math.sin(activeTime * 2.8);
  const c1 = { r: 0x2a, g: 0xff, b: 0x7a };
  const c2 = { r: 0x6e, g: 0xff, b: 0xaa };
  const r = Math.round(c1.r + (c2.r - c1.r) * t);
  const g = Math.round(c1.g + (c2.g - c1.g) * t);
  const b = Math.round(c1.b + (c2.b - c1.b) * t);
  const e1 = { r: 0x0a, g: 0x88, b: 0x44 };
  const e2 = { r: 0x3c, g: 0xff, b: 0x9a };
  const er = Math.round(e1.r + (e2.r - e1.r) * t);
  const eg = Math.round(e1.g + (e2.g - e1.g) * t);
  const eb = Math.round(e1.b + (e2.b - e1.b) * t);
  return {
    color: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
    emissive: `#${er.toString(16).padStart(2, '0')}${eg.toString(16).padStart(2, '0')}${eb.toString(16).padStart(2, '0')}`,
  };
}

function updateStandardBeamMaterial(
  mat: MeshStandardMaterial,
  colorHex: string,
  emissiveHex: string,
  emissiveIntensity: number,
  opacity: number,
): void {
  mat.color.set(colorHex);
  mat.emissive.set(emissiveHex);
  mat.emissiveIntensity = emissiveIntensity;
  mat.opacity = opacity;
}

export default function Boss3GreenBeam({
  onComplete,
  isActive,
  startTime,
  intensity: externalIntensity = 1,
}: Boss3GreenBeamProps) {
  const beamRef = useRef<Group>(null);
  const intensityRef = useRef(1);
  const fadeProgressRef = useRef(0);
  const isFadingOutRef = useRef(false);
  const fadeStartTime = useRef<number | null>(null);
  const completedRef = useRef(false);

  const sourceInnerMeshRef = useRef<Mesh>(null);
  const sourceOuterMeshRef = useRef<Mesh>(null);
  const cylinderMeshRefs = useRef<(Mesh | null)[]>([]);
  const spiralMeshRefs = useRef<(Mesh | null)[]>([]);
  const shardMeshRefs = useRef<(Mesh | null)[]>([]);

  const cylinderMaterials = useMemo(() => createGreenCylinderMaterials(), []);

  // Single pooled light follows the beam source (replaces 2 <pointLight>s along the beam).
  const beamLight = useDynamicLight({ color: '#5cff9a', distance: 3, priority: 1 });

  useEffect(() => {
    const m = cylinderMaterials;
    return () => {
      m.core.dispose();
      m.inner.dispose();
      m.outer.dispose();
      m.outermost.dispose();
    };
  }, [cylinderMaterials]);

  const beamGeometries = useMemo(
    () => ({
      core: new CylinderGeometry(
        (0.1 * BEAM_RADIUS_SCALE) / 2,
        0.1 * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
      inner: new CylinderGeometry(
        (0.25 * BEAM_RADIUS_SCALE) / 2,
        0.275 * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
      outer: new CylinderGeometry(
        0.3 * BEAM_RADIUS_SCALE,
        0.375 * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
      outermost: new CylinderGeometry(
        0.35 * BEAM_RADIUS_SCALE,
        0.375 * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
    }),
    [],
  );

  useEffect(
    () => () => {
      beamGeometries.core.dispose();
      beamGeometries.inner.dispose();
      beamGeometries.outer.dispose();
      beamGeometries.outermost.dispose();
    },
    [beamGeometries],
  );

  const spiralGeometries = useMemo(
    () =>
      Array.from({ length: MAX_SPIRALS }, () =>
        new TorusGeometry(0.35 * BEAM_RADIUS_SCALE, 0.05, 8, 32),
      ),
    [],
  );

  useEffect(
    () => () => {
      spiralGeometries.forEach((g) => g.dispose());
    },
    [spiralGeometries],
  );

  const shardGeometry = useMemo(() => new BoxGeometry(0.05, 0.05, 0.1), []);

  useEffect(
    () => () => {
      shardGeometry.dispose();
    },
    [shardGeometry],
  );

  const sourceSphereGeometries = useMemo(
    () => ({
      inner: new SphereGeometry(0.45, 16, 16),
      outer: new SphereGeometry(0.65, 16, 16),
    }),
    [],
  );

  const sourceSphereMaterials = useMemo(
    () => ({
      inner: new MeshStandardMaterial({
        color: '#2aff7a',
        emissive: '#0a8844',
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
      }),
      outer: new MeshStandardMaterial({
        color: '#2aff7a',
        emissive: '#0a8844',
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
      }),
    }),
    [],
  );

  const spiralMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#2aff7a',
        emissive: '#0a8844',
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
      }),
    [],
  );

  const shardMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#2aff7a',
        emissive: '#0a8844',
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0,
      }),
    [],
  );

  useEffect(
    () => () => {
      sourceSphereGeometries.inner.dispose();
      sourceSphereGeometries.outer.dispose();
      sourceSphereMaterials.inner.dispose();
      sourceSphereMaterials.outer.dispose();
      spiralMaterial.dispose();
      shardMaterial.dispose();
    },
    [sourceSphereGeometries, sourceSphereMaterials, spiralMaterial, shardMaterial],
  );

  useEffect(() => {
    if (!isActive && !isFadingOutRef.current) {
      isFadingOutRef.current = true;
      fadeStartTime.current = Date.now();
    }
  }, [isActive]);

  const zShardSpan = BEAM_SEGMENT_LENGTH * 0.42;
  const shardLayouts = useMemo(() => {
    const rnd = (s: number) => {
      const x = Math.sin(s * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: MAX_SHARDS }, (_, i) => ({
      x: (rnd(i + 0.3) - 0.5) * BOSS3_GREEN_BEAM_HALF_WIDTH * 2.1,
      y: (rnd(i + 0.7) - 0.5) * 1.2,
      z: (rnd(i + 1.1) - 0.5) * zShardSpan,
      rx: rnd(i + 1.9) * Math.PI * 2,
      ry: rnd(i + 2.3) * Math.PI * 2,
      rz: rnd(i + 2.7) * Math.PI * 2,
    }));
  }, [zShardSpan]);

  useFrame(() => {
    if (!beamRef.current || completedRef.current) return;

    const currentTime = Date.now();
    let fp = fadeProgressRef.current;
    let visIntensity = intensityRef.current;

    if (isFadingOutRef.current) {
      if (fadeStartTime.current) {
        const fadeElapsed = currentTime - fadeStartTime.current;
        const fadeDuration = 400;
        const progress = Math.min(fadeElapsed / fadeDuration, 1);
        fp = 1 - progress;
        fadeProgressRef.current = fp;

        if (progress >= 1) {
          completedRef.current = true;
          beamRef.current.scale.setScalar(0);
          onComplete();
          return;
        }
      }
    } else if (isActive) {
      const activeTime = Math.min((currentTime - startTime) / 1000, BEAM_HOLD_SEC);
      const baseIntensity = Math.min(1 + activeTime * 0.22, 2.35);
      const newIntensity = baseIntensity * externalIntensity;
      visIntensity = Math.min(newIntensity, 1.35);
      intensityRef.current = visIntensity;
      fp = 1;
      fadeProgressRef.current = 1;
    }

    const activeTimeHold = isActive ? Math.min((currentTime - startTime) / 1000, BEAM_HOLD_SEC) : 0;
    const cylColors = getGreenBeamColors(activeTimeHold);

    updateGreenCylinderUniforms(cylinderMaterials, cylColors.color, cylColors.emissive, visIntensity, fp);

    beamRef.current.scale.setScalar(fp);

    updateStandardBeamMaterial(
      sourceSphereMaterials.inner,
      cylColors.color,
      cylColors.emissive,
      2.4 * visIntensity * fp,
      0.66 * fp,
    );
    updateStandardBeamMaterial(
      sourceSphereMaterials.outer,
      cylColors.color,
      cylColors.emissive,
      0.72 * visIntensity * fp,
      0.64 * fp,
    );
    sourceInnerMeshRef.current?.scale.setScalar(visIntensity);
    sourceOuterMeshRef.current?.scale.setScalar(visIntensity);

    updateStandardBeamMaterial(
      spiralMaterial,
      cylColors.color,
      cylColors.emissive,
      visIntensity * fp,
      0.32 * fp,
    );
    const spiralCount = Math.floor(5 * visIntensity);
    for (let i = 0; i < MAX_SPIRALS; i += 1) {
      const spiral = spiralMeshRefs.current[i];
      if (!spiral) continue;
      spiral.visible = i < spiralCount;
      if (i < spiralCount) {
        spiral.scale.setScalar(visIntensity);
      }
    }

    updateStandardBeamMaterial(
      shardMaterial,
      cylColors.color,
      cylColors.emissive,
      2 * visIntensity * fp,
      0.74 * fp,
    );
    const shardCount = Math.floor(24 * visIntensity);
    for (let i = 0; i < MAX_SHARDS; i += 1) {
      const shard = shardMeshRefs.current[i];
      if (!shard) continue;
      const layout = shardLayouts[i];
      shard.visible = i < shardCount;
      if (i < shardCount) {
        shard.position.set(layout.x * visIntensity, layout.y * visIntensity, layout.z);
      }
    }

    for (let i = 0; i < 4; i += 1) {
      const cylinder = cylinderMeshRefs.current[i];
      cylinder?.scale.set(visIntensity, visIntensity, 1);
    }

    beamRef.current.updateMatrixWorld();
    _lightWorldPos.set(0, BOSS3_GREEN_BEAM_ORIGIN_Y, BOSS3_GREEN_BEAM_START_OFFSET);
    beamRef.current.localToWorld(_lightWorldPos);
    beamLight.current?.setColor(cylColors.emissive);
    beamLight.current?.setPosition(_lightWorldPos.x, _lightWorldPos.y, _lightWorldPos.z);
    beamLight.current?.setIntensity(15 * visIntensity * fp);
  });

  return (
    <group ref={beamRef} rotation={[BOSS3_GREEN_BEAM_PITCH_RAD, 0, 0]}>
      <group position={[0, BOSS3_GREEN_BEAM_ORIGIN_Y, BOSS3_GREEN_BEAM_START_OFFSET]}>
        <mesh ref={sourceInnerMeshRef} geometry={sourceSphereGeometries.inner} material={sourceSphereMaterials.inner} />
        <mesh ref={sourceOuterMeshRef} geometry={sourceSphereGeometries.outer} material={sourceSphereMaterials.outer} />
      </group>

      <group position={[0, BOSS3_GREEN_BEAM_AXIS_Y, BEAM_AXIS_MID_Z]}>
        <mesh
          ref={(el) => {
            cylinderMeshRefs.current[0] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={beamGeometries.core}
          material={cylinderMaterials.core}
        />
        <mesh
          ref={(el) => {
            cylinderMeshRefs.current[1] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={beamGeometries.inner}
          material={cylinderMaterials.inner}
        />
        <mesh
          ref={(el) => {
            cylinderMeshRefs.current[2] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={beamGeometries.outer}
          material={cylinderMaterials.outer}
        />
        <mesh
          ref={(el) => {
            cylinderMeshRefs.current[3] = el;
          }}
          rotation={[Math.PI / 2, 0, 0]}
          geometry={beamGeometries.outermost}
          material={cylinderMaterials.outermost}
        />

        {spiralGeometries.map((geo, i) => (
          <mesh
            key={i}
            ref={(el) => {
              spiralMeshRefs.current[i] = el;
            }}
            rotation={[-Math.PI / 4, 0, (i * Math.PI) / -1.5]}
            position={[0, 0, 0]}
            geometry={geo}
            material={spiralMaterial}
            visible={false}
          />
        ))}

        {shardLayouts.map((L, i) => (
          <mesh
            key={`gshard-${i}`}
            ref={(el) => {
              shardMeshRefs.current[i] = el;
            }}
            geometry={shardGeometry}
            position={[L.x, L.y, L.z]}
            rotation={[L.rx, L.ry, L.rz]}
            material={shardMaterial}
            visible={false}
          />
        ))}
      </group>
    </group>
  );
}
