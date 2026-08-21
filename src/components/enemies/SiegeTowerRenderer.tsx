'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, Mesh, Vector3 } from 'three';
import { useMultiplayerActions } from '@/contexts/MultiplayerContext';
import { campHpTheme } from '@/utils/campHpTheme';
import { ExploreBuildingHpBillboard, syncExploreBuildingHpIfVisible } from './ExploreBuildingHpBillboard';
import { syncEnemyRotationFromRef } from '@/utils/enemyLiveTransform';
import { subscribeExploreTowerAttack } from '@/utils/exploreTowerAttackBus';
import { DEFENSE_TOWER_IMPACT_Y } from '@/utils/defenseLayout';
import SiegeTower, {
  SIEGE_TOWER_ARROW_SPEED,
  SIEGE_TOWER_HP_BAR_Y,
  SIEGE_TOWER_MUZZLE_Y,
} from '@/components/environment/SiegeTower';
import ViperArrowProjectile from './ViperArrowProjectile';
import SiegeTowerBeam from './SiegeTowerBeam';
import type { Position3 } from '@/utils/position3';

interface SiegeTowerRendererProps {
  id: string;
  position: Position3;
  rotation: number;
  health: number;
  maxHealth: number;
  isDying?: boolean;
  powered?: boolean;
}

type SiegeTowerArrowShot = {
  seq: number;
  from: Vector3;
  to: Vector3;
  damage: number;
  maxRange: number;
  dir: Vector3;
};

const FADE_DURATION = 1.4;
const TOWER_TRAIL_LENGTH = 36;

function SiegeTowerRenderer({
  id,
  position,
  rotation,
  health,
  maxHealth,
  isDying = false,
  powered = true,
}: SiegeTowerRendererProps) {
  const theme = campHpTheme('ally-green');
  const { enemiesRef, enemyTransformsRef } = useMultiplayerActions();
  const groupRef = useRef<Group | null>(null);
  const hpFillRef = useRef<Mesh>(null);
  const hpTextRef = useRef<any>(null);
  const hpBarVisibleRef = useRef(false);
  const opacity = useRef(1);
  const fadeTimer = useRef(0);
  const targetRotation = useRef(rotation);
  const seqRef = useRef(0);
  const [arrowShot, setArrowShot] = useState<SiegeTowerArrowShot | null>(null);
  const [beamShot, setBeamShot] = useState<SiegeTowerArrowShot | null>(null);

  const setGroupRef = useCallback((group: Group | null) => {
    groupRef.current = group;
    if (group) {
      group.position.set(position.x, position.y, position.z);
      group.rotation.y = targetRotation.current;
    }
  }, [position.x, position.y, position.z]);

  useEffect(() => {
    targetRotation.current = rotation;
    if (!groupRef.current) return;
    groupRef.current.position.set(position.x, position.y, position.z);
    groupRef.current.rotation.y = rotation;
  }, [position.x, position.y, position.z, rotation]);

  useEffect(() => {
    return subscribeExploreTowerAttack(id, (data) => {
      if (!powered) return;
      if (data.kind !== 'arrow') return;
      const origin = data.origin;
      const impact = data.impact;
      if (!origin || !impact) return;
      const from = new Vector3(origin.x, origin.y ?? SIEGE_TOWER_MUZZLE_Y, origin.z);
      const to = new Vector3(impact.x, impact.y ?? DEFENSE_TOWER_IMPACT_Y, impact.z);
      const seq = ++seqRef.current;
      const dir = new Vector3().subVectors(to, from);
      if (dir.lengthSq() < 1e-8) dir.set(0, 0, -1);
      else dir.normalize();
      const shot: SiegeTowerArrowShot = {
        seq,
        from,
        to,
        damage: data.damage ?? 198,
        maxRange: Math.max(0.5, from.distanceTo(to)),
        dir,
      };
      setArrowShot(shot);
      setBeamShot(shot);
    });
  }, [id, powered]);

  useFrame((_, delta) => {
    if (enemyTransformsRef) {
      syncEnemyRotationFromRef(id, enemyTransformsRef, targetRotation);
    }
    const g = groupRef.current;
    if (g && g.rotation.y !== targetRotation.current) {
      g.rotation.y = targetRotation.current;
    }
    syncExploreBuildingHpIfVisible(
      hpBarVisibleRef, hpFillRef, hpTextRef, enemiesRef, id, health, maxHealth,
    );
    if (isDying) {
      fadeTimer.current += delta;
      opacity.current = Math.max(0, 1 - fadeTimer.current / FADE_DURATION);
      if (groupRef.current) groupRef.current.visible = opacity.current > 0.02;
    }
  });

  return (
    <>
      {arrowShot && (
        <ViperArrowProjectile
          startPosition={arrowShot.from}
          targetPosition={arrowShot.to}
          damage={arrowShot.damage}
          maxRange={arrowShot.maxRange}
          speed={SIEGE_TOWER_ARROW_SPEED}
          getPlayerPosition={() => null}
          onHitPlayer={() => {}}
          onComplete={() => setArrowShot(null)}
          active
          enableLight={false}
          trailLength={TOWER_TRAIL_LENGTH}
          shotSeq={arrowShot.seq}
        />
      )}
      {beamShot && (
        <SiegeTowerBeam
          active
          position={beamShot.from}
          direction={beamShot.dir}
          beamLength={beamShot.maxRange}
          onComplete={() => setBeamShot(null)}
        />
      )}
      <group ref={setGroupRef} visible={!isDying || opacity.current > 0.02}>
        <SiegeTower />
        {!powered && !isDying && (
          <mesh position={[0, 3.2, 0]}>
            <cylinderGeometry args={[1.55, 1.75, 6.4, 10]} />
            <meshBasicMaterial color="#0b1220" transparent opacity={0.38} depthWrite={false} />
          </mesh>
        )}
        <ExploreBuildingHpBillboard
          y={SIEGE_TOWER_HP_BAR_Y}
          health={health}
          maxHealth={maxHealth}
          fillRef={hpFillRef}
          numericRef={hpTextRef}
          backgroundColor={theme.background}
          fillColor={theme.fill}
          textColor={theme.text}
          fontSize={0.16}
          hidden={isDying}
          barVisibleRef={hpBarVisibleRef}
        />
      </group>
    </>
  );
}

export default React.memo(SiegeTowerRenderer);
