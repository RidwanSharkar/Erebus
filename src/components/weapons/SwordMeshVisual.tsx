'use client';

import { useMemo, useEffect, useRef } from 'react';
import {
  Color,
  Shape,
  Mesh,
  Material,
  BufferGeometry,
  ExtrudeGeometry,
} from '@/utils/three-exports';

export interface SwordMeshTheme {
  blade: string;
  emissive: string;
  core: string;
  glow: string;
}

const SOUL_SWORD_THEMES: Record<'green' | 'red' | 'blue' | 'purple', SwordMeshTheme> = {
  green:  { blade: '#00ff88', emissive: '#00cc55', core: '#00ff88', glow: '#00cc55' },
  red:    { blade: '#ff3344', emissive: '#cc1122', core: '#ff3344', glow: '#cc1122' },
  blue:   { blade: '#44aaff', emissive: '#2266dd', core: '#44aaff', glow: '#2266dd' },
  purple: { blade: '#cc44ff', emissive: '#8811cc', core: '#cc44ff', glow: '#8811cc' },
};

export function getSwordThemeForSoulType(soulType: 'green' | 'red' | 'blue' | 'purple'): SwordMeshTheme {
  return SOUL_SWORD_THEMES[soulType] ?? SOUL_SWORD_THEMES.green;
}

function createBladeShape() {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(-0.25, 0.25);
  shape.lineTo(-0.15, -0.15);
  shape.lineTo(0, 0);
  shape.lineTo(0.175, 0.175);
  shape.lineTo(0.15, -0.15);
  shape.lineTo(0, 0);
  shape.lineTo(0, 0.08);
  shape.lineTo(0.2, 0.2);
  shape.quadraticCurveTo(0.8, 0.15, 1.875, 0.18);
  shape.quadraticCurveTo(2.0, 0.15, 2.375, 0);
  shape.quadraticCurveTo(2.0, -0.15, 1.825, -0.18);
  shape.quadraticCurveTo(0.8, -0.15, 0.15, -0.3);
  shape.lineTo(0, -0.08);
  shape.lineTo(0, 0);
  return shape;
}

function createInnerBladeShape() {
  const shape = new Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, 0.06);
  shape.lineTo(0.15, 0.15);
  shape.quadraticCurveTo(1.2, 0.12, 1.75, 0.15);
  shape.quadraticCurveTo(2.0, 0.08, 2.15, 0);
  shape.quadraticCurveTo(2.0, -0.08, 1.75, -0.15);
  shape.quadraticCurveTo(1.2, -0.12, 0.15, -0.275);
  shape.lineTo(0, -0.05);
  shape.lineTo(0, 0);
  return shape;
}

const bladeExtrudeSettings = {
  steps: 2,
  depth: 0.05,
  bevelEnabled: true,
  bevelThickness: 0.014,
  bevelSize: 0.02,
  bevelOffset: 0.04,
  bevelSegments: 2,
};

const innerBladeExtrudeSettings = {
  ...bladeExtrudeSettings,
  depth: 0.06,
  bevelThickness: 0.02,
  bevelSize: 0.02,
  bevelOffset: 0,
  bevelSegments: 6,
};

interface SwordMeshVisualProps {
  theme: SwordMeshTheme;
}

export default function SwordMeshVisual({ theme }: SwordMeshVisualProps) {
  const meshRefs = useRef<(Mesh | null)[]>([]);

  const { bladeGeo, innerGeo } = useMemo(() => ({
    bladeGeo: new ExtrudeGeometry(createBladeShape(), bladeExtrudeSettings),
    innerGeo: new ExtrudeGeometry(createInnerBladeShape(), innerBladeExtrudeSettings),
  }), []);

  const bladeColor = useMemo(() => new Color(theme.blade), [theme.blade]);
  const emissiveColor = useMemo(() => new Color(theme.emissive), [theme.emissive]);
  const coreColor = useMemo(() => new Color(theme.core), [theme.core]);
  const glowColor = useMemo(() => new Color(theme.glow), [theme.glow]);

  useEffect(() => {
    const toDispose: (BufferGeometry | Material)[] = [bladeGeo, innerGeo];
    return () => {
      meshRefs.current.forEach((mesh) => {
        if (!mesh) return;
        const mat = mesh.material;
        if (Array.isArray(mat)) mat.forEach((m) => toDispose.push(m));
        else if (mat) toDispose.push(mat as Material);
      });
      toDispose.forEach((item) => item.dispose());
    };
  }, [bladeGeo, innerGeo]);

  return (
    <group rotation={[-0.65, 0, 0.2]} scale={[0.8, 0.9, 0.65]}>
      <group position={[-1.18, 0.225, 0.3]} rotation={[0, 0, Math.PI / 3]} scale={[0.75, 0.8, 0.65]}>
        <group position={[0.25, -0.55, 0.35]} rotation={[0, 0, -Math.PI]}>
          <mesh ref={(el) => { meshRefs.current[0] = el; }}>
            <cylinderGeometry args={[0.03, 0.04, 0.9, 12]} />
            <meshStandardMaterial color="#2a3b4c" roughness={0.7} />
          </mesh>
          {[...Array(8)].map((_, i) => (
            <mesh key={i} position={[0, +0.35 - i * 0.11, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.045, 0.016, 8, 16]} />
              <meshStandardMaterial color="#1a2b3c" metalness={0.6} roughness={0.4} />
            </mesh>
          ))}
        </group>

        <group position={[0.25, 0.225, 0.35]} rotation={[Math.PI, 1.5, Math.PI]}>
          <mesh>
            <torusGeometry args={[0.26, 0.07, 16, 32]} />
            <meshStandardMaterial color="#4a5b6c" metalness={0.9} roughness={0.1} />
          </mesh>
          {[...Array(8)].map((_, i) => (
            <mesh
              key={`spike-${i}`}
              position={[
                0.25 * Math.cos(i * Math.PI / 4),
                0.25 * Math.sin(i * Math.PI / 4),
                0,
              ]}
              rotation={[0, 0, i * Math.PI / 4 - Math.PI / 2]}
            >
              <coneGeometry args={[0.070, 0.55, 3]} />
              <meshStandardMaterial color="#4a5b6c" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
          <mesh>
            <sphereGeometry args={[0.155, 16, 16]} />
            <meshStandardMaterial
              color={coreColor}
              emissive={coreColor}
              emissiveIntensity={3}
              transparent
              opacity={1}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={40}
              transparent
              opacity={0.8}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.145, 16, 16]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={35}
              transparent
              opacity={0.6}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.175, 16, 16]} />
            <meshStandardMaterial
              color={glowColor}
              emissive={glowColor}
              emissiveIntensity={30}
              transparent
              opacity={0.4}
            />
          </mesh>
        </group>

        <group position={[0.25, 0.5, 0.35]} rotation={[0, -Math.PI / 2, Math.PI / 2]}>
          <mesh ref={(el) => { meshRefs.current[1] = el; }} geometry={bladeGeo}>
            <meshStandardMaterial
              color={bladeColor}
              emissive={emissiveColor}
              emissiveIntensity={1.5}
              metalness={0.3}
              roughness={0.1}
            />
          </mesh>
          <mesh ref={(el) => { meshRefs.current[2] = el; }} geometry={innerGeo}>
            <meshStandardMaterial
              color={bladeColor}
              emissive={emissiveColor}
              emissiveIntensity={3}
              metalness={0.2}
              roughness={0.1}
              opacity={0.8}
              transparent
            />
          </mesh>
        </group>
      </group>
    </group>
  );
}
