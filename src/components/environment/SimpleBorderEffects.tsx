import React, { useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  MeshBasicMaterial,
  PlaneGeometry,
  CircleGeometry,
  BoxGeometry,
  ConeGeometry,
  OctahedronGeometry,
  Matrix4,
  Vector3,
  Group,
  Euler,
  Quaternion
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
    particle: 0x8a2be2,
    glow: 0xdda0dd,
    archway: 0x8a2be2,
    poles: 0xdda0dd,
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
  count = 64,
  enableParticles = true,
  particleCount = 100,
  borderTheme = 'red',
  halfHeight = false,
  reverseRotation = false,
}) => {
  const particleRef = useRef<InstancedMesh>(null);
  const glowRef = useRef<InstancedMesh>(null);
  const coneRef = useRef<InstancedMesh>(null);
  const archwayRef = useRef<InstancedMesh>(null);
  const middlePolesRef = useRef<InstancedMesh>(null);
  const groupRef = useRef<Group>(null);

  // CRITICAL: Cache Matrix4 to prevent memory leak from creating new ones every frame
  const matrixRef = useRef<Matrix4>(new Matrix4());
  const quaternionRef = useRef<Quaternion>(new Quaternion());

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

  // Generate archway segments between poles
  const archwayData = useMemo(() => {
    const segments: { position: Vector3; rotation: Euler }[] = [];
    const angleStep = (Math.PI * 2) / count;
    const segmentsPerArch = 12; // Number of segments per archway
    const archHeight = halfHeight ? 1.35 : 2.125; // Half height for compact version

    for (let i = 0; i < count; i++) {
      const startAngle = i * angleStep;
      const endAngle = ((i + 1) % count) * angleStep;

      // Calculate arch parameters
      const archRadius = radius;

      for (let j = 0; j < segmentsPerArch; j++) {
        // Create segments that connect between points
        const t1 = j / segmentsPerArch;
        const t2 = (j + 1) / segmentsPerArch;

        // Calculate positions for start and end of this segment
        const angle1 = startAngle + (endAngle - startAngle) * t1;
        const angle2 = startAngle + (endAngle - startAngle) * t2;

        // Calculate base positions along the circle
        const x1 = Math.cos(angle1) * archRadius;
        const z1 = Math.sin(angle1) * archRadius;
        const x2 = Math.cos(angle2) * archRadius;
        const z2 = Math.sin(angle2) * archRadius;

        // Create parabolic arch heights
        const archProgress1 = Math.sin(t1 * Math.PI);
        const archProgress2 = Math.sin(t2 * Math.PI);
        const y1 = archProgress1 * archHeight;
        const y2 = archProgress2 * archHeight;

        // Position segment at the midpoint angle along the circle (not the straight-line midpoint)
        const midAngle = (angle1 + angle2) / 2;
        const midX = Math.cos(midAngle) * archRadius;
        const midZ = Math.sin(midAngle) * archRadius;
        const midT = (t1 + t2) / 2;
        const midArchProgress = Math.sin(midT * Math.PI);
        const midY = midArchProgress * archHeight;

        // Calculate direction vector for rotation
        const dirX = x2 - x1;
        const dirZ = z2 - z1;
        const segmentAngle = Math.atan2(dirZ, dirX);

        // Calculate rotation to align with the curve direction
        const rotation = new Euler(0, segmentAngle, 0);

        segments.push({
          position: new Vector3(midX, midY, midZ),
          rotation: rotation
        });
      }
    }

    return segments;
  }, [radius, count]);

  // Generate middle poles at the highest points of archways (2 per archway segment)
  const middlePolesPositions = useMemo(() => {
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
  }, [radius, count, halfHeight]);

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
  const coneGeometry = useMemo(() => new ConeGeometry(0.1, halfHeight ? 0.175 : 0.35, 8), [halfHeight]); // Small cone on top of pillars
  const middlePolesGeometry = useMemo(() => new BoxGeometry(0.0625, halfHeight ? 1.175 : 2.35, 0.0625), [halfHeight]); // Taller poles for middle positions
  const archwayGeometry = useMemo(() => new OctahedronGeometry(0.075, 0), []); // Diamond-shaped segments for archways

  // Cleanup geometries and materials on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      particleGeometry.dispose();
      glowGeometry.dispose();
      coneGeometry.dispose();
      middlePolesGeometry.dispose();
      archwayGeometry.dispose();
      particleMaterial.dispose();
      glowMaterial.dispose();
      coneMaterial.dispose();
      archwayMaterial.dispose();
      middlePolesMaterial.dispose();
    };
  }, [particleGeometry, glowGeometry, coneGeometry, middlePolesGeometry, archwayGeometry, particleMaterial, glowMaterial, coneMaterial, archwayMaterial, middlePolesMaterial, halfHeight]);

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
    if (coneRef.current) {
      const pillarHeight = halfHeight ? 0.58 : 1.125;
      const halfConeHeight = halfHeight ? 0.0875 : 0.175;
      glowPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y + pillarHeight - halfConeHeight, position.z); // Top of pillar + half cone height
        coneRef.current?.setMatrixAt(i, matrix);
      });
      coneRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update archway instances
    if (archwayRef.current) {
      archwayData.forEach((segment, i) => {
        matrix.makeRotationFromEuler(segment.rotation);
        matrix.setPosition(segment.position);
        archwayRef.current?.setMatrixAt(i, matrix);
      });
      archwayRef.current.instanceMatrix.needsUpdate = true;
    }

    // Update middle poles instances
    if (middlePolesRef.current) {
      middlePolesPositions.forEach((position, i) => {
        matrix.makeTranslation(position.x, position.y, position.z);
        middlePolesRef.current?.setMatrixAt(i, matrix);
      });
      middlePolesRef.current.instanceMatrix.needsUpdate = true;
    }
  }, [particlePositions, glowPositions, archwayData, middlePolesPositions, count, halfHeight]);

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

      {/* Cone caps on top of pillars */}
      <instancedMesh
        ref={coneRef}
        args={[coneGeometry, coneMaterial, count]}
        frustumCulled={false}
      />

      {/* Middle poles at highest archway points */}
      <instancedMesh
        ref={middlePolesRef}
        args={[middlePolesGeometry, middlePolesMaterial, middlePolesPositions.length]}
        frustumCulled={false}
      />

      {/* Curved archway segments */}
      <instancedMesh
        ref={archwayRef}
        args={[archwayGeometry, archwayMaterial, archwayData.length]}
        frustumCulled={false}
      />
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