'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import type { Enemy, Player } from '@/contexts/MultiplayerContext';
import GreaterHealBeamEffect from '@/components/enemies/GreaterHealBeamEffect';
import { KnightFrostImpact } from '@/components/enemies/KnightFrostProjectile';
import type {
  GreaterHealBeamState,
  KnightFrostImpactState,
} from '@/components/coop/coopVfxLayerTypes';

export type CoopAllyCombatLayerHandle = {
  clearAll: () => void;
  addGreaterHealBeam: (fx: GreaterHealBeamState) => void;
  addKnightFrostImpact: (fx: KnightFrostImpactState) => void;
};

type CoopAllyCombatLayerProps = {
  enemiesRef: React.MutableRefObject<Map<string, Enemy>>;
  playersRef: React.MutableRefObject<Map<string, Player>>;
  socketId?: string;
  localPlayerWorldPosRef: React.MutableRefObject<Vector3>;
  enemyPlayerPositionRefs: React.MutableRefObject<Map<string, { current: Vector3 }>>;
};

const CoopAllyCombatLayer = memo(forwardRef<CoopAllyCombatLayerHandle, CoopAllyCombatLayerProps>(
  function CoopAllyCombatLayer({
    enemiesRef,
    playersRef,
    socketId,
    localPlayerWorldPosRef,
    enemyPlayerPositionRefs,
  }, ref) {
    const [greaterHealBeams, setGreaterHealBeams] = useState<GreaterHealBeamState[]>([]);
    const [knightFrostImpacts, setKnightFrostImpacts] = useState<KnightFrostImpactState[]>([]);

    const clearAll = useCallback(() => {
      setGreaterHealBeams([]);
      setKnightFrostImpacts([]);
    }, []);

    const addGreaterHealBeam = useCallback((fx: GreaterHealBeamState) => {
      setGreaterHealBeams((prev) => [...prev, fx]);
    }, []);

    const addKnightFrostImpact = useCallback((fx: KnightFrostImpactState) => {
      setKnightFrostImpacts((prev) => [...prev, fx]);
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      addGreaterHealBeam,
      addKnightFrostImpact,
    }), [
      clearAll,
      addGreaterHealBeam,
      addKnightFrostImpact,
    ]);

    return (
      <>
        {greaterHealBeams.map(fx => (
          <GreaterHealBeamEffect
            key={fx.id}
            position={fx.position}
            targetKind={fx.targetKind}
            targetId={fx.targetId}
            enemiesRef={enemiesRef}
            playersRef={playersRef}
            socketId={socketId}
            localPlayerWorldPosRef={localPlayerWorldPosRef}
            enemyPlayerPositionRefs={enemyPlayerPositionRefs}
            onComplete={() => setGreaterHealBeams(prev => prev.filter(e => e.id !== fx.id))}
          />
        ))}

        {knightFrostImpacts.map(fx => (
          <KnightFrostImpact
            key={fx.id}
            position={fx.position}
            onComplete={() => setKnightFrostImpacts(prev => prev.filter(e => e.id !== fx.id))}
          />
        ))}
      </>
    );
  },
));

CoopAllyCombatLayer.displayName = 'CoopAllyCombatLayer';

export default CoopAllyCombatLayer;
