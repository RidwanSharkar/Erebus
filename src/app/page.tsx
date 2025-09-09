'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { WeaponType, WeaponSubclass } from '../components/dragon/weapons';
import { Camera } from '../utils/three-exports';
import type { DamageNumberData } from '../components/DamageNumbers';
import DamageNumbers from '../components/DamageNumbers';
import GameUI from '../components/ui/GameUI';
import ExperienceBar from '../components/ui/ExperienceBar';
import { MultiplayerProvider } from '../contexts/MultiplayerContext';
import RoomJoin from '../components/ui/RoomJoin';

// Dynamic imports for maximum code splitting
const Canvas = dynamic(() => import('@react-three/fiber').then(mod => ({ default: mod.Canvas })), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-screen text-white">Loading 3D engine...</div>
});
// Use lazy-loaded game systems for maximum code splitting
const LazyGameSystems = dynamic(() => import('../components/LazyGameSystems'), {
  ssr: false,
  loading: () => null // No HTML elements inside Canvas
});



// Lazy load PVP game scene
const PVPGameScene = dynamic(() => import('../components/PVPGameScene').then(mod => ({ default: mod.PVPGameScene })), {
  ssr: false,
  loading: () => null
});

export default function Home() {
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);
  const [cameraInfo, setCameraInfo] = useState<{
    camera: Camera | null;
    size: { width: number; height: number };
  }>({
    camera: null,
    size: { width: 0, height: 0 }
  });
  const [gameState, setGameState] = useState({
    playerHealth: 200,
    maxHealth: 200,
    playerShield: 100,
    maxShield: 100,
    currentWeapon: WeaponType.BOW,
    currentSubclass: WeaponSubclass.ELEMENTAL,
    mana: 150,
    maxMana: 150
  });
  const [controlSystem, setControlSystem] = useState<any>(null);
  const [gameMode, setGameMode] = useState<'menu' | 'singleplayer' | 'multiplayer' | 'pvp'>('menu');
  const [showRoomJoin, setShowRoomJoin] = useState(false);
  const [roomJoinMode, setRoomJoinMode] = useState<'multiplayer' | 'pvp'>('multiplayer');
  const [playerExperience, setPlayerExperience] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);

  const handleDamageNumberComplete = (id: string) => {
    // Use the global handler set by GameScene
    if ((window as any).handleDamageNumberComplete) {
      (window as any).handleDamageNumberComplete(id);
    }
  };

  const handleCameraUpdate = (camera: Camera, size: { width: number; height: number }) => {
    setCameraInfo({ camera, size });
  };

  const handleGameStateUpdate = (newGameState: {
    playerHealth: number;
    maxHealth: number;
    playerShield: number;
    maxShield: number;
    currentWeapon: WeaponType;
    currentSubclass: WeaponSubclass;
    mana?: number;
    maxMana?: number;
  }) => {
    setGameState({
      ...newGameState,
      mana: newGameState.mana ?? 150,
      maxMana: newGameState.maxMana ?? 150
    });
  };

  const handleControlSystemUpdate = (newControlSystem: any) => {
    setControlSystem(newControlSystem);
  };

  const handleExperienceUpdate = (experience: number, level: number) => {
    setPlayerExperience(experience);
    setPlayerLevel(level);
  };

  return (
    <MultiplayerProvider>
      <main className="w-full h-screen bg-black relative">
        {/* Main Menu */}
        {gameMode === 'menu' && (
          <div className="absolute inset-0 flex items-center justify-center z-50">
            <div className="bg-black/95 p-8 rounded-xl border-2 border-green-500 text-white text-center">
              <h1 className="text-4xl font-bold mb-8 text-green-500">AVERNUS</h1>
              <div className="flex flex-col gap-4">
                <button 
                  className="px-8 py-4 text-xl bg-green-500 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-green-600 hover:-translate-y-1"
                  onClick={() => setGameMode('singleplayer')}
                >
                  Single Player
                </button>

                <button 
                  className="px-8 py-4 text-xl bg-red-500 text-white border-none rounded-lg cursor-pointer transition-all duration-300 font-bold hover:bg-red-600 hover:-translate-y-1"
                  onClick={() => {
                    setRoomJoinMode('pvp');
                    setShowRoomJoin(true);
                  }}
                >
                  PVP
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Room Join UI */}
        {showRoomJoin && (
          <RoomJoin
            onJoinSuccess={() => {
              setShowRoomJoin(false);
              setGameMode(roomJoinMode);
            }}
            currentWeapon={gameState.currentWeapon}
            currentSubclass={gameState.currentSubclass}
            gameMode={roomJoinMode}
          />
        )}

        <Canvas
          camera={{ 
            position: [0, 5, 10], 
            fov: 75,
            near: 0.1,
            far: 1000 
          }}
          shadows
          gl={{ 
            antialias: true,
            alpha: false,
            powerPreference: "high-performance"
          }}
        >
                      {gameMode === 'singleplayer' && (
              <LazyGameSystems
                onDamageNumbersUpdate={setDamageNumbers}
                onDamageNumberComplete={handleDamageNumberComplete}
                onCameraUpdate={handleCameraUpdate}
                onGameStateUpdate={handleGameStateUpdate}
                onControlSystemUpdate={handleControlSystemUpdate}
              />
            )}

          {gameMode === 'pvp' && (
            <PVPGameScene
              onDamageNumbersUpdate={setDamageNumbers}
              onDamageNumberComplete={handleDamageNumberComplete}
              onCameraUpdate={handleCameraUpdate}
              onGameStateUpdate={handleGameStateUpdate}
              onControlSystemUpdate={handleControlSystemUpdate}
              onExperienceUpdate={handleExperienceUpdate}
            />
          )}
        </Canvas>
      
        {/* UI Overlay - Only show during gameplay */}
        {gameMode !== 'menu' && (
          <>
            <div className="absolute top-4 left-4 text-white font-mono text-sm">
              <div>WASD - Double Tap Dash</div>
              <div>Right Click - Camera </div>
              <div>Left Click - Attack </div>
              <div>Space - Jump</div>
            </div>
            
            {/* Performance Stats */}
            <div className="absolute top-4 right-4 text-white font-mono text-sm">
              <div id="fps-counter">FPS: --</div>
              {gameMode === 'multiplayer' && (
                <div className="mt-2 text-blue-400">
                  <div>Multiplayer Mode</div>
                </div>
              )}
              {gameMode === 'pvp' && (
                <div className="mt-2 text-red-400">
                  <div>PVP Mode</div>
                </div>
              )}
            </div>
            
            {/* Damage Numbers Display - Outside Canvas */}
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
            
            {/* Game UI - Outside Canvas */}
            <div className="absolute bottom-4 left-4">
              <GameUI
                currentWeapon={gameState.currentWeapon}
                playerHealth={gameState.playerHealth}
                maxHealth={gameState.maxHealth}
                playerShield={gameState.playerShield}
                maxShield={gameState.maxShield}
                mana={gameState.mana || 150}
                maxMana={gameState.maxMana || 150}
                controlSystem={controlSystem}
              />
            </div>

            {/* Experience Bar - Only show in PVP mode */}
            {gameMode === 'pvp' && (
              <ExperienceBar
                experience={playerExperience}
                level={playerLevel}
                isLocalPlayer={true}
              />
            )}
          </>
        )}

      </main>
    </MultiplayerProvider>
  );
}
