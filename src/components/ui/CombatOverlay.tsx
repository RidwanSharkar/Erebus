'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function CombatOverlay({ callbacksRef }: CombatOverlayProps) {
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [cameraInfo, setCameraInfo] = useState<{
    camera: Camera | null;
    size: { width: number; height: number };
  }>({
    camera: null,
    size: { width: 0, height: 0 },
  });

  const handleCameraUpdate = useCallback((camera: Camera, size: { width: number; height: number }) => {
    setCameraInfo({ camera, size });
  }, []);

  const handleDamageNumbersUpdate = useCallback((numbers: DamageNumberData[]) => {
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
