import { useRef, useEffect, useState, useMemo } from 'react';
import { Group, Vector3, Color, CylinderGeometry, TorusGeometry, BoxGeometry } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { ICEBEAM_MAX_HOLD_SEC } from '@/utils/icebeamConstants';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';

const _scratchA = new Color();
const _scratchB = new Color();

/** ~matches prior MeshStandard stack when mapped through additive cylinders. */
const ICE_BEAM_BRI_GAIN = 24;

interface IcebeamProps {
  parentRef: React.RefObject<Group>;
  onComplete: () => void;
  isActive: boolean;
  startTime: number;
  intensity?: number;
}

function updateIceCylinderUniforms(
  mats: ReturnType<typeof createIceCylinderMaterials>,
  colorHex: string,
  emissiveHex: string,
  intens: number,
  fadeProg: number,
): void {
  const vx = intens * fadeProg * ICE_BEAM_BRI_GAIN;
  _scratchA.set(colorHex);
  _scratchB.set(emissiveHex);
  mats.core.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.15);
  mats.core.uniforms.uOpacity.value = 0.95 * fadeProg;
  mats.core.uniforms.uBrightnessMul.value = (50 / 50) * vx;

  mats.inner.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.24);
  mats.inner.uniforms.uOpacity.value = 0.78 * fadeProg;
  mats.inner.uniforms.uBrightnessMul.value = (10 / 50) * vx;

  mats.outer.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.32);
  mats.outer.uniforms.uOpacity.value = 0.62 * fadeProg;
  mats.outer.uniforms.uBrightnessMul.value = (2 / 50) * vx;

  mats.outermost.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.42);
  mats.outermost.uniforms.uOpacity.value = 0.58 * fadeProg;
  mats.outermost.uniforms.uBrightnessMul.value = (0.75 / 50) * vx;

  mats.core.uniforms.uWhiteMix.value = 0.32;
  mats.inner.uniforms.uWhiteMix.value = 0.28;
  mats.outer.uniforms.uWhiteMix.value = 0.24;
  mats.outermost.uniforms.uWhiteMix.value = 0.21;
}

function createIceCylinderMaterials() {
  const placeholder = new Color('#58FCEC');
  return {
    core: createBeamCylinderAdditiveMaterial(placeholder, 0.95, 0.32),
    inner: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.78, 0.28),
    outer: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.62, 0.24),
    outermost: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.58, 0.21),
  };
}

export default function Icebeam({
  parentRef,
  onComplete,
  isActive,
  startTime,
  intensity: externalIntensity = 1,
}: IcebeamProps) {
  const beamRef = useRef<Group>(null);
  const [intensity, setIntensity] = useState(1);
  const [fadeProgress, setFadeProgress] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const fadeStartTime = useRef<number | null>(null);
  const currentPosition = useRef(new Vector3());
  const currentDirection = useRef(new Vector3());

  const iceCylinderMaterials = useMemo(() => createIceCylinderMaterials(), []);

  useEffect(() => {
    const m = iceCylinderMaterials;
    return () => {
      m.core.dispose();
      m.inner.dispose();
      m.outer.dispose();
      m.outermost.dispose();
    };
  }, [iceCylinderMaterials]);

  const beamGeometries = useMemo(
    () => ({
      core: new CylinderGeometry(0.1 * intensity / 2, 0.1 * intensity, 20, 16),
      inner: new CylinderGeometry(0.25 * intensity / 2, 0.275 * intensity, 20, 16),
      outer: new CylinderGeometry(0.3 * intensity, 0.375 * intensity, 20, 16),
      outermost: new CylinderGeometry(0.35 * intensity, 0.375 * intensity, 20, 16),
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
    () => Array.from({ length: spiralCount }, () => new TorusGeometry(0.35 * intensity, 0.05, 8, 32)),
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

  const lerpColor = (color1: string, color2: string, t: number): string => {
    const c1 = color1.replace('#', '');
    const c2 = color2.replace('#', '');
    const r1 = parseInt(c1.substr(0, 2), 16);
    const g1 = parseInt(c1.substr(2, 2), 16);
    const b1 = parseInt(c1.substr(4, 2), 16);
    const r2 = parseInt(c2.substr(0, 2), 16);
    const g2 = parseInt(c2.substr(2, 2), 16);
    const b2 = parseInt(c2.substr(4, 2), 16);

    const r = Math.round(r1 + (r2 - r1) * t);
    const g = Math.round(g1 + (g2 - g1) * t);
    const b = Math.round(b1 + (b2 - b1) * t);

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };

  const getBeamColors = (activeTime: number) => {
    const cycleTime = activeTime % 4;
    const cycleProgress = cycleTime / 4;

    const colors = [
      { color: '#58FCEC', emissive: '#00E5FF' },
      { color: '#58FCEC', emissive: '#00E5FF' },
      { color: '#FF6B35', emissive: '#FF4500' },
      { color: '#8A2BE2', emissive: '#9932CC' },
      { color: '#58FCEC', emissive: '#00E5FF' },
    ];

    const segmentIndex = Math.floor(cycleProgress * 4);
    const segmentProgress = (cycleProgress * 4) % 1;

    const currentColor = colors[segmentIndex];
    const nextColor = colors[segmentIndex + 1] || colors[0];

    return {
      color: lerpColor(currentColor.color, nextColor.color, segmentProgress),
      emissive: lerpColor(currentColor.emissive, nextColor.emissive, segmentProgress),
    };
  };

  useFrame(() => {
    if (!beamRef.current) return;

    const currentTime = Date.now();
    let fp = fadeProgress;
    let visIntensity = intensity;

    if (parentRef.current) {
      currentPosition.current.copy(parentRef.current.position);
      currentPosition.current.y += 1;

      currentDirection.current.set(0, 0, 1);
      currentDirection.current.applyQuaternion(parentRef.current.quaternion);

      beamRef.current.position.copy(currentPosition.current);
      beamRef.current.rotation.y = Math.atan2(currentDirection.current.x, currentDirection.current.z);
    }

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
      const activeTime = Math.min((currentTime - startTime) / 1000, ICEBEAM_MAX_HOLD_SEC);
      const baseIntensity = Math.min(1 + activeTime * 0.3, 2.5);
      const newIntensity = baseIntensity * externalIntensity;
      visIntensity = Math.min(newIntensity, 1.3);
      setIntensity(visIntensity);
      fp = 1;
      setFadeProgress(1);
    }

    const activeTimeHold = isActive ? Math.min((currentTime - startTime) / 1000, ICEBEAM_MAX_HOLD_SEC) : 0;
    const cylColors = getBeamColors(activeTimeHold);

    updateIceCylinderUniforms(iceCylinderMaterials, cylColors.color, cylColors.emissive, visIntensity, fp);

    beamRef.current.scale.setScalar(fp);
  });

  const activeTime = isActive
    ? Math.min((Date.now() - startTime) / 1000, ICEBEAM_MAX_HOLD_SEC)
    : 0;

  const beamColors = getBeamColors(activeTime);
  const shardCount = Math.floor(24 * intensity);

  return (
    <group ref={beamRef}>
      <group position={[0, -1.1, 2]}>
        <mesh>
          <sphereGeometry args={[0.45 * intensity, 16, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={2.5 * intensity * fadeProgress}
            transparent
            opacity={0.65 * fadeProgress}
          />
        </mesh>

        <mesh>
          <sphereGeometry args={[0.65 * intensity, 16, 16]} />
          <meshStandardMaterial
            color={beamColors.color}
            emissive={beamColors.emissive}
            emissiveIntensity={0.7 * intensity * fadeProgress}
            transparent
            opacity={0.65 * fadeProgress}
          />
        </mesh>

        <pointLight color={beamColors.emissive} intensity={16 * intensity * fadeProgress} distance={3 * intensity} />
      </group>

      <group position={[0, -1.1, 11.85]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.core} material={iceCylinderMaterials.core} />
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.inner} material={iceCylinderMaterials.inner} />
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={beamGeometries.outer} material={iceCylinderMaterials.outer} />
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          geometry={beamGeometries.outermost}
          material={iceCylinderMaterials.outermost}
        />

        {spiralGeometries.map((geo, i) => (
          <mesh
            key={i}
            rotation={[-Math.PI / 4, 0, (i * Math.PI) / -1.5]}
            position={[0, 0, 10]}
            geometry={geo}
          >
            <meshStandardMaterial
              color={beamColors.color}
              emissive={beamColors.emissive}
              emissiveIntensity={1 * intensity * fadeProgress}
              transparent
              opacity={0.3 * fadeProgress}
            />
          </mesh>
        ))}

        {[...Array(shardCount)].map((_, i) => (
          <mesh
            key={`shard-${i}`}
            geometry={shardGeometry}
            position={[
              (Math.random() - 0.5) * 1.0 * intensity,
              (Math.random() - 0.5) * 1.75 * intensity,
              Math.random() * 5 - 11,
            ]}
            rotation={[
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
              Math.random() * Math.PI * 2,
            ]}
          >
            <meshStandardMaterial
              color={beamColors.color}
              emissive={beamColors.emissive}
              emissiveIntensity={2 * intensity * fadeProgress}
              transparent
              opacity={0.75 * fadeProgress}
            />
          </mesh>
        ))}

        <pointLight position={[0, 0, 12]} color={beamColors.emissive} intensity={10 * intensity * fadeProgress} distance={4 * intensity} />
      </group>
    </group>
  );
}
