import { Vector3 } from '@/utils/three-exports';
import type { WeaponAspect } from '@/utils/weaponAspects';
import type { MeleeWeightClass } from '@/components/enemies/EnemyMeleeAttackRangeRing';

export interface ImpactEffectEvent {
  id: string;
  type: 'bow-shot-impact' | 'entropic-bolt-impact' | 'sabre-impact-effect' | 'crescent-slash-effect' | 'mortal-strike-effect' | 'wraith-strike-effect' | 'psionic-blade-slice' | 'melee-contact-gash';
  position: Vector3;
  /** Normalized projectile velocity direction at point of impact. */
  direction: Vector3;
  timestamp: number;
  /** Entropic bolt color variant for themed explosion VFX. */
  colorVariant?: string;
  /** Cryoflame entropic bolt — icy blue impact palette. */
  isCryoflame?: boolean;
  /** ECS entity id — effect follows this enemy each frame. */
  enemyEntityId?: string;
  bladeSide?: 'left' | 'right';
  /** Sabres aspect — Crescent Blades slash palette. */
  weaponAspect?: WeaponAspect;
  /** Incoming melee weight class — drives MeleeContactGash silhouette. */
  weightClass?: MeleeWeightClass;
}

export type AddImpactOptions = {
  colorVariant?: string;
  isCryoflame?: boolean;
  enemyEntityId?: string;
  bladeSide?: 'left' | 'right';
  weaponAspect?: WeaponAspect;
  weightClass?: MeleeWeightClass;
};

export class ImpactEffectManager {
  private impacts: ImpactEffectEvent[] = [];
  private nextId = 0;

  public addImpact(
    type: ImpactEffectEvent['type'],
    position: Vector3,
    direction: Vector3,
    options?: AddImpactOptions,
  ): void {
    this.impacts.push({
      id: `impact_${this.nextId++}`,
      type,
      position: position.clone(),
      direction: direction.clone(),
      timestamp: Date.now(),
      ...(options?.colorVariant ? { colorVariant: options.colorVariant } : {}),
      ...(options?.isCryoflame ? { isCryoflame: options.isCryoflame } : {}),
      ...(options?.enemyEntityId ? { enemyEntityId: options.enemyEntityId } : {}),
      ...(options?.bladeSide ? { bladeSide: options.bladeSide } : {}),
      ...(options?.weaponAspect ? { weaponAspect: options.weaponAspect } : {}),
      ...(options?.weightClass ? { weightClass: options.weightClass } : {}),
    });
  }

  public getImpacts(): ImpactEffectEvent[] {
    return [...this.impacts];
  }

  public clearConsumed(): void {
    this.impacts.length = 0;
  }

  public clear(): void {
    this.impacts.length = 0;
    this.nextId = 0;
  }
}
