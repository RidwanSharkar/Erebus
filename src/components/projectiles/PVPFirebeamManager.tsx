import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group } from '@/utils/three-exports';
import { setGlobalParticleBeamTrigger } from './FirebeamManager';
import FirebeamManager from './FirebeamManager';
import Firebeam from './Firebeam';

interface PVPFirebeamManagerProps {
  players: Array<{
    id: string;
    position: { x: number; y: number; z: number };
    health: number;
    isFrozen?: boolean;
  }>;
  onPlayerHit: (playerId: string, damage: number, isFrozen: boolean) => void;
  onManaRefund?: (playerId: string, manaAmount: number) => void; // Callback for mana refund on frozen hits
  localSocketId?: string;
  getPlayerFrozenState?: (playerId: string) => boolean; // Function to get current frozen state
}

const PVPFirebeamManager: React.FC<PVPFirebeamManagerProps> = ({
  players,
  onPlayerHit,
  onManaRefund,
  localSocketId,
  getPlayerFrozenState
}) => {
  const beamIdCounter = useRef(0);
  const [activeBeams, setActiveBeams] = useState<Map<number, {
    id: number;
    position: Vector3;
    direction: Vector3;
    startTime: number;
    hasHit: boolean;
    parentRef: React.RefObject<Group>;
    casterId?: string; // ID of the player who cast this beam
  }>>(new Map());

  // Set up global trigger for remote players
  React.useEffect(() => {
    setGlobalParticleBeamTrigger((position: Vector3, direction: Vector3, casterId?: string) => {
      const beamId = beamIdCounter.current++;
      const startTime = Date.now();
      const parentRef = React.createRef<Group>();

      setActiveBeams(prev => {
        const newBeams = new Map(prev);
        newBeams.set(beamId, {
          id: beamId,
          position: position.clone(),
          direction: direction.clone(),
          startTime,
          hasHit: false,
          parentRef,
          casterId: casterId || localSocketId // Use provided casterId or fallback to localSocketId
        });
        return newBeams;
      });

      // Auto-remove beam after 1.5 seconds
      setTimeout(() => {
        setActiveBeams(prev => {
          const newBeams = new Map(prev);
          newBeams.delete(beamId);
          return newBeams;
        });
      }, 1500);
    });
  }, []);

  useFrame(() => {
    const currentTime = Date.now();

    // Check collisions
    setActiveBeams(prev => {
      const newBeams = new Map(prev);

      newBeams.forEach((beam, beamId) => {
        // Skip if beam has already hit or is too old
        if (beam.hasHit || currentTime - beam.startTime > 1500) {
          return;
        }

        // Check collision with players
        for (const player of players) {
          // Don't hit the caster of this beam
          if (player.id === beam.casterId) continue;

          const playerPos = new Vector3(player.position.x, player.position.y, player.position.z);
          const distance = beam.position.distanceTo(playerPos);

          // Beam collision radius (approximately the width of the beam)
          if (distance < 1.5) {
            const damage = 70; // Particle Beam damage
            // Use the getPlayerFrozenState function if available, otherwise fall back to player.isFrozen
            const isFrozen = getPlayerFrozenState ? getPlayerFrozenState(player.id) : (player.isFrozen || false);

            // Mark beam as hit
            beam.hasHit = true;

            // Apply damage
            onPlayerHit(player.id, damage, isFrozen);

            // Refund mana if enemy is frozen (100 mana refund)
            if (isFrozen && onManaRefund) {
              onManaRefund(localSocketId!, 100);
              console.log(`⚡ Particle Beam hit player ${player.id} for ${damage} damage (FROZEN - refunded 100 mana)`);
            } else {
              console.log(`⚡ Particle Beam hit player ${player.id} for ${damage} damage`);
            }

            break; // Only hit one player per beam
          }
        }
      });

      return newBeams;
    });
  });

  return (
    <>
      <FirebeamManager />
      {/* Render remote particle beams */}
      {Array.from(activeBeams.entries()).map(([beamId, beam]) => (
        <Firebeam
          key={beamId}
          parentRef={beam.parentRef}
          onComplete={() => {
            setActiveBeams(prev => {
              const newBeams = new Map(prev);
              newBeams.delete(beamId);
              return newBeams;
            });
          }}
          onHit={() => {}}
          isActive={true}
          startTime={beam.startTime}
          fixedPosition={beam.position}
          fixedDirection={beam.direction}
        />
      ))}
    </>
  );
};

export default PVPFirebeamManager;
