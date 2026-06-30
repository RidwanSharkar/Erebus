import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Shape,
  ExtrudeGeometry,
  Group,
  MeshBasicMaterial,
  AdditiveBlending,
  DoubleSide,
} from '@/utils/three-exports';
import type { CoopPortalKind } from './ThroneRoom';

function buildLightningShape(): Shape {
  const s = new Shape();
  s.moveTo(0.13, 0.55);
  s.lineTo(0.38, 0.55);
  s.lineTo(-0.04, 0.06);
  s.lineTo(0.22, 0.06);
  s.lineTo(-0.13, -0.55);
  s.lineTo(-0.38, -0.55);
  s.lineTo(0.04, -0.06);
  s.lineTo(-0.22, -0.06);
  s.lineTo(0.13, 0.55);
  return s;
}

function buildFireShape(): Shape {
  const s = new Shape();
  s.moveTo(0, 0.60);
  s.bezierCurveTo(0.26, 0.40, 0.50, 0.08, 0.44, -0.16);
  s.bezierCurveTo(0.38, -0.42, 0.20, -0.58, 0, -0.58);
  s.bezierCurveTo(-0.20, -0.58, -0.38, -0.42, -0.44, -0.16);
  s.bezierCurveTo(-0.50, 0.08, -0.26, 0.40, 0, 0.60);
  return s;
}

function buildVenomShape(): Shape {
  const s = new Shape();
  s.moveTo(0, -0.58);
  s.bezierCurveTo(0.08, -0.30, 0.50, -0.14, 0.50, 0.16);
  s.bezierCurveTo(0.50, 0.50, 0.26, 0.58, 0, 0.58);
  s.bezierCurveTo(-0.26, 0.58, -0.50, 0.50, -0.50, 0.16);
  s.bezierCurveTo(-0.50, -0.14, -0.08, -0.30, 0, -0.58);
  return s;
}

function buildFrostShape(): Shape {
  const s = new Shape();
  const outerR = 0.52;
  const innerR = 0.19;
  const arms = 6;
  for (let i = 0; i < arms; i++) {
    const outerA = (i / arms) * Math.PI * 2 - Math.PI / 2;
    const innerA = outerA + Math.PI / arms;
    const ox = Math.cos(outerA) * outerR;
    const oy = Math.sin(outerA) * outerR;
    const ix = Math.cos(innerA) * innerR;
    const iy = Math.sin(innerA) * innerR;
    if (i === 0) s.moveTo(ox, oy);
    else s.lineTo(ox, oy);
    s.lineTo(ix, iy);
  }
  s.closePath();
  return s;
}

function buildHeartShape(): Shape {
  const s = new Shape();
  s.moveTo(0, -0.55);
  s.bezierCurveTo(-0.13, -0.27, -0.52, -0.17, -0.52, 0.13);
  s.bezierCurveTo(-0.52, 0.48, -0.18, 0.58, 0, 0.35);
  s.bezierCurveTo(0.18, 0.58, 0.52, 0.48, 0.52, 0.13);
  s.bezierCurveTo(0.52, -0.17, 0.13, -0.27, 0, -0.55);
  return s;
}

function buildStatShape(): Shape {
  const s = new Shape();
  s.moveTo(0, 0.60);
  s.lineTo(0.32, 0.17);
  s.lineTo(0.14, 0.17);
  s.lineTo(0.14, -0.60);
  s.lineTo(-0.14, -0.60);
  s.lineTo(-0.14, 0.17);
  s.lineTo(-0.32, 0.17);
  s.lineTo(0, 0.60);
  return s;
}

function buildCurrencyShape(): Shape {
  const s = new Shape();
  const r = 0.52;
  const segments = 32;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2 - Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  s.closePath();
  const bandH = 0.12;
  const hole = new Shape();
  hole.moveTo(-r, bandH);
  hole.lineTo(r, bandH);
  hole.lineTo(r, -bandH);
  hole.lineTo(-r, -bandH);
  hole.lineTo(-r, bandH);
  s.holes.push(hole);
  return s;
}

const EXTRUDE_OPTS = { steps: 1, depth: 0.06, bevelEnabled: false, curveSegments: 16 };

const SYMBOL_SPEEDS: Partial<Record<CoopPortalKind, [number, number, number]>> = {
  blue:    [0.48, 0.80, 0.22],
  red:     [0.38, 0.55, 0.18],
  green:   [0.42, 0.65, 0.20],
  purple:  [0.30, 0.42, 0.28],
  merchant: [0.35, 0.58, 0.15],
  stat:    [0.44, 0.70, 0.16],
  trial:   [0.52, 0.75, 0.20],
};

export default function PortalSymbol({
  campType,
  portalColor,
}: {
  campType: CoopPortalKind;
  portalColor: string;
}) {
  const groupRef = useRef<Group>(null);

  const shape = useMemo((): Shape | null => {
    switch (campType) {
      case 'blue':    return buildLightningShape();
      case 'red':     return buildFireShape();
      case 'green':   return buildVenomShape();
      case 'purple':  return buildFrostShape();
      case 'merchant': return buildHeartShape();
      case 'stat':    return buildStatShape();
      case 'trial':   return buildCurrencyShape();
      default:        return null;
    }
  }, [campType]);

  const geometry = useMemo(
    () => (shape ? new ExtrudeGeometry(shape, EXTRUDE_OPTS) : null),
    [shape],
  );

  const material = useMemo(
    () =>
      new MeshBasicMaterial({
        color: portalColor,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        blending: AdditiveBlending,
        side: DoubleSide,
      }),
    [portalColor],
  );

  const speeds = SYMBOL_SPEEDS[campType] ?? [0.4, 0.6, 0.2];

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.rotation.y = t * speeds[0];
    g.rotation.z = Math.sin(t * speeds[2] * 1.3) * 0.18;
    g.position.y = Math.sin(t * speeds[1]) * 0.09;
  });

  if (!geometry) return null;

  return (
    <group ref={groupRef} scale={[0.72, 0.72, 0.72]} position={[0, 0, -0.03]}>
      <mesh geometry={geometry} material={material} />
    </group>
  );
}
