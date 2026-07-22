import { useCallback, useImperativeHandle, forwardRef, useRef, useState } from 'react';
import { Vector3 } from '@/utils/three-exports';
import IncinerationBeam from '@/components/weapons/IncinerationBeam';
import { CombatSystem } from '@/systems/CombatSystem';
import { Enemy } from '@/ecs/components/Enemy';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import type { World } from '@/ecs/World';
import type { Entity } from '@/ecs/Entity';
import {
  INCINERATION_BEAM_MAX_HALF_WIDTH,
  INCINERATION_BEAM_MIN_HALF_WIDTH,
  INCINERATION_BEAM_RANGE,
  INCINERATION_PLASMA_BOLT_LATERAL_OFFSET,
  INCINERATION_PLASMA_SIDE_BOLT_HALF_WIDTH,
  INCINERATION_PLASMA_SIDE_BOLT_RANGE,
  computeIncinerationDamage,
} from '@/utils/talents';
import { isCoopPlayerAllyEntity } from '@/utils/coopAllyTargeting';

export interface IncinerationDetonatePayload {
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  charge: number;
  isPlasma?: boolean;
  shieldDrained?: number;
}

export interface IncinerationBeamManagerHandle {
  detonate: (payload: IncinerationDetonatePayload) => void;
  spawnVfxOnly: (payload: IncinerationDetonatePayload) => void;
}

interface IncinerationBeamManagerProps {
  world: World;
  sourcePlayerId?: string;
  sourceEntity?: Entity;
}

const enemyPos2D = new Vector3();
const segmentDir = new Vector3();
const projectedPoint = new Vector3();

function getBeamHalfWidth(charge: number): number {
  const t = Math.min(1, Math.max(0, charge / 100));
  return (
    INCINERATION_BEAM_MIN_HALF_WIDTH +
    t * (INCINERATION_BEAM_MAX_HALF_WIDTH - INCINERATION_BEAM_MIN_HALF_WIDTH)
  );
}

function hitTestLineSegment(
  world: World,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  halfWidth: number,
): Entity[] {
  const hits: Entity[] = [];
  const abx = bx - ax;
  const abz = bz - az;
  const abLen2 = abx * abx + abz * abz;
  const hw2 = halfWidth * halfWidth;

  for (const entity of world.queryEntities([Enemy, Transform, Health])) {
    const enemy = entity.getComponent(Enemy);
    const transform = entity.getComponent(Transform);
    const health = entity.getComponent(Health);
    if (!enemy || !transform || !health || health.isDead || enemy.isDead) continue;
    if (isCoopPlayerAllyEntity(entity)) continue;

    const px = transform.position.x;
    const pz = transform.position.z;
    const apx = px - ax;
    const apz = pz - az;

    let t = abLen2 > 1e-8 ? (apx * abx + apz * abz) / abLen2 : 0;
    t = Math.max(0, Math.min(1, t));

    projectedPoint.set(ax + t * abx, 0, az + t * abz);
    enemyPos2D.set(px, 0, pz);
    const dx = enemyPos2D.x - projectedPoint.x;
    const dz = enemyPos2D.z - projectedPoint.z;
    if (dx * dx + dz * dz <= hw2) {
      hits.push(entity);
    }
  }

  return hits;
}

function hitTestIncinerationBeam(
  world: World,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  charge: number,
): Entity[] {
  segmentDir.set(direction.x, 0, direction.z);
  if (segmentDir.lengthSq() < 1e-8) return [];
  segmentDir.normalize();

  const halfWidth = getBeamHalfWidth(charge);
  const bx = origin.x + segmentDir.x * INCINERATION_BEAM_RANGE;
  const bz = origin.z + segmentDir.z * INCINERATION_BEAM_RANGE;

  return hitTestLineSegment(world, origin.x, origin.z, bx, bz, halfWidth);
}

function hitTestPlasmaForwardBolts(
  world: World,
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
): Entity[] {
  segmentDir.set(direction.x, 0, direction.z);
  if (segmentDir.lengthSq() < 1e-8) return [];
  segmentDir.normalize();

  const perpX = -segmentDir.z;
  const perpZ = segmentDir.x;
  const range = INCINERATION_PLASMA_SIDE_BOLT_RANGE;
  const halfWidth = INCINERATION_PLASMA_SIDE_BOLT_HALF_WIDTH;
  const lateral = INCINERATION_PLASMA_BOLT_LATERAL_OFFSET;
  const converge = lateral * 0.25;

  const leftAx = origin.x + perpX * lateral;
  const leftAz = origin.z + perpZ * lateral;
  const leftBx = origin.x + segmentDir.x * range + perpX * converge;
  const leftBz = origin.z + segmentDir.z * range + perpZ * converge;

  const rightAx = origin.x - perpX * lateral;
  const rightAz = origin.z - perpZ * lateral;
  const rightBx = origin.x + segmentDir.x * range - perpX * converge;
  const rightBz = origin.z + segmentDir.z * range - perpZ * converge;

  const leftHits = hitTestLineSegment(world, leftAx, leftAz, leftBx, leftBz, halfWidth);
  const rightHits = hitTestLineSegment(world, rightAx, rightAz, rightBx, rightBz, halfWidth);

  return [...leftHits, ...rightHits];
}

const IncinerationBeamManager = forwardRef<IncinerationBeamManagerHandle, IncinerationBeamManagerProps>(
  ({ world, sourcePlayerId, sourceEntity }, ref) => {
    const nextBeamIdRef = useRef(0);
    const [activeBeams, setActiveBeams] = useState<
      Array<{ id: number; payload: IncinerationDetonatePayload }>
    >([]);

    const removeBeam = useCallback((id: number) => {
      setActiveBeams((prev) => prev.filter((b) => b.id !== id));
    }, []);

    const spawnVfxOnly = useCallback((payload: IncinerationDetonatePayload) => {
      const charge = Math.max(0, payload.charge);
      if (charge <= 0) return;
      const id = nextBeamIdRef.current++;
      setActiveBeams((prev) => [...prev, { id, payload: { ...payload, charge } }]);
    }, []);

    const detonate = useCallback(
      (payload: IncinerationDetonatePayload) => {
        const charge = Math.max(0, payload.charge);
        if (charge <= 0) return;

        spawnVfxOnly(payload);

        const combatSystem = world.getSystem(CombatSystem) as CombatSystem | undefined;
        if (!combatSystem) return;

        const damage = computeIncinerationDamage(charge, payload.shieldDrained ?? 0);
        const hitSet = new Set<Entity>();

        for (const entity of hitTestIncinerationBeam(world, payload.origin, payload.direction, charge)) {
          hitSet.add(entity);
        }
        if (payload.isPlasma) {
          for (const entity of hitTestPlasmaForwardBolts(world, payload.origin, payload.direction)) {
            hitSet.add(entity);
          }
        }

        hitSet.forEach((entity) => {
          combatSystem.queueDamage(
            entity,
            damage,
            sourceEntity,
            'incineration',
            sourcePlayerId,
          );
        });
      },
      [sourceEntity, sourcePlayerId, spawnVfxOnly, world],
    );

    useImperativeHandle(ref, () => ({ detonate, spawnVfxOnly }), [detonate, spawnVfxOnly]);

    return (
      <>
        {activeBeams.map(({ id, payload }) => (
          <IncinerationBeam
            key={id}
            origin={payload.origin}
            direction={payload.direction}
            charge={payload.charge}
            isPlasma={payload.isPlasma}
            onComplete={() => removeBeam(id)}
          />
        ))}
      </>
    );
  },
);

IncinerationBeamManager.displayName = 'IncinerationBeamManager';

export default IncinerationBeamManager;
