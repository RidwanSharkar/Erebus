import React, { useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  BoxGeometry,
  ConeGeometry,
  TubeGeometry,
  CatmullRomCurve3,
  Matrix4,
  Vector3,
  Group,
  Euler,
} from '@/utils/three-exports';

export type RoomBorderTheme = 'red' | 'blue' | 'green' | 'purple';

/** Superset for instanced border tinting (e.g. throne uses `gold` instead of red). */
export type SimpleBorderColorTheme = RoomBorderTheme | 'gold';

interface SimpleBorderEffectsProps {
  radius?: number;
  count?: number;
  enableParticles?: boolean;
  particleCount?: number;
  /** Camp archetype, or `gold` (throne) */
  borderTheme?: SimpleBorderColorTheme;
  /** `minimal` drops archways, middle poles, and cone caps — used by Prime Materia aura. */
  variant?: 'full' | 'minimal';
}

/** Perimeter pillar + particle colours aligned with camp type */
const BORDER_PALETTE: Record<
  SimpleBorderColorTheme,
  { particle: number; glow: number; archway: number; poles: number }
> = {
  red: {
    particle: 0xf40000,
    glow: 0xf74f4f,
    archway: 0xe63946,
    poles: 0xf74f4f,
  },
  gold: {
    particle: 0xca8a04,
    glow: 0xfde047,
    archway: 0xfacc15,
    poles: 0xfacc15,
  },
  blue: {
    particle: 0x7fc8ff,
    glow: 0xb8e4ff,
    archway: 0x62aef2,
    poles: 0xb8e4ff,
  },
  green: {
    particle: 0x15803d,
    glow: 0x4ade80,
    archway: 0x16a34a,
    poles: 0x4ade80,
  },
  purple: {
    particle: 0xb18bff,
    glow: 0xd4c2ff,
    archway: 0x9b6fe8,
    poles: 0xd4c2ff,
  },
};

/**
 * Ultra-performance circular gate effects with spinning pillars and curved archways
 * Perfect for maintaining 120+ FPS while adding atmospheric elements
 */
const SimpleBorderEffects: React.FC<SimpleBorderEffectsProps> = ({
  radius = 25,
  count = 64,
  enableParticles = true,
  particleCount = 100,
  borderTheme = 'red',
}) => {
  return <SimpleBorderEffectsInner
    radius={radius}
    count={count}
    enableParticles={enableParticles}
    particleCount={particleCount}
    borderTheme={borderTheme}
    halfHeight={false}
    reverseRotation={false}
  />;
};

interface SimpleBorderEffectsInnerProps extends SimpleBorderEffectsProps {
  halfHeight?: boolean;
  reverseRotation?: boolean;
}

const SimpleBorderEffectsInner: React.FC<SimpleBorderEffectsInnerProps> = ({
  radius = 25,
  count = 40,
  enableParticles = true,
  particleCount = 100,
  borderTheme = 'red',
  halfHeight = false,
  reverseRotation = false,
  variant = 'full',
}) => {
  const isMinimal = variant === 'minimal';
  const particleRef = useRef<InstancedMesh>(null);
  const glowRef = useRef<InstancedMesh>(null);
  const coneRef = useRef<InstancedMesh>(null);
  const archwayRef = useRef<InstancedMesh>(null);
  const middlePolesRef = useRef<InstancedMesh>(null);
  const groupRef = useRef<Group>(null);

  // CRITICAL: Cache Matrix4 to prevent memory leak from creating new ones every frame
  const matrixRef = useRef<Matrix4>(new Matrix4());

  // Generate particle positions in a ring around the border
  const particlePositions = useMemo(() => {
    const positions: Vector3[] = [];
    const angleStep = (Math.PI * 2) / particleCount;
    const maxHeight = halfHeight ? 1 : 2; // Half height for compact version

    for (let i = 0; i < particleCount; i++) {
      const angle = i * angleStep;
      const distance = radius + (Math.random() - 0.5) * 3; // Slight variation
      const x = Math.cos(angle) * distance;
      const z = Math.sin(angle) * distance;
      const y = Math.random() * maxHeight; // Random height

      positions.push(new Vector3(x, y, z));
    }

    return positions;
  }, [radius, particleCount, halfHeight]);

  // Generate glow positions (fewer, larger)
  const glowPositions = useMemo(() => {
    const positions: Vector3[] = [];
    const angleStep = (Math.PI * 2) / count;
    const yPosition = halfHeight ? 0.375 : 0.65; // Half the pillar height for ground positioning

    for (let i = 0; i < count; i++) {
      const angle = i * angleStep;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      positions.push(new Vector3(x, yPosition, z)); // Position pillars so they sit on ground (half height + ground offset)
    }

    return positions;
  }, [radius, count, halfHeight]);

  // One transform per gate — shared tube arch geometry is instanced at each midpoint
  const gateArchTransforms = useMemo(() => {
    if (isMinimal) return [] as { position: Vector3; rotation: Euler }[];

    const transforms: { position: Vector3; rotation: Euler }[] = [];
    const angleStep = (Math.PI * 2) / count;

    for (let i = 0; i < count; i++) {
      const startAngle = i * angleStep;
      const endAngle = ((i + 1) % count) * angleStep;

      const x1 = Math.cos(startAngle) * radius;
      const z1 = Math.sin(startAngle) * radius;
      const x2 = Math.cos(endAngle) * radius;
      const z2 = Math.sin(endAngle) * radius;

      // Chord midpoint so tube endpoints land on the gate pillars
      const midX = (x1 + x2) / 2;
      const midZ = (z1 + z2) / 2;

      const dirX = x2 - x1;
      const dirZ = z2 - z1;
      // Three.js Y-rotation maps local +X to (cos θ, 0, -sin θ), so align with atan2(-dz, dx)
      const rotationY = Math.atan2(-dirZ, dirX);

      transforms.push({
        position: new Vector3(midX, 0, midZ),
        rotation: new Euler(0, rotationY, 0),
      });
    }

    return transforms;
  }, [radius, count, isMinimal]);

  // Generate middle poles at the highest points of archways (2 per archway segment)
  const middlePolesPositions = useMemo(() => {
    if (isMinimal) return [] as Vector3[];

    const positions: Vector3[] = [];
    const angleStep = (Math.PI * 2) / count;
    const archHeight = halfHeight ? 1.35 : 3; // Height of the arch peak
    const baseOffset = halfHeight ? 0.75 : 1.75; // Half the base offset for compact version

    for (let i = 0; i < count; i++) {
      const startAngle = i * angleStep;
      const endAngle = ((i + 1) % count) * angleStep;

      // Position 2 poles at the highest middle nodes (very close together at t = 0.45 and t = 0.55)
      for (let poleIndex = 0; poleIndex < 2; poleIndex++) {
        const t = 0.45 + poleIndex * 0.1; // t = 0.45 and t = 0.55 (very close together)
        const angle = startAngle + (endAngle - startAngle) * t;

        // Calculate position along the circle
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Calculate height at this position on the archway (parabolic curve)
        const archProgress = Math.sin(t * Math.PI);
        const y = archProgress * archHeight - baseOffset; // Reduced base offset to lower the poles slightly

        positions.push(new Vector3(x, y, z));
      }
    }

    return positions;
  }, [radius, count, halfHeight, isMinimal]);

  // Stable material instances: R3F instancedMesh only applies `args` materials on first mount,
  // so swapping material refs when campTypes arrives would leave meshes stuck on the old colour.
  const particleMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        alphaTest: 0.1,
      }),
    [],
  );

  const glowMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.435,
        alphaTest: 0.1,
      }),
    [],
  );

  const archwayMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.435,
        alphaTest: 0.1,
      }),
    [],
  );

  const middlePolesMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.435,
        alphaTest: 0.1,
      }),
    [],
  );

  const coneMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.435,
        alphaTest: 0.1,
      }),
    [],
  );

  useLayoutEffect(() => {
    const p = BORDER_PALETTE[borderTheme] ?? BORDER_PALETTE.red;
    particleMaterial.color.setHex(p.particle);
    glowMaterial.color.setHex(p.glow);
    archwayMaterial.color.setHex(p.archway);
    middlePolesMaterial.color.setHex(p.poles);
    coneMaterial.color.setHex(p.poles);
  }, [
    borderTheme,
    particleMaterial,
    glowMaterial,
    archwayMaterial,
    middlePolesMaterial,
    coneMaterial,
  ]);

  // Geometries - support half height
  const particleGeometry = useMemo(() => new PlaneGeometry(0.05, 0.05), []);
  const glowGeometry = useMemo(() => new BoxGeometry(0.0675, halfHeight ? 0.75 : 1.5, 0.0675), [halfHeight]); // 3D pillars visible from all angles
  const coneGeometry = useMemo(
    () => (isMinimal ? null : new ConeGeometry(0.1, halfHeight ? 0.175 : 0.35, 8)),
    [halfHeight, isMinimal],
  );
  const middlePolesGeometry = useMemo(
    () => (isMinimal ? null : new BoxGeometry(0.0625, halfHeight ? 1.175 : 2.35, 0.0625)),
    [halfHeight, isMinimal],
  );
  const archwayGeometry = useMemo(() => {
    if (isMinimal) return null;

    const archHeight = halfHeight ? 2.35 : 2.125;
    const span = 2 * radius * Math.sin(Math.PI / count);
    const halfSpan = span / 2;
    const numPoints = 9;

    const curvePoints: Vector3[] = [];
    for (let k = 0; k <= numPoints; k++) {
      const t = k / numPoints;
      const x = -halfSpan + t * span;
      const y = Math.sin(t * Math.PI) * archHeight;
      curvePoints.push(new Vector3(x, y, 0));
    }

    const curve = new CatmullRomCurve3(curvePoints);
    return new TubeGeometry(curve, 10, 0.055, 4, false);
  }, [radius, count, halfHeight, isMinimal]);

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      particleGeometry.dispose();
      glowGeometry.dispose();
      coneGeometry?.dispose();
      middlePolesGeometry?.dispose();
      archwayGeometry?.dispose();
      particleMaterial.dispose();
      glowMaterial.dispose();
      coneMaterial.dispose();
      archwayMaterial.dispose();
      middlePolesMaterial.dispose();
    };
  }, [particleGeometry, glowGeometry, coneGeometry, middlePolesGeometry, archwayGeometry, particleMaterial, glowMaterial, coneMaterial, archwayMaterial, middlePolesMaterial, halfHeight, isMinimal]);

  // Update instanced matrices
  useEffect(() => {
    const matrix = matrixRef.current;

    // Update particle instances
    if (particleRef.current) {
      particlePositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        particleRef.current?.setMatrixAt(i, matrix);
      });
      particleRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update glow instances
    if (glowRef.current) {
      glowPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        glowRef.current?.setMatrixAt(i, matrix);
      });
      glowRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update cone instances (positioned on top of pillars)
    if (!isMinimal && coneRef.current && coneGeometry) {
      const pillarHeight = halfHeight ? 0.58 : 1.225;
      const halfConeHeight = halfHeight ? 0.0875 : 0.175;
      glowPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y + pillarHeight - halfConeHeight, position.z); // Top of pillar + half cone height
        coneRef.current?.setMatrixAt(i, matrix);
      });
      coneRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update archway instances (one tube arch per gate)
    if (!isMinimal && archwayRef.current && archwayGeometry) {
      gateArchTransforms.forEach((gate, i) => {
        matrix.makeRotationFromEuler(gate.rotation);
        matrix.setPosition(gate.position);
        archwayRef.current?.setMatrixAt(i, matrix);
      });
      archwayRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update middle poles instances
    if (!isMinimal && middlePolesRef.current && middlePolesGeometry) {
      middlePolesPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        middlePolesRef.current?.setMatrixAt(i, matrix);
      });
      middlePolesRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [particlePositions, glowPositions, gateArchTransforms, middlePolesPositions, count, halfHeight, isMinimal, coneGeometry, archwayGeometry, middlePolesGeometry]);

  // Animate particles
  useFrame((state) => {
    if (!groupRef.current) return;

    const time = state.clock.getElapsedTime();

    // Gentle rotation (compact variant can reverse)
    const rotationDirection = reverseRotation ? -1 : 1;
    groupRef.current.rotation.y = time * 0.03 * rotationDirection;

    // Update particle positions for floating animation
    if (particleRef.current) {
      const matrix = matrixRef.current;
      particlePositions.forEach((position, i) => {
        const floatOffset = Math.sin(time * 2 + i * 0.1) * 0.2;
        matrix.makeTranslation(
          position.x,
          position.y + floatOffset,
          position.z
        );
        particleRef.current?.setMatrixAt(i, matrix);
      });
      particleRef.current.instanceMatrix.needsUpdate = true;
    }
  });

  if (!enableParticles) return null;

  return (
    <group ref={groupRef} name="simple-border-effects">
      {/* Floating particles */}
      <instancedMesh
        ref={particleRef}
        args={[particleGeometry, particleMaterial, particleCount]}
        frustumCulled={false}
      />

      {/* 3D pillar effects */}
      <instancedMesh
        ref={glowRef}
        args={[glowGeometry, glowMaterial, count]}
        frustumCulled={false}
      />

      {!isMinimal && coneGeometry && (
        <>
          {/* Cone caps on top of pillars */}
          <instancedMesh
            ref={coneRef}
            args={[coneGeometry, coneMaterial, count]}
            frustumCulled={false}
          />

          {/* Middle poles at highest archway points */}
          <instancedMesh
            ref={middlePolesRef}
            args={[middlePolesGeometry!, middlePolesMaterial, middlePolesPositions.length]}
            frustumCulled={false}
          />

          {/* Curved archway rails */}
          <instancedMesh position={[0, 0.375, 0]}
            ref={archwayRef}
            args={[archwayGeometry!, archwayMaterial, count]}
            frustumCulled={false}
          />
        </>
      )}
    </group>
  );
};

/** Compact half-height ring; inherits `borderTheme` from props (defaults to red) */
export const CompactPurpleBorderEffects: React.FC<SimpleBorderEffectsProps> = (props) => {
  return <SimpleBorderEffectsInner
    {...props}
    halfHeight={true}
    reverseRotation={true}
  />;
};

export default SimpleBorderEffects;