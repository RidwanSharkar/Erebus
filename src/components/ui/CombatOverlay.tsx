'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from '@/utils/three-exports';
import DamageNumbers, { type DamageNumberData } from '@/components/DamageNumbers';
import StrikeIndicator from '@/components/ui/StrikeIndicator';

export type CombatOverlayCallbacks = {
  onCameraUpdate: (camera: Camera, size: { width: number; height: number }) => void;
  onDamageNumbersUpdate: (damageNumbers: DamageNumberData[]) => void;
  onDamageNumberComplete: (id: string) => void;
};

type CombatOverlayProps = {
  callbacksRef: React.MutableRefObject<CombatOverlayCallbacks>;
};

function damageNumbersEqual(a: DamageNumberData[], b: DamageNumberData[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const prev = a[i];
    const next = b[i];
    if (
      prev.id !== next.id ||
      prev.damage !== next.damage ||
      prev.isCritical !== next.isCritical ||
      prev.damageType !== next.damageType ||
      prev.isIncomingDamage !== next.isIncomingDamage ||
      prev.dualCoilSlot !== next.dualCoilSlot ||
      prev.displayText !== next.displayText ||
      prev.durationHint !== next.durationHint ||
      prev.timestamp !== next.timestamp
    ) {
      return false;
    }
  }
  return true;
}

export default function CombatOverlay({ callbacksRef }: CombatOverlayProps) {
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [cameraInfo, setCameraInfo] = useState<{
    camera: Camera | null;
    size: { width: number; height: number };
  }>({
    camera: null,
    size: { width: 0, height: 0 },
  });
  const lastDamageNumbersRef = useRef<DamageNumberData[]>([]);
  const lastCameraRef = useRef<Camera | null>(null);
  const lastSizeRef = useRef<{ width: number; height: number }>({ width: 0, height: 0 });

  const handleCameraUpdate = useCallback((camera: Camera, size: { width: number; height: number }) => {
    const prevSize = lastSizeRef.current;
    if (
      lastCameraRef.current === camera &&
      prevSize.width === size.width &&
      prevSize.height === size.height
    ) {
      return;
    }
    lastCameraRef.current = camera;
    lastSizeRef.current = size;
    setCameraInfo({ camera, size });
  }, []);

  const handleDamageNumbersUpdate = useCallback((numbers: DamageNumberData[]) => {
    if (damageNumbersEqual(lastDamageNumbersRef.current, numbers)) return;
    lastDamageNumbersRef.current = numbers;
    setDamageNumbers(numbers);
  }, []);

  const handleDamageNumberComplete = useCallback((id: string) => {
    const win = window as Window & { handleDamageNumberComplete?: (damageId: string) => void };
    win.handleDamageNumberComplete?.(id);
  }, []);

  useEffect(() => {
    callbacksRef.current = {
      onCameraUpdate: handleCameraUpdate,
      onDamageNumbersUpdate: handleDamageNumbersUpdate,
      onDamageNumberComplete: handleDamageNumberComplete,
    };
  }, [callbacksRef, handleCameraUpdate, handleDamageNumbersUpdate, handleDamageNumberComplete]);

  return (
    <>
      {damageNumbers.length > 0 && cameraInfo.camera && cameraInfo.size && (
        <div className="absolute inset-0 pointer-events-none">
          <DamageNumbers
            damageNumbers={damageNumbers}
            onDamageNumberComplete={handleDamageNumberComplete}
            camera={cameraInfo.camera}
            size={cameraInfo.size}
          />
        </div>
      )}
      <StrikeIndicator
        enabled
        camera={cameraInfo.camera}
        size={cameraInfo.size}
      />
    </>
  );
}
