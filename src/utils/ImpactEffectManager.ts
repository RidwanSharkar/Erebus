import { Vector3 } from '@/utils/three-exports';

export interface ImpactEffectEvent {
  id: string;
  type: 'bow-shot-impact' | 'entropic-bolt-impact' | 'sabre-impact-effect' | 'crescent-slash-effect';
  position: Vector3;
  /** Normalized projectile velocity direction at point of impact. */
  direction: Vector3;
  timestamp: number;
  /** Entropic bolt color variant for themed explosion VFX. */
  colorVariant?: string;
}

export class ImpactEffectManager {
  private impacts: ImpactEffectEvent[] = [];
  private nextId = 0;

  public addImpact(
    type: ImpactEffectEvent['type'],
    position: Vector3,
    direction: Vector3,
    colorVariant?: string,
  ): void {
    this.impacts.push({
      id: `impact_${this.nextId++}`,
      type,
      position: position.clone(),
      direction: direction.clone(),
      timestamp: Date.now(),
      ...(colorVariant ? { colorVariant } : {}),
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
