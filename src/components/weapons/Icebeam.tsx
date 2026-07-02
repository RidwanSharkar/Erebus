import { useRef, useEffect, useMemo } from 'react';
import { Group, Vector3, Color, CylinderGeometry, TorusGeometry, BoxGeometry, Mesh, MeshStandardMaterial } from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { ICEBEAM_MAX_HOLD_SEC } from '@/utils/icebeamConstants';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import {
  getEntropicBeamColors,
  type EntropicColorVariant,
} from '@/utils/entropicColorThemes';

const _scratchA = new Color();
const _scratchB = new Color();
const _sourceLightPos = new Vector3();
const _tipLightPos = new Vector3();
const _beamColor = new Color();
const _beamEmissive = new Color();

const MAX_SPIRALS = 6;
const MAX_SHARDS = 31;

/** ~matches prior MeshStandard stack when mapped through additive cylinders. */
const ICE_BEAM_BRI_GAIN = 24;

interface IcebeamProps {
  parentRef: React.RefObject<Group>;
  onComplete: () => void;
  isActive: boolean;
  startTime: number;
  intensity?: number;
  /** Fixed entropic boon palette when Icebeam class boon + colored room boon are active. */
  colorVariant?: EntropicColorVariant;
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
  colorVariant,
}: IcebeamProps) {
  const beamRef = useRef<Group>(null);
  const sourceGroupRef = useRef<Group>(null);
  const tipGroupRef = useRef<Group>(null);
  const intensityRef = useRef(1);
  const fadeProgressRef = useRef(0);
  const isFadingOutRef = useRef(false);
  const fadeStartTime = useRef<number | null>(null);
  const currentPosition = useRef(new Vector3());
  const currentDirection = useRef(new Vector3());

  const sourceMeshRefs = useRef<(Mesh | null)[]>([]);
  const sourceMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const spiralMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);
  const spiralMeshRefs = useRef<(Mesh | null)[]>([]);
  const shardMeshRefs = useRef<(Mesh | null)[]>([]);
  const shardMatRefs = useRef<(MeshStandardMaterial | null)[]>([]);

  const shardSeeds = useMemo(
    () =>
      Array.from({ length: MAX_SHARDS }, () => ({
        posX: (Math.random() - 0.5) * 1.0,
        posY: (Math.random() - 0.5) * 1.75,
        posZ: Math.random() * 5 - 11,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
        rotZ: Math.random() * Math.PI * 2,
      })),
    [],
  );

  // Two pooled point lights (beam source + beam tip) replace the mounted <pointLight>s.
  const sourceLight = useDynamicLight({ color: _scratchA.clone(), priority: 2 });
  const tipLight = useDynamicLight({ color: _scratchB.clone(), priority: 2 });

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
      core: new CylinderGeometry(0.05, 0.1, 20, 16),
      inner: new CylinderGeometry(0.125, 0.275, 20, 16),
      outer: new CylinderGeometry(0.3, 0.375, 20, 16),
      outermost: new CylinderGeometry(0.35, 0.375, 20, 16),
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
    () => Array.from({ length: MAX_SPIRALS }, () => new TorusGeometry(0.35, 0.05, 8, 32)),
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

  useEffect(() => {
    if (!isActive && !isFadingOutRef.current) {
      isFadingOutRef.current = true;
      fadeStartTime.current = Date.now();
    }
  }, [isActive]);

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
    if (colorVariant) {
      return getEntropicBeamColors(colorVariant);
    }

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

  const updateBeamMaterialColors = (
    colorHex: string,
    emissiveHex: string,
    intens: number,
    fp: number,
  ) => {
    _beamColor.set(colorHex);
    _beamEmissive.set(emissiveHex);

    for (const mat of sourceMatRefs.current) {
      if (!mat) continue;
      mat.color.copy(_beamColor);
      mat.emissive.copy(_beamEmissive);
      mat.emissiveIntensity = (mat === sourceMatRefs.current[0] ? 2.5 : 0.7) * intens * fp;
      mat.opacity = 0.65 * fp;
    }

    const spiralCount = Math.floor(5 * intens);
    for (let i = 0; i < MAX_SPIRALS; i++) {
      const mesh = spiralMeshRefs.current[i];
      if (mesh) mesh.visible = i < spiralCount;
      const mat = spiralMatRefs.current[i];
      if (mat) {
        mat.color.copy(_beamColor);
        mat.emissive.copy(_beamEmissive);
        mat.emissiveIntensity = 1 * intens * fp;
        mat.opacity = 0.3 * fp;
      }
    }

    const shardCount = Math.floor(24 * intens);
    for (let i = 0; i < MAX_SHARDS; i++) {
      const mesh = shardMeshRefs.current[i];
      if (mesh) {
        mesh.visible = i < shardCount;
        if (i < shardCount) {
          const seed = shardSeeds[i];
          mesh.position.set(
            seed.posX * intens,
            seed.posY * intens,
            seed.posZ,
          );
          mesh.rotation.set(seed.rotX, seed.rotY, seed.rotZ);
        }
      }
      const mat = shardMatRefs.current[i];
      if (mat) {
        mat.color.copy(_beamColor);
        mat.emissive.copy(_beamEmissive);
        mat.emissiveIntensity = 2 * intens * fp;
        mat.opacity = 0.75 * fp;
      }
    }
  };

  useFrame(() => {
    if (!beamRef.current) return;

    const currentTime = Date.now();
    let fp = fadeProgressRef.current;
    let visIntensity = intensityRef.current;

    if (parentRef.current) {
      currentPosition.current.copy(parentRef.current.position);
      currentPosition.current.y += 1;

      currentDirection.current.set(0, 0, 1);
      currentDirection.current.applyQuaternion(parentRef.current.quaternion);

      beamRef.current.position.copy(currentPosition.current);
      beamRef.current.rotation.y = Math.atan2(currentDirection.current.x, currentDirection.current.z);
    }

    if (isFadingOutRef.current) {
      if (fadeStartTime.current) {
        const fadeElapsed = currentTime - fadeStartTime.current;
        const fadeDuration = 400;
        const progress = Math.min(fadeElapsed / fadeDuration, 1);
        fp = 1 - progress;
        fadeProgressRef.current = fp;

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
      intensityRef.current = visIntensity;
      fp = 1;
      fadeProgressRef.current = 1;
    }

    const activeTimeHold = isActive ? Math.min((currentTime - startTime) / 1000, ICEBEAM_MAX_HOLD_SEC) : 0;
    const cylColors = getBeamColors(activeTimeHold);

    updateIceCylinderUniforms(iceCylinderMaterials, cylColors.color, cylColors.emissive, visIntensity, fp);
    updateBeamMaterialColors(cylColors.color, cylColors.emissive, visIntensity, fp);

    for (let i = 0; i < sourceMeshRefs.current.length; i++) {
      const mesh = sourceMeshRefs.current[i];
      if (mesh) {
        const base = i === 0 ? 0.4 : 0.5;
        mesh.scale.setScalar(base * visIntensity);
      }
    }

    for (let i = 0; i < MAX_SPIRALS; i++) {
      const mesh = spiralMeshRefs.current[i];
      if (mesh) mesh.scale.setScalar(visIntensity);
    }

    beamRef.current.scale.setScalar(fp);

    // Drive the two pooled lights at the beam source / tip (world space). Colors follow
    // the cycling emissive hue; intensities/distances replicate the original <pointLight>s.
    _scratchA.set(cylColors.emissive);
    if (sourceGroupRef.current) {
      sourceGroupRef.current.getWorldPosition(_sourceLightPos);
      sourceLight.current?.setPosition(_sourceLightPos.x, _sourceLightPos.y, _sourceLightPos.z);
    }
    sourceLight.current?.setColor(_scratchA);
    sourceLight.current?.setIntensity(16 * visIntensity * fp);
    sourceLight.current?.setDistance(3 * visIntensity);

    if (tipGroupRef.current) {
      tipGroupRef.current.getWorldPosition(_tipLightPos);
      tipLight.current?.setPosition(_tipLightPos.x, _tipLightPos.y, _tipLightPos.z);
    }
    tipLight.current?.setColor(_scratchA);
    tipLight.current?.setIntensity(10 * visIntensity * fp);
    tipLight.current?.setDistance(4 * visIntensity);
  });

  return (
    <group ref={beamRef}>
      <group ref={sourceGroupRef} position={[0, -1.1, 2]}>
        <mesh ref={(el) => { sourceMeshRefs.current[0] = el; }}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            ref={(el) => { sourceMatRefs.current[0] = el; }}
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={2.5}
            transparent
            opacity={0.65}
          />
        </mesh>

        <mesh ref={(el) => { sourceMeshRefs.current[1] = el; }}>
          <sphereGeometry args={[1, 16, 16]} />
          <meshStandardMaterial
            ref={(el) => { sourceMatRefs.current[1] = el; }}
            color="#58FCEC"
            emissive="#00E5FF"
            emissiveIntensity={0.7}
            transparent
            opacity={0.65}
          />
        </mesh>

        {/* Source point light now driven via the shared dynamic light pool (see useFrame). */}
      </group>

      <group position={[0, -1.1, 11.85]}>
        {/* Marker for the beam-tip pooled light position (original local [0,0,12]). */}
        <group ref={tipGroupRef} position={[0, 0, 12]} />
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
            ref={(el) => { spiralMeshRefs.current[i] = el; }}
            rotation={[-Math.PI / 4, 0, (i * Math.PI) / -1.5]}
            position={[0, 0, 10]}
            geometry={geo}
          >
            <meshStandardMaterial
              ref={(el) => { spiralMatRefs.current[i] = el; }}
              color="#58FCEC"
              emissive="#00E5FF"
              emissiveIntensity={1}
              transparent
              opacity={0.3}
            />
          </mesh>
        ))}

        {shardSeeds.map((seed, i) => (
          <mesh
            key={`shard-${i}`}
            ref={(el) => { shardMeshRefs.current[i] = el; }}
            geometry={shardGeometry}
            position={[seed.posX, seed.posY, seed.posZ]}
            rotation={[seed.rotX, seed.rotY, seed.rotZ]}
          >
            <meshStandardMaterial
              ref={(el) => { shardMatRefs.current[i] = el; }}
              color="#58FCEC"
              emissive="#00E5FF"
              emissiveIntensity={2}
              transparent
              opacity={0.75}
            />
          </mesh>
        ))}

        {/* Tip point light now driven via the shared dynamic light pool (see useFrame). */}
      </group>
    </group>
  );
}
