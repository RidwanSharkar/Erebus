import { useState, useCallback, useEffect } from 'react';
import { Vector3 } from 'three';
import { WeaponSubclass } from '@/components/dragon/weapons';

export interface BowPowershotEffect {
  id: number;
  position: Vector3;
  direction: Vector3;
  subclass: WeaponSubclass;
  isElementalShotsUnlocked: boolean;
  isPerfectShot: boolean;
  /** Arctic Sting room boon — deep blue perfect-shot beam. */
  arcticStingTheme?: boolean;
  /** HIGH CALIBER — thicker perfect-shot beam mesh. */
  highCaliberPerfectBeam?: boolean;
  startTime: number;
}

type PowershotSubscriber = (effects: BowPowershotEffect[]) => void;

let globalActiveEffects: BowPowershotEffect[] = [];
let globalNextEffectId = 1;
const subscribers = new Set<PowershotSubscriber>();

const notifySubscribers = (): void => {
  for (const subscriber of subscribers) {
    subscriber(globalActiveEffects);
  }
};

export const createGlobalPowershotEffect = (
  position: Vector3,
  direction: Vector3,
  subclass: WeaponSubclass,
  isPerfectShot: boolean = false,
  isElementalShotsUnlocked: boolean = true,
  arcticStingTheme: boolean = false,
  highCaliberPerfectBeam: boolean = false,
): number => {
  const effectId = globalNextEffectId++;
  
  const newEffect: BowPowershotEffect = {
    id: effectId,
    position: position.clone(),
    direction: direction.clone().normalize(),
    subclass,
    isElementalShotsUnlocked,
    isPerfectShot,
    arcticStingTheme: arcticStingTheme && isPerfectShot,
    highCaliberPerfectBeam: highCaliberPerfectBeam && isPerfectShot,
    startTime: Date.now(),
  };

  globalActiveEffects = [...globalActiveEffects, newEffect];
  notifySubscribers();
  
  return effectId;
};

export const removeGlobalPowershotEffect = (effectId: number): void => {
  globalActiveEffects = globalActiveEffects.filter(effect => effect.id !== effectId);
  notifySubscribers();
};

export const clearGlobalPowershotEffects = (): void => {
  if (globalActiveEffects.length === 0) return;
  globalActiveEffects = [];
  notifySubscribers();
};

export const useBowPowershot = () => {
  const [activeEffects, setActiveEffects] = useState<BowPowershotEffect[]>(globalActiveEffects);

  useEffect(() => {
    subscribers.add(setActiveEffects);
    setActiveEffects(globalActiveEffects);
    return () => {
      subscribers.delete(setActiveEffects);
    };
  }, []);

  const createPowershotEffect = useCallback((
    position: Vector3,
    direction: Vector3,
    subclass: WeaponSubclass,
    isPerfectShot: boolean = false,
    isElementalShotsUnlocked: boolean = true,
    arcticStingTheme: boolean = false,
    highCaliberPerfectBeam: boolean = false,
  ) => {
    return createGlobalPowershotEffect(
      position,
      direction,
      subclass,
      isPerfectShot,
      isElementalShotsUnlocked,
      arcticStingTheme,
      highCaliberPerfectBeam,
    );
  }, []);

  const removeEffect = useCallback((effectId: number) => {
    removeGlobalPowershotEffect(effectId);
  }, []);

  const clearAllEffects = useCallback(() => {
    clearGlobalPowershotEffects();
  }, []);

  return {
    activeEffects,
    createPowershotEffect,
    removeEffect,
    clearAllEffects
  };
};
