import { useRef, memo, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { TubeGeometry } from 'three';
import {
  Group,
  Vector3,
  CubicBezierCurve3,
  Mesh,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { WeaponSubclass } from '@/components/dragon/weapons';
import { isBowPerfectShotProgress } from '@/utils/bowConstants';
import type { WeaponAspect } from '@/utils/weaponAspects';
import BowItemMeshVisual from './BowItemMeshVisual';

type ControlSystemDrawReader = {
  isCobraShotChargingActive(): boolean;
  getCobraShotChargeProgress(): number;
  isBarrageChargingActive(): boolean;
  getBarrageChargeProgress(): number;
  isViperStingChargingActive(): boolean;
  getViperStingChargeProgress(): number;
  isRejuvenatingShotChargingActive(): boolean;
  getRejuvenatingShotChargeProgress(): number;
  getChargeProgress(): number;
};

function readLiveDrawProgress(fallback: number, isLocalPlayer: boolean): number {
  if (!isLocalPlayer) return fallback;
  const cs = (window as Window & { controlSystemRef?: { current?: ControlSystemDrawReader } })
    .controlSystemRef?.current;
  if (!cs) return fallback;
  if (cs.isCobraShotChargingActive()) return cs.getCobraShotChargeProgress();
  if (cs.isBarrageChargingActive()) return cs.getBarrageChargeProgress();
  if (cs.isViperStingChargingActive()) return cs.getViperStingChargeProgress();
  if (cs.isRejuvenatingShotChargingActive()) return cs.getRejuvenatingShotChargeProgress();
  return cs.getChargeProgress();
}

function createStringCurve(pullback: number): CubicBezierCurve3 {
  return new CubicBezierCurve3(
    new Vector3(-0.8, 0, 0),
    new Vector3(0, 0, -pullback),
    new Vector3(0, 0, -pullback),
    new Vector3(0.8, 0, 0),
  );
}

interface EtherealBowProps {
  position: Vector3;
  direction: Vector3;
  chargeProgress: number;
  isCharging: boolean;
  onRelease: (finalProgress: number, isPerfectShot?: boolean) => void;
  currentSubclass?: WeaponSubclass;
  hasInstantPowershot?: boolean;
  isAbilityBowAnimation?: boolean;
  isViperStingCharging?: boolean;
  viperStingChargeProgress?: number;
  isBarrageCharging?: boolean;
  barrageChargeProgress?: number;
  isCobraShotCharging?: boolean;
  cobraShotChargeProgress?: number;
  isRejuvenatingShotCharging?: boolean;
  rejuvenatingShotChargeProgress?: number;
  /** Monotonic per Tempest Rounds arrow — triggers muzzle flash on increase. */
  tempestBurstShotSeq?: number;
  /** When true, read draw progress from controlSystemRef in useFrame (local player only). */
  isLocalPlayer?: boolean;
  /** Throne weapon aspect — Sniper / Druid / Beastmaster GLB body. */
  weaponAspect?: WeaponAspect;
}

const EtherBowComponent = memo(function EtherealBow({
  chargeProgress,
  isCharging,
  onRelease,
  isAbilityBowAnimation = false,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  isRejuvenatingShotCharging = false,
  rejuvenatingShotChargeProgress = 0,
  tempestBurstShotSeq = 0,
  isLocalPlayer = false,
  weaponAspect,
}: EtherealBowProps) {
  const bowRef = useRef<Group>(null);
  const muzzleMarkerRef = useRef<Group>(null);
  const muzzleFlareRef = useRef<Mesh | null>(null);
  const stringMeshRef = useRef<Mesh>(null);
  const arrowGroupRef = useRef<Group>(null);
  const lastQuantizedDrawRef = useRef(-1);
  const perfectShotPulseRef = useRef(0);
  const _muzzleWorldPos = useRef(new Vector3());
  const muzzleLight = useDynamicLight({ color: '#ff7722', distance: 3.5, decay: 1.2, priority: 1 });
  const tempestSeqRef = useRef(0);
  tempestSeqRef.current = tempestBurstShotSeq;
  const prevTempestSeqRef = useRef(0);
  const muzzleFlashStrengthRef = useRef(0);
  const maxDrawDistance = 1.35;
  const prevIsCharging = useRef(isCharging);
  const isLocalPlayerRef = useRef(isLocalPlayer);
  isLocalPlayerRef.current = isLocalPlayer;
  const basePosition = [-0.9, 0.075, 0.75] as const;

  const propDrawProgress = isCobraShotCharging
    ? cobraShotChargeProgress
    : isBarrageCharging
      ? barrageChargeProgress
      : isViperStingCharging
        ? viperStingChargeProgress
        : isRejuvenatingShotCharging
          ? rejuvenatingShotChargeProgress
          : chargeProgress;

  const initialStringGeo = useMemo(
    () => new TubeGeometry(createStringCurve(0), 16, 0.02, 8, false),
    [],
  );

  useEffect(
    () => () => {
      stringMeshRef.current?.geometry.dispose();
    },
    [],
  );

  const updateStringGeometry = (quantizedDraw: number) => {
    if (quantizedDraw === lastQuantizedDrawRef.current) return;
    lastQuantizedDrawRef.current = quantizedDraw;

    const pullback = quantizedDraw * maxDrawDistance;
    const curve = createStringCurve(pullback);
    const newGeo = new TubeGeometry(curve, 16, 0.02, 8, false);
    const mesh = stringMeshRef.current;
    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = newGeo;
    }
  };

  // Perfect-window pulse + charge release: only real bow draw, not ability animations
  useFrame((state, delta) => {
    const seq = tempestSeqRef.current;
    if (seq > prevTempestSeqRef.current) {
      muzzleFlashStrengthRef.current = 1;
      prevTempestSeqRef.current = seq;
    }
    muzzleFlashStrengthRef.current = Math.max(0, muzzleFlashStrengthRef.current * Math.exp(-delta * 12));
    const t = muzzleFlashStrengthRef.current;
    const marker = muzzleMarkerRef.current;
    if (marker) {
      marker.getWorldPosition(_muzzleWorldPos.current);
      muzzleLight.current?.setPosition(
        _muzzleWorldPos.current.x,
        _muzzleWorldPos.current.y,
        _muzzleWorldPos.current.z,
      );
      muzzleLight.current?.setIntensity(t * 22);
    }
    const flare = muzzleFlareRef.current;
    if (flare) {
      const mat = flare.material as MeshBasicMaterial;
      mat.opacity = Math.min(1, t * 0.92);
      const s = 0.15 + t * 1.1;
      flare.scale.set(s, s, s);
    }

    const liveDrawProgress = readLiveDrawProgress(propDrawProgress, isLocalPlayerRef.current);
    const livePerfectShotWindow = isBowPerfectShotProgress(liveDrawProgress);

    if (livePerfectShotWindow) {
      perfectShotPulseRef.current = 4.0 + Math.sin(state.clock.elapsedTime * 20) * 2.0;
    } else {
      perfectShotPulseRef.current = 0;
    }

    const quantizedDraw = Math.round(liveDrawProgress * 20) / 20;
    updateStringGeometry(quantizedDraw);

    const arrowGroup = arrowGroupRef.current;
    if (arrowGroup) {
      arrowGroup.position.z = 0.8 - liveDrawProgress * maxDrawDistance;
    }

    const actualIsCharging =
      isCharging &&
      !isAbilityBowAnimation &&
      !isViperStingCharging &&
      !isBarrageCharging &&
      !isCobraShotCharging &&
      !isRejuvenatingShotCharging;

    if (
      prevIsCharging.current &&
      !actualIsCharging &&
      !isViperStingCharging &&
      !isBarrageCharging &&
      !isCobraShotCharging &&
      !isRejuvenatingShotCharging
    ) {
      onRelease(liveDrawProgress, isBowPerfectShotProgress(liveDrawProgress));
    }

    prevIsCharging.current = actualIsCharging;
  });

  return (
    <group
      position={[0.6, 1.0, 1.375]}
      rotation={[-Math.PI / 2.0, -Math.PI / 2, -Math.PI / 1.95]}
      scale={[0.875, 0.8, 0.8]}
    >
      <group
        ref={bowRef}
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[Math.PI, Math.PI / 2, 0]}
      >
        <group ref={muzzleMarkerRef} position={[0, 0, 0.45]} />
        {/* Unlit muzzle pop — always visible (not dependent on scene lighting) */}
        <mesh ref={muzzleFlareRef} position={[0, 0, 0.5]} renderOrder={2}>
          <sphereGeometry args={[0.12, 10, 10]} />
          <meshBasicMaterial
            color="#ffaa44"
            transparent
            opacity={0}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {/* Aspect GLB body — Sniper / Druid / Beastmaster */}
        <BowItemMeshVisual
          key={weaponAspect ?? 'SNIPER'}
          aspect={weaponAspect}
          perfectShotPulseRef={perfectShotPulseRef}
        />

        {/* Bow string — draw driven imperatively in useFrame (no React re-renders per step) */}
        <mesh ref={stringMeshRef} geometry={initialStringGeo}>
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Arrow */}
        {(isCharging ||
          isViperStingCharging ||
          isBarrageCharging ||
          isCobraShotCharging ||
          isRejuvenatingShotCharging) && (
          <group
            ref={arrowGroupRef}
            position={[0, 0, 0.8]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <mesh>
              <cylinderGeometry args={[0.015, 0.02, 0.9, 8]} />
              <meshStandardMaterial
                color={
                  isCobraShotCharging
                    ? '#00ff40'
                    : isBarrageCharging
                      ? '#88BBFF'
                      : isViperStingCharging
                        ? '#ff4400'
                        : isRejuvenatingShotCharging
                          ? '#00FFFF'
                          : '#00ffff'
                }
                emissive={
                  isCobraShotCharging
                    ? '#00ff40'
                    : isBarrageCharging
                      ? '#88BBFF'
                      : isViperStingCharging
                        ? '#ff4400'
                        : isRejuvenatingShotCharging
                          ? '#00FFFF'
                          : '#00ffff'
                }
                emissiveIntensity={3}
                transparent
                opacity={0.9}
              />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <coneGeometry args={[0.03, 0.175, 8]} />
              <meshStandardMaterial
                color={
                  isCobraShotCharging
                    ? '#00ff40'
                    : isBarrageCharging
                      ? '#88BBFF'
                      : isViperStingCharging
                        ? '#ff4400'
                        : isRejuvenatingShotCharging
                          ? '#00FFFF'
                          : '#00ffff'
                }
                emissive={
                  isCobraShotCharging
                    ? '#00ff40'
                    : isBarrageCharging
                      ? '#88BBFF'
                      : isViperStingCharging
                        ? '#ff4400'
                        : isRejuvenatingShotCharging
                          ? '#00FFFF'
                          : '#00ffff'
                }
                emissiveIntensity={3}
                transparent
                opacity={0.9}
              />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.chargeProgress === nextProps.chargeProgress &&
    prevProps.isCharging === nextProps.isCharging &&
    prevProps.currentSubclass === nextProps.currentSubclass &&
    prevProps.hasInstantPowershot === nextProps.hasInstantPowershot &&
    prevProps.isAbilityBowAnimation === nextProps.isAbilityBowAnimation &&
    prevProps.isViperStingCharging === nextProps.isViperStingCharging &&
    prevProps.viperStingChargeProgress === nextProps.viperStingChargeProgress &&
    prevProps.isBarrageCharging === nextProps.isBarrageCharging &&
    prevProps.barrageChargeProgress === nextProps.barrageChargeProgress &&
    prevProps.isCobraShotCharging === nextProps.isCobraShotCharging &&
    prevProps.cobraShotChargeProgress === nextProps.cobraShotChargeProgress &&
    prevProps.isRejuvenatingShotCharging === nextProps.isRejuvenatingShotCharging &&
    prevProps.rejuvenatingShotChargeProgress === nextProps.rejuvenatingShotChargeProgress &&
    prevProps.tempestBurstShotSeq === nextProps.tempestBurstShotSeq &&
    prevProps.isLocalPlayer === nextProps.isLocalPlayer &&
    prevProps.weaponAspect === nextProps.weaponAspect &&
    (!prevProps.position || !nextProps.position || prevProps.position.equals(nextProps.position)) &&
    (!prevProps.direction || !nextProps.direction || prevProps.direction.equals(nextProps.direction))
  );
});

export default EtherBowComponent;
