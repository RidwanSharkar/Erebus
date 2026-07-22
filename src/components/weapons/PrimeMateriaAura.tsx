import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useMemo } from 'react';
import {
  Group,
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  OctahedronGeometry,
  CylinderGeometry,
  SphereGeometry,
  InstancedMesh,
  Matrix4,
  Euler,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { CompactPurpleBorderEffects } from '@/components/environment/SimpleBorderEffects';

interface PrimeMateriaAuraProps {
  parentRef: React.RefObject<Group>;
  isActive: boolean;
}

const PARTICLE_ANGLES = [
  0, Math.PI / 4, Math.PI / 2, (Math.PI * 3) / 4,
  Math.PI, (Math.PI * 5) / 4, (Math.PI * 3) / 2, (Math.PI * 7) / 4,
] as const;

/** Inscribed rune band radii — sits within the 3.0–4.5m aura footprint. */
const BAND_INNER = 3.18;
const BAND_OUTER = 3.58;
const BAND_MID = (BAND_INNER + BAND_OUTER) / 2;
const RIM_LINE_WIDTH = 0.045;

const SPIKE_ANGLES = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2) as number[];

const RUNE_BAND_BASE_OPACITY = 0.92;
const BONE_BASE_OPACITY = 1;

/** Red palette for Prime Materia — aligned with BORDER_PALETTE.red. */
const RED_CORE = '#e63946';
const RED_DEEP = '#991b1b';
const RED_GLOW = '#f74f4f';
const RED_ACCENT = '#fca5a5';

const sharedSpikeGeo = new OctahedronGeometry(1, 0);

/** Spinning bone ring — instanced shafts + joint caps (shared geo/mat, not disposed on unmount). */
const BONE_COUNT = 0;
const BONE_SHAFT_HALF_HEIGHT = 0.36;
const sharedBoneGeo = new CylinderGeometry(0.045, 0.06, 0.72, 5);
const sharedJointGeo = new SphereGeometry(0.065, 5, 5);
const sharedBoneMat = new MeshStandardMaterial({
  color: '#f5f0e8',
  emissive: RED_ACCENT,
  emissiveIntensity: 1.6,
  roughness: 0.38,
  metalness: 0.15,
  transparent: true,
  opacity: 1,
  depthWrite: false,
});

const BONE_PHASES = Array.from({ length: BONE_COUNT }, (_, i) => ({
  baseAngle: (i / BONE_COUNT) * Math.PI * 2,
  radius: 3.25 + (i % 3) * 0.12,
  heightOffset: 0.95 + (i % 5) * 0.1,
  bobPhase: i * 0.73,
  tilt: 0.25 + (i % 3) * 0.12,
  scaleY: 1.1 + (i % 3) * 0.15,
}));

const _bonePos = new Vector3();
const _jointPos = new Vector3();
const _jointUp = new Vector3();
const _boneRot = new Euler();
const _boneQuat = new Quaternion();
const _boneScale = new Vector3(1, 1, 1);
const _boneMatrix = new Matrix4();
const _jointScale = new Vector3(1, 1, 1);

function updateBoneRingInstances(
  bonesMesh: InstancedMesh,
  jointsMesh: InstancedMesh | null,
  spin: number,
  time: number,
) {
  for (let i = 0; i < BONE_COUNT; i++) {
    const phase = BONE_PHASES[i];
    const angle = phase.baseAngle + spin;
    const bob = Math.sin(time * 2.2 + phase.bobPhase) * 0.14;

    _bonePos.set(
      Math.cos(angle) * phase.radius,
      phase.heightOffset + bob,
      Math.sin(angle) * phase.radius,
    );
    _boneRot.set(Math.PI / 4 + phase.tilt, angle + Math.PI / 2, Math.PI / 6);
    _boneQuat.setFromEuler(_boneRot);
    _boneScale.set(1, phase.scaleY, 1);
    _boneMatrix.compose(_bonePos, _boneQuat, _boneScale);
    bonesMesh.setMatrixAt(i, _boneMatrix);

    if (jointsMesh) {
      _jointUp.set(0, BONE_SHAFT_HALF_HEIGHT * phase.scaleY, 0).applyQuaternion(_boneQuat);
      _jointPos.copy(_bonePos).add(_jointUp);
      _jointScale.set(0.9 + (i % 2) * 0.08, 0.9 + (i % 2) * 0.08, 0.9 + (i % 2) * 0.08);
      _boneMatrix.compose(_jointPos, _boneQuat, _jointScale);
      jointsMesh.setMatrixAt(i, _boneMatrix);
    }
  }

  bonesMesh.instanceMatrix.needsUpdate = true;
  if (jointsMesh) {
    jointsMesh.instanceMatrix.needsUpdate = true;
  }
}

let cachedRuneTexture: CanvasTexture | null = null;

/** Draws one abstract Futhark-style glyph (stem + 1–3 diagonal branches). */
function drawRuneGlyph(ctx: CanvasRenderingContext2D, size: number, rand: () => number) {
  const branches = 1 + Math.floor(rand() * 3);
  const strokes: [number, number, number, number][] = [[0, -size / 2, 0, size / 2]];

  for (let b = 0; b < branches; b++) {
    const y0 = (rand() - 0.5) * size * 0.7;
    const dir = rand() < 0.5 ? 1 : -1;
    const len = size * (0.3 + rand() * 0.25);
    const ang = Math.PI / 4 + rand() * (Math.PI / 6);
    strokes.push([0, y0, dir * Math.sin(ang) * len, y0 - Math.cos(ang) * len]);
  }

  for (const glow of [true, false]) {
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of strokes) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.lineCap = 'round';
    ctx.strokeStyle = glow ? RED_GLOW : RED_ACCENT;
    ctx.globalAlpha = glow ? 0.55 : 1;
    ctx.lineWidth = size * (glow ? 0.22 : 0.09);
    if (glow) {
      ctx.shadowColor = RED_GLOW;
      ctx.shadowBlur = size * 0.5;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

/** Lazy singleton — procedural glyph band matching RingGeometry planar UV layout. */
function getRuneBandTexture(): CanvasTexture {
  if (cachedRuneTexture) return cachedRuneTexture;

  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const outerPx = size / 2;
  const innerPx = outerPx * (BAND_INNER / BAND_OUTER);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cx, outerPx - 2, 0, Math.PI * 2);
  ctx.arc(cx, cx, innerPx + 2, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(30, 6, 8, 0.55)';
  ctx.fillRect(0, 0, size, size);

  const glyphCount = 32;
  const midR = (innerPx + outerPx) / 2;
  const bandWidth = outerPx - innerPx;
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let i = 0; i < glyphCount; i++) {
    const angle = (i / glyphCount) * Math.PI * 2;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * midR, cx + Math.sin(angle) * midR);
    ctx.rotate(angle + Math.PI / 2);
    drawRuneGlyph(ctx, bandWidth * 0.62, rand);
    ctx.restore();
  }
  ctx.restore();

  cachedRuneTexture = new CanvasTexture(canvas);
  cachedRuneTexture.needsUpdate = true;
  return cachedRuneTexture;
}

const PrimeMateriaAura = forwardRef<{ isActive: boolean }, PrimeMateriaAuraProps>(({
  parentRef,
  isActive,
}, ref) => {
  const auraRef = useRef<Group>(null);
  const innerRunesRef = useRef<Group>(null);
  const halfRunesRef = useRef<Group>(null);
  const midRunesRef = useRef<Group>(null);
  const outerRunesRef = useRef<Group>(null);
  const halfRimsRef = useRef<Group>(null);
  const borderSpinRef = useRef<Group>(null);
  const particleGroupRefs = useRef<(Group | null)[]>([]);
  const outerDiscMatRef = useRef<MeshStandardMaterial>(null);
  const innerDiscMatRef = useRef<MeshStandardMaterial>(null);
  const bonesInstRef = useRef<InstancedMesh>(null);
  const boneJointsInstRef = useRef<InstancedMesh>(null);
  const opacityRef = useRef(0);
  const timeRef = useRef(0);
  const isActiveRef = useRef(isActive);
  const shouldRenderRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);

  const runeBandTexture = useMemo(() => getRuneBandTexture(), []);
  const runeBandMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        map: runeBandTexture,
        transparent: true,
        opacity: RUNE_BAND_BASE_OPACITY,
        depthWrite: false,
      }),
    [runeBandTexture],
  );
  const boneMat = useMemo(() => sharedBoneMat.clone(), []);

  isActiveRef.current = isActive;
  shouldRenderRef.current = shouldRender;

  useImperativeHandle(ref, () => ({
    isActive,
  }));

  useEffect(() => {
    if (!isActive) return;
    runeBandMaterial.opacity = RUNE_BAND_BASE_OPACITY;
    boneMat.opacity = BONE_BASE_OPACITY;
    opacityRef.current = 0;
    setShouldRender(true);
  }, [isActive, runeBandMaterial, boneMat]);

  useEffect(() => {
    if (!shouldRender) return;
    const bonesMesh = bonesInstRef.current;
    if (!bonesMesh) return;
    updateBoneRingInstances(bonesMesh, boneJointsInstRef.current, 0, 0);
  }, [shouldRender]);

  useFrame((_, delta) => {
    if (!auraRef.current || !parentRef.current) return;

    const parentPosition = parentRef.current.position;
    auraRef.current.position.set(parentPosition.x, 0.002, parentPosition.z);
    auraRef.current.rotation.y += 0.0008;

    const active = isActiveRef.current;
    const target = active ? 1 : 0;
    const diff = target - opacityRef.current;

    if (Math.abs(diff) > 0.004) {
      opacityRef.current += diff * 0.05;
    } else {
      opacityRef.current = target;
    }

    auraRef.current.traverse((child: any) => {
      if (child.isMesh && child.material?.transparent) {
        const base: number = child.userData.baseOpacity ?? child.material.opacity;
        if (child.userData.baseOpacity === undefined) {
          child.userData.baseOpacity = child.material.opacity;
        }
        child.material.opacity = base * opacityRef.current;
      }
    });

    if (active) {
      timeRef.current += delta;
    } else {
      timeRef.current = 0;
    }

    const t = timeRef.current * 1000;

    if (innerRunesRef.current) {
      innerRunesRef.current.rotation.y = t * 0.0005;
    }
    if (halfRunesRef.current) {
      halfRunesRef.current.rotation.y = -t * 0.0005;
    }
    if (midRunesRef.current) {
      midRunesRef.current.rotation.y = -t * 0.00035;
    }
    if (outerRunesRef.current) {
      outerRunesRef.current.rotation.y = t * 0.0006;
    }
    if (halfRimsRef.current) {
      halfRimsRef.current.rotation.y = -t * 0.0006;
    }
    if (borderSpinRef.current) {
      borderSpinRef.current.rotation.y = -t * 0.00045;
    }

    if (outerDiscMatRef.current) {
      outerDiscMatRef.current.emissiveIntensity = 2.0 + Math.sin(t * 0.003) * 0.4;
    }
    if (innerDiscMatRef.current) {
      innerDiscMatRef.current.emissiveIntensity = 2.5 + Math.cos(t * 0.004) * 0.3;
    }

    for (let i = 0; i < PARTICLE_ANGLES.length; i++) {
      const group = particleGroupRefs.current[i];
      if (!group || group.children.length < 2) continue;

      const angle = PARTICLE_ANGLES[i];
      const primary = group.children[0];
      const secondary = group.children[1];
      const orbitR = 1.85 + (i % 3) * 0.35;

      primary.position.set(
        Math.cos(angle + t * 0.0008) * orbitR,
        Math.sin(t * 0.0007 + i) * 0.2,
        Math.sin(angle + t * 0.0008) * orbitR,
      );
      secondary.position.set(
        Math.cos(angle + Math.PI + t * 0.001) * (orbitR + 0.45),
        Math.sin(t * 0.0009 + i) * 0.15,
        Math.sin(angle + Math.PI + t * 0.001) * (orbitR + 0.45),
      );
    }

    const bonesMesh = bonesInstRef.current;
    if (bonesMesh) {
      updateBoneRingInstances(
        bonesMesh,
        boneJointsInstRef.current,
        timeRef.current * 0.85,
        timeRef.current,
      );
    }

    if (!active && opacityRef.current <= 0.004) {
      opacityRef.current = 0;
      if (shouldRenderRef.current) setShouldRender(false);
    }
  });

  if (!shouldRender) return null;

  return (
    <group ref={auraRef}>
      {/* Glyph-inscribed rune band — slow spin */}
      <group ref={innerRunesRef} position={[0, -0.4, 0]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          material={runeBandMaterial}
          userData={{ baseOpacity: RUNE_BAND_BASE_OPACITY }}
        >
          <ringGeometry args={[BAND_INNER, BAND_OUTER, 64]} />
        </mesh>
      </group>

      {/* Half-scale glyph band — counter-rotate */}
      <group ref={halfRunesRef} position={[0, -0.39, 0]} scale={[0.5, 0.5, 0.5]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          material={runeBandMaterial}
          userData={{ baseOpacity: RUNE_BAND_BASE_OPACITY }}
        >
          <ringGeometry args={[BAND_INNER, BAND_OUTER, 64]} />
        </mesh>
      </group>

      {/* Diamond rune-stone spikes — counter-rotate */}
      <group ref={midRunesRef} position={[0, -0.38, 0]} scale={[0.65, 0.65, 0.65]}>
        {SPIKE_ANGLES.map((angle, i) => (
          <group
            key={`spike-${i}`}
            position={[Math.cos(angle) * BAND_MID, 0, Math.sin(angle) * BAND_MID]}
            rotation={[0, Math.PI / 2 - angle, 0]}
          >
            <mesh
              rotation={[Math.PI / 2, 0, 0]}
              scale={[0.42, 0.14, 0.05]}
              geometry={sharedSpikeGeo}
              userData={{ baseOpacity: 0.55 }}
            >
              <meshStandardMaterial
                color={RED_DEEP}
                emissive={RED_CORE}
                emissiveIntensity={1.4}
                transparent
                opacity={0.55}
                depthWrite={false}
              />
            </mesh>

          </group>
        ))}
      </group>

      {/* Crisp bright rim lines at band edges */}
      <group ref={outerRunesRef} position={[0, -0.42, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.9 }}>
          <ringGeometry args={[BAND_INNER - RIM_LINE_WIDTH, BAND_INNER, 64]} />
          <meshStandardMaterial
            color={RED_CORE}
            emissive={RED_GLOW}
            emissiveIntensity={2.4}
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.95 }}>
          <ringGeometry args={[BAND_OUTER, BAND_OUTER + RIM_LINE_WIDTH, 64]} />
          <meshStandardMaterial
            color={RED_GLOW}
            emissive={RED_ACCENT}
            emissiveIntensity={2.6}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Half-scale rim lines — counter-rotate */}
      <group ref={halfRimsRef} position={[0, -0.41, 0]} scale={[0.5, 0.5, 0.5]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.9 }}>
          <ringGeometry args={[BAND_INNER - RIM_LINE_WIDTH, BAND_INNER, 64]} />
          <meshStandardMaterial
            color={RED_CORE}
            emissive={RED_GLOW}
            emissiveIntensity={2.4}
            transparent
            opacity={0.9}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.95 }}>
          <ringGeometry args={[BAND_OUTER, BAND_OUTER + RIM_LINE_WIDTH, 64]} />
          <meshStandardMaterial
            color={RED_GLOW}
            emissive={RED_ACCENT}
            emissiveIntensity={2.6}
            transparent
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Thin annular glow discs — donut fill, no solid center */}
      <group position={[0, -0.36, 0]}>
        <mesh scale={[1, 0.08, 1]} userData={{ baseOpacity: 0.35 }}>
          <ringGeometry args={[3.0, 4.5, 48]} />
          <meshStandardMaterial
            ref={outerDiscMatRef}
            color={RED_DEEP}
            emissive={RED_CORE}
            emissiveIntensity={2.0}
            transparent
            opacity={0.35}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={[1, 0.06, 1]} userData={{ baseOpacity: 0.4 }}>
          <ringGeometry args={[3.4, 4.2, 32]} />
          <meshStandardMaterial
            ref={innerDiscMatRef}
            color={RED_GLOW}
            emissive={RED_ACCENT}
            emissiveIntensity={2.5}
            transparent
            opacity={0.4}
            depthWrite={false}
          />
        </mesh>
      </group>


      {/* Miniature moving border effects at the 4.5m rim */}
      <group ref={borderSpinRef} position={[0, -0.4, 0]}>
        <CompactPurpleBorderEffects
          radius={2.7}
          count={16}
          enableParticles
          particleCount={16}
          borderTheme="red"
          variant="minimal"
        />
      </group>
      



    </group>
  );
});

PrimeMateriaAura.displayName = 'PrimeMateriaAura';

export default PrimeMateriaAura;
