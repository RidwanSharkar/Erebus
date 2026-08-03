import { useRef, useImperativeHandle, forwardRef, useState, useEffect, useMemo } from 'react';
import {
  Group,
  MeshStandardMaterial,
  MeshBasicMaterial,
  CanvasTexture,
  OctahedronGeometry,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';

interface IncinerationChargeAuraProps {
  parentRef: React.RefObject<Group>;
  isActive: boolean;
}

const PARTICLE_COUNT = 8;

/** Evenly distributed spherical shell slots for close orbiting particles. */
const SHELL_SLOTS = Array.from({ length: PARTICLE_COUNT }, (_, i) => {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / PARTICLE_COUNT);
  const theta = Math.PI * (1 + Math.sqrt(5)) * i;
  return {
    theta,
    phi,
    radius: 0.55 + (i % 3) * 0.07,
    phaseOffset: i * 0.73,
    tiltRate: 0.85 + (i % 4) * 0.15,
  };
});

const MAIN_RING_BASE_Y = 0.325;
const PARTICLE_SHELL_BASE_Y = 0.42;
const SCALE = 0.475;
const BAND_INNER = 2.08 * SCALE;
const BAND_OUTER = 2.58 * SCALE;
const BAND_MID = (BAND_INNER + BAND_OUTER) / 2;
const RIM_LINE_WIDTH = 0.025 * SCALE;

const SPIKE_ANGLES = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2) as number[];

const RUNE_BAND_BASE_OPACITY = 0.92;

export const INCINERATION_FIRE_HOT = '#fff1b8';
export const INCINERATION_FIRE_CORE = '#ff6600';
export const INCINERATION_FIRE_GLOW = '#ffaa33';
export const INCINERATION_FIRE_DEEP = '#cc2200';

export const INCINERATION_RUNE_BAND_INNER = 2.08 * SCALE;
export const INCINERATION_RUNE_BAND_OUTER = 2.58 * SCALE;
export const INCINERATION_RUNE_RIM_LINE_WIDTH = 0.025 * SCALE;
export const INCINERATION_RUNE_BAND_BASE_OPACITY = RUNE_BAND_BASE_OPACITY;

const FIRE_HOT = INCINERATION_FIRE_HOT;
const FIRE_CORE = INCINERATION_FIRE_CORE;
const FIRE_GLOW = INCINERATION_FIRE_GLOW;
const FIRE_DEEP = INCINERATION_FIRE_DEEP;

const sharedSpikeGeo = new OctahedronGeometry(1, 0);

let cachedRuneTexture: CanvasTexture | null = null;
const sanctumRuneTextureCache = new Map<string, CanvasTexture>();

export interface IncinerationRuneBandTextureOptions {
  inner: number;
  outer: number;
  glyphCount: number;
}

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
    ctx.strokeStyle = glow ? FIRE_GLOW : FIRE_CORE;
    ctx.globalAlpha = glow ? 0.55 : 1;
    ctx.lineWidth = size * (glow ? 0.22 : 0.09);
    if (glow) {
      ctx.shadowColor = FIRE_GLOW;
      ctx.shadowBlur = size * 0.5;
    } else {
      ctx.shadowBlur = 0;
    }
    ctx.stroke();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function createIncinerationRuneBandTexture({
  inner,
  outer,
  glyphCount,
}: IncinerationRuneBandTextureOptions): CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const outerPx = size / 2;
  const innerPx = outerPx * (inner / outer);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cx, outerPx - 2, 0, Math.PI * 2);
  ctx.arc(cx, cx, innerPx + 2, 0, Math.PI * 2, true);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = 'rgba(40, 12, 4, 0.55)';
  ctx.fillRect(0, 0, size, size);

  const midR = (innerPx + outerPx) / 2;
  const bandWidth = outerPx - innerPx;
  let seed = 4242;
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

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export function getIncinerationRuneBandTextureForRing(
  options: IncinerationRuneBandTextureOptions,
): CanvasTexture {
  const cacheKey = `${options.inner}:${options.outer}:${options.glyphCount}`;
  const cached = sanctumRuneTextureCache.get(cacheKey);
  if (cached) return cached;

  const texture = createIncinerationRuneBandTexture(options);
  sanctumRuneTextureCache.set(cacheKey, texture);
  return texture;
}

export function getIncinerationRuneBandTexture(): CanvasTexture {
  if (cachedRuneTexture) return cachedRuneTexture;

  cachedRuneTexture = createIncinerationRuneBandTexture({
    inner: BAND_INNER,
    outer: BAND_OUTER,
    glyphCount: 30,
  });
  return cachedRuneTexture;
}

const IncinerationChargeAura = forwardRef<{ isActive: boolean }, IncinerationChargeAuraProps>(({
  parentRef,
  isActive,
}, ref) => {
  const auraRef = useRef<Group>(null);
  const mainRingRef = useRef<Group>(null);
  const innerRunesRef = useRef<Group>(null);
  const outerRunesRef = useRef<Group>(null);
  const particleGroupRefs = useRef<(Group | null)[]>([]);
  const outerDiscMatRef = useRef<MeshStandardMaterial>(null);
  const innerDiscMatRef = useRef<MeshStandardMaterial>(null);
  const opacityRef = useRef(0);
  const timeRef = useRef(0);
  const isActiveRef = useRef(isActive);
  const shouldRenderRef = useRef(false);
  const [shouldRender, setShouldRender] = useState(false);

  const runeBandTexture = useMemo(() => getIncinerationRuneBandTexture(), []);
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

  isActiveRef.current = isActive;
  shouldRenderRef.current = shouldRender;

  useImperativeHandle(ref, () => ({
    isActive,
  }));

  useEffect(() => {
    if (!isActive) return;
    runeBandMaterial.opacity = RUNE_BAND_BASE_OPACITY;
    opacityRef.current = 0;
    setShouldRender(true);
  }, [isActive, runeBandMaterial]);

  useEffect(() => {
    return () => {
      runeBandMaterial.dispose();
    };
  }, [runeBandMaterial]);

  useFrame((_, delta) => {
    if (!auraRef.current || !parentRef.current) return;

    const parentPosition = parentRef.current.position;
    auraRef.current.position.set(parentPosition.x, 0.35, parentPosition.z);
    auraRef.current.rotation.y += 0.0012;

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

    const chargeSec = timeRef.current;
    const t = chargeSec * 1000;
    const spinMul = 1 + Math.min(chargeSec * 1.2, 4);
    const shellSpin = chargeSec * 2.5 * spinMul;
    const shellTilt = chargeSec * 1.7 * spinMul;

    if (active && mainRingRef.current) {
      const bob = Math.sin(chargeSec * 2.4) * (0.06 + Math.min(chargeSec * 0.015, 0.08));
      mainRingRef.current.position.y = MAIN_RING_BASE_Y + bob;
    } else if (mainRingRef.current) {
      mainRingRef.current.position.y = MAIN_RING_BASE_Y;
    }

    if (innerRunesRef.current) {
      innerRunesRef.current.rotation.y = t * 0.0007 * spinMul;
    }
    if (outerRunesRef.current) {
      outerRunesRef.current.rotation.y = t * 0.00085 * spinMul;
    }

    if (outerDiscMatRef.current) {
      outerDiscMatRef.current.emissiveIntensity = 2.2 + Math.sin(t * 0.004) * 0.5;
    }
    if (innerDiscMatRef.current) {
      innerDiscMatRef.current.emissiveIntensity = 2.8 + Math.cos(t * 0.005) * 0.4;
    }

    for (let i = 0; i < SHELL_SLOTS.length; i++) {
      const group = particleGroupRefs.current[i];
      if (!group || group.children.length < 2) continue;

      const slot = SHELL_SLOTS[i];
      const primary = group.children[0];
      const secondary = group.children[1];
      const theta = slot.theta + shellSpin;
      const phi = slot.phi + Math.sin(shellTilt * slot.tiltRate + slot.phaseOffset) * 0.35;
      const r = slot.radius;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      primary.position.set(
        r * sinPhi * Math.cos(theta),
        r * cosPhi,
        r * sinPhi * Math.sin(theta),
      );
      secondary.position.set(
        r * sinPhi * Math.cos(theta + Math.PI),
        -r * cosPhi,
        r * sinPhi * Math.sin(theta + Math.PI),
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
      <group ref={mainRingRef} position={[0, MAIN_RING_BASE_Y, 0]}>
        <group ref={innerRunesRef} position={[0, -0.505, 0]}>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            material={runeBandMaterial}
            userData={{ baseOpacity: RUNE_BAND_BASE_OPACITY }}
          >
            <ringGeometry args={[BAND_INNER, BAND_OUTER, 48]} />
          </mesh>
        </group>

        <group ref={outerRunesRef} position={[0, -0.515, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.92 }}>
            <ringGeometry args={[BAND_INNER - RIM_LINE_WIDTH, BAND_INNER, 48]} />
            <meshStandardMaterial
              color={FIRE_CORE}
              emissive={FIRE_GLOW}
              emissiveIntensity={2.6}
              transparent
              opacity={0.92}
              depthWrite={false}
            />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} userData={{ baseOpacity: 0.95 }}>
            <ringGeometry args={[BAND_OUTER, BAND_OUTER + RIM_LINE_WIDTH, 48]} />
            <meshStandardMaterial
              color={FIRE_DEEP}
              emissive={FIRE_CORE}
              emissiveIntensity={2.4}
              transparent
              opacity={0.95}
              depthWrite={false}
            />
          </mesh>
        </group>
      </group>

      <group position={[0, -0.12, 0]}>
        <mesh scale={[1, 0.08, 1]} userData={{ baseOpacity: 0.38 }}>
          <ringGeometry args={[3.0 * SCALE, 4.5 * SCALE, 32]} />
          <meshStandardMaterial
            ref={outerDiscMatRef}
            color={FIRE_DEEP}
            emissive={FIRE_CORE}
            emissiveIntensity={2.2}
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={[1, 0.06, 1]} userData={{ baseOpacity: 0.42 }}>
          <ringGeometry args={[3.4 * SCALE, 4.2 * SCALE, 24]} />
          <meshStandardMaterial
            ref={innerDiscMatRef}
            color={FIRE_CORE}
            emissive={FIRE_GLOW}
            emissiveIntensity={2.4}
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
      </group>

      <group position={[0, PARTICLE_SHELL_BASE_Y, 0]}>
        {SHELL_SLOTS.map((_, i) => (
          <group
            key={`particle-group-${i}`}
            ref={(el) => {
              particleGroupRefs.current[i] = el;
            }}
          >
            <mesh scale={[0.08, 0.08, 0.08]} userData={{ baseOpacity: 0.9 }}>
              <sphereGeometry args={[1, 8, 8]} />
              <meshStandardMaterial
                color={FIRE_CORE}
                emissive={FIRE_GLOW}
                emissiveIntensity={2.6}
                transparent
                opacity={0.9}
                depthWrite={false}
              />
            </mesh>
            <mesh scale={[0.035, 0.035, 0.035]} userData={{ baseOpacity: 0.8 }}>
              <sphereGeometry args={[1, 6, 6]} />
              <meshStandardMaterial
                color={FIRE_GLOW}
                emissive={FIRE_HOT}
                emissiveIntensity={2.2}
                transparent
                opacity={0.8}
                depthWrite={false}
              />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
});

IncinerationChargeAura.displayName = 'IncinerationChargeAura';

export default IncinerationChargeAura;
