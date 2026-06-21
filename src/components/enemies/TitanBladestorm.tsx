'use client';

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group } from '@/utils/three-exports';
import { calculationCache } from '@/utils/CalculationCache';
import {
  TITAN_BLADESTORM_ORBIT_RADIUS,
  TITAN_BLADESTORM_ORBIT_HEIGHT,
  TITAN_BLADESTORM_SPIN_SPEED,
} from '@/utils/cycloneSpinConstants';
import SwordMeshVisual, { getSwordThemeForSoulType } from '@/components/weapons/SwordMeshVisual';

type SoulType = 'green' | 'red' | 'blue' | 'purple';

interface TitanBladestormProps {
  soulType: SoulType;
  startTime: number;
}

export default function TitanBladestorm({ soulType, startTime }: TitanBladestormProps) {
  const orbitRef = useRef<Group>(null);
  const theme = useMemo(() => getSwordThemeForSoulType(soulType), [soulType]);

  useFrame(() => {
    if (!orbitRef.current) return;

    const elapsedSec = (Date.now() - startTime) / 1000;
    const angle = elapsedSec * TITAN_BLADESTORM_SPIN_SPEED;

    const orbitalX = calculationCache.getTrigCalculation('cos', angle) * TITAN_BLADESTORM_ORBIT_RADIUS;
    const orbitalZ = calculationCache.getTrigCalculation('sin', angle) * TITAN_BLADESTORM_ORBIT_RADIUS;

    orbitRef.current.position.set(orbitalX, TITAN_BLADESTORM_ORBIT_HEIGHT, orbitalZ);
    orbitRef.current.rotation.set(Math.PI / 4, angle + Math.PI / 2, 0);
  });

  return (
    <group ref={orbitRef}>
      <SwordMeshVisual theme={theme} />
    </group>
  );
}
