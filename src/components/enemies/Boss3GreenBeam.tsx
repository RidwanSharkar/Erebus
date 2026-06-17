'use client';

/**
 * Weaver Nexus corruption beam — visuals match Icebeam silhouette, toxic green palette.
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Vector3, Group, CylinderGeometry, TorusGeometry, BoxGeometry } from '@/utils/three-exports';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

const _lightWorldPos = new Vector3();

/** Keep in sync with backend `enemyAI.js` (`boss3StartGreenBeam` / BOSS3_GREEN_BEAM_*). */
const BOSS3_GREEN_BEAM_RANGE = 22;
const BOSS3_GREEN_BEAM_START_OFFSET = 0.65;
const BOSS3_GREEN_BEAM_HALF_WIDTH = 0.52;

const BEAM_SEGMENT_LENGTH = BOSS3_GREEN_BEAM_RANGE - BOSS3_GREEN_BEAM_START_OFFSET;
const BEAM_AXIS_MID_Z = (BOSS3_GREEN_BEAM_START_OFFSET + BOSS3_GREEN_BEAM_RANGE) / 2;
const BEAM_RADIUS_SCALE = BOSS3_GREEN_BEAM_HALF_WIDTH / 0.375;

const BEAM_HOLD_SEC = 8;
const BEAM_BRI_GAIN = 24;

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

export default function Boss3GreenBeam({
  onComplete,
  isActive,
  startTime,
  intensity: externalIntensity = 1,
}: Boss3GreenBeamProps) {
  const beamRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const fadeStartTime = useRef<number | null>(null);

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
        (0.1 * intensity * BEAM_RADIUS_SCALE) / 2,
        0.1 * intensity * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
      inner: new CylinderGeometry(
        (0.25 * intensity * BEAM_RADIUS_SCALE) / 2,
        0.275 * intensity * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
      outer: new CylinderGeometry(
        0.3 * intensity * BEAM_RADIUS_SCALE,
        0.375 * intensity * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
      outermost: new CylinderGeometry(
        0.35 * intensity * BEAM_RADIUS_SCALE,
        0.375 * intensity * BEAM_RADIUS_SCALE,
        BEAM_SEGMENT_LENGTH,
        16,
      ),
    }),
    [intensity],
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

  const spiralCount = Math.floor(5 * intensity);
  const spiralGeometries = useMemo(
    () =>
      Array.from({ length: spiralCount }, () =>
        new TorusGeometry(0.35 * intensity * BEAM_RADIUS_SCALE, 0.05, 8, 32),
      ),
    [spiralCount, intensity],
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

  useEffect(() => {
    if (!isActive && !isFadingOut) {
      setIsFadingOut(true);
      fadeStartTime.current = Date.now();
    }
  }, [isActive, isFadingOut]);

  const shardCount = Math.floor(24 * intensity);
  const zShardSpan = BEAM_SEGMENT_LENGTH * 0.42;
  const shardLayouts = useMemo(() => {
    const rnd = (s: number) => {
      const x = Math.sin(s * 12.9898) * 43758.5453;
      return x - Math.floor(x);
    };
    return Array.from({ length: Math.max(48, shardCount) }, (_, i) => ({
      x: (rnd(i + 0.3) - 0.5) * BOSS3_GREEN_BEAM_HALF_WIDTH * 2.1,
      y: (rnd(i + 0.7) - 0.5) * 1.2,
      z: (rnd(i + 1.1) - 0.5) * zShardSpan,
      rx: rnd(i + 1.9) * Math.PI * 2,
      ry: rnd(i + 2.3) * Math.PI * 2,
      rz: rnd(i + 2.7) * Math.PI * 2,
    }));
  }, [shardCount, zShardSpan]);

  useFrame(() => {
    if (!beamRef.current) return;

    const currentTime = Date.now();
    let fp = fadeProgress;
    let visIntensity = intensity;

    // Position and rotation are inherited from the parent boss group — no manual copy needed.

    if (isFadingOut) {
      if (fadeStartTime.current) {
        const fadeElapsed = currentTime - fadeStartTime.current;
        const fadeDuration = 400;
        const progress = Math.min(fadeElapsed / fadeDuration, 1);
        fp = 1 - progress;
        setFadeProgress(fp);

        if (progress >= 1) {
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
      setIntensity(visIntensity);
      fp = 1;
      setFadeProgress(1);
    }

    const activeTimeHold = isActive ? Math.min((currentTime - startTime) / 1000, BEAM_HOLD_SEC) : 0;
    const cylColors = getGreenBeamColors(activeTimeHold);

    updateGreenCylinderUniforms(cylinderMaterials, cylColors.color, cylColors.emissive, visIntensity, fp);

    beamRef.current.scale.setScalar(fp);

    // Drive the pooled light at the beam source's world position (the source light
    // sits at local [0, 0.9, BOSS3_GREEN_BEAM_START_OFFSET] under the beam group).
    beamRef.current.updateMatrixWorld();
    _lightWorldPos.set(0, 0.9, BOSS3_GREEN_BEAM_START_OFFSET);
    beamRef.current.localToWorld(_lightWorldPos);
    beamLight.current?.setColor(cylColors.emissive);
    beamLight.current?.setPosition(_lightWorldPos.x, _lightWorldPos.y, _lightWorldPos.z);
    beamLight.current?.setIntensity(15 * visIntensity * fp);
  });

  const activeTime = isActive ? Math.min((Date.now() - startTime) / 1000, BEAM_HOLD_SEC) : 0;
  const beamColors = getGreenBeamColors(activeTime);

  return (
    <group ref={beamRef}>
      <group position={[0, 0.9, BOSS3_GREEN_BEAM_START_OFFSET]}>
        <mesh>
          <sphereGeometry args={[0.45 * intensity, 16, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={2.4 * intensity * fadeProgress}
            transparent
            opacity={0.66 * fadeProgress}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.65 * intensity, 16, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={0.72 * intensity * fadeProgress}
            transparent
            opacity={0.64 * fadeProgress}
          />
        </mesh>

      </group>

      <group position={[0, 0.75, BEAM_AXIS_MID_Z]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.core} material={cylinderMaterials.core} />
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.inner} material={cylinderMaterials.inner} />
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.outer} material={cylinderMaterials.outer} />
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          geometry={beamGeometries.outermost}
          material={cylinderMaterials.outermost}
        />

        {spiralGeometries.map((geo, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 4, 0, (i * Math.PI) / -1.5]}
            position={[0, 0, 0]}
            geometry={geo}
          >
            <meshStandardMaterial
              color={beamColors.color}
              emissive={beamColors.emissive}
              emissiveIntensity={1 * intensity * fadeProgress}
              transparent
              opacity={0.32 * fadeProgress}
            />
          </mesh>
        ))}

        {[...Array(shardCount)].map((_, i) => {
          const L = shardLayouts[i];
          return (
            <mesh
              key={`gshard-${i}`}
              geometry={shardGeometry}
              position={[L.x * intensity, L.y * intensity, L.z]}
              rotation={[L.rx, L.ry, L.rz]}
            >
              <meshStandardMaterial
                color={beamColors.color}
                emissive={beamColors.emissive}
                emissiveIntensity={2 * intensity * fadeProgress}
                transparent
                opacity={0.74 * fadeProgress}
              />
            </mesh>
          );
        })}

      </group>
    </group>
  );
}
