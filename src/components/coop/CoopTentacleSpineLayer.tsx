'use client';

import React, { forwardRef, memo, useCallback, useImperativeHandle, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import TentacleSpineRenderer from '@/components/enemies/TentacleSpineRenderer';
import type { TentacleSpineFxState } from '@/components/coop/coopVfxLayerTypes';

export type CoopTentacleSpineLayerHandle = {
  clearAll: () => void;
  updateFx: (enemyId: string, fx: TentacleSpineFxState) => void;
  removeFx: (enemyId: string) => void;
};

export type TentacleSpineEnemyRenderState = {
  id: string;
  position: { x: number; y: number; z: number };
  rotation?: number;
  isDying?: boolean;
};

type CoopTentacleSpineLayerProps = {
  enemies: TentacleSpineEnemyRenderState[];
  isCoopEnemyVisibleForRender: (x: number, z: number) => boolean;
};

const CoopTentacleSpineLayer = memo(forwardRef<CoopTentacleSpineLayerHandle, CoopTentacleSpineLayerProps>(
  function CoopTentacleSpineLayer({ enemies, isCoopEnemyVisibleForRender }, ref) {
    const [tentacleSpineFxById, setTentacleSpineFxById] = useState<
      Map<string, TentacleSpineFxState>
    >(() => new Map());

    const clearAll = useCallback(() => {
      setTentacleSpineFxById(new Map());
    }, []);

    const updateFx = useCallback((enemyId: string, fx: TentacleSpineFxState) => {
      setTentacleSpineFxById((prev) => {
        const next = new Map(prev);
        next.set(enemyId, fx);
        return next;
      });
    }, []);

    const removeFx = useCallback((enemyId: string) => {
      setTentacleSpineFxById((prev) => {
        if (!prev.has(enemyId)) return prev;
        const next = new Map(prev);
        next.delete(enemyId);
        return next;
      });
    }, []);

    useImperativeHandle(ref, () => ({
      clearAll,
      updateFx,
      removeFx,
    }), [clearAll, updateFx, removeFx]);

    return (
      <>
        {enemies.map((enemy) => {
          if (!isCoopEnemyVisibleForRender(enemy.position.x, enemy.position.z)) return null;
          const fx = tentacleSpineFxById.get(enemy.id);
          return (
            <TentacleSpineRenderer
              key={enemy.id}
              id={enemy.id}
              position={new Vector3(enemy.position.x, enemy.position.y, enemy.position.z)}
              rotation={enemy.rotation || 0}
              isDying={!!enemy.isDying}
              windSeq={fx?.windSeq ?? 0}
              slamSeq={fx?.slamSeq ?? 0}
              windDirXZ={fx?.dir ?? { x: 0, z: 1 }}
            />
          );
        })}
      </>
    );
  },
));

CoopTentacleSpineLayer.displayName = 'CoopTentacleSpineLayer';

export default CoopTentacleSpineLayer;
