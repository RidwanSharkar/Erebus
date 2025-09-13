import React, { useRef, useEffect } from 'react';
import TidalWaveManager, { setGlobalTidalWaveTrigger, TidalWaveManagerRef } from './TidalWaveManager';

interface PVPTidalWaveManagerProps {
  // Props can be added here if needed for PVP-specific functionality
}

const PVPTidalWaveManager: React.FC<PVPTidalWaveManagerProps> = () => {
  const managerRef = useRef<TidalWaveManagerRef>(null);

  useEffect(() => {
    // Set up the global trigger callback for tidal waves
    setGlobalTidalWaveTrigger((position, direction, casterId) => {
      if (managerRef.current) {
        // Create the tidal wave effect
        managerRef.current.createWave(position, direction, () => {
          // Wave completed
          console.log('🌊 Tidal wave effect completed');
        });
      }
    });
  }, []);

  return (
    <TidalWaveManager
      ref={managerRef}
      onWaveComplete={(waveId) => {
        console.log(`🌊 PVP Tidal wave ${waveId} completed`);
      }}
    />
  );
};

export default PVPTidalWaveManager;
