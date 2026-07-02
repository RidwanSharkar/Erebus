import { useRef, memo, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { TubeGeometry, MeshStandardMaterial } from 'three';
import {
  Group,
  Vector3,
  CatmullRomCurve3,
  CubicBezierCurve3,
  Shape,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import { WeaponSubclass } from '@/components/dragon/weapons';
import { isBowPerfectShotProgress } from '@/utils/bowConstants';

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
}

const EtherBowComponent = memo(function EtherealBow({
  chargeProgress,
  isCharging,
  onRelease,
  currentSubclass,
  hasInstantPowershot = false,
  isAbilityBowAnimation = false,
  isViperStingCharging = false,
  viperStingChargeProgress = 0,
  isBarrageCharging = false,
  barrageChargeProgress = 0,
  isCobraShotCharging = false,
  cobraShotChargeProgress = 0,
  isRejuvenatingShotCharging = false,
  rejuvenatingShotChargeProgress = 0,
  tempestBurstShotSeq = 0
}: EtherealBowProps) {
  const bowRef = useRef<Group>(null);
  const muzzleMarkerRef = useRef<Group>(null);
  const muzzleFlareRef = useRef<Mesh | null>(null);
  const _muzzleWorldPos = useRef(new Vector3());
  const muzzleLight = useDynamicLight({ color: '#ff7722', distance: 3.5, decay: 1.2, priority: 1 });
  const tempestSeqRef = useRef(0);
  tempestSeqRef.current = tempestBurstShotSeq;
  const prevTempestSeqRef = useRef(0);
  const muzzleFlashStrengthRef = useRef(0);
  const maxDrawDistance = 1.35;
  const prevIsCharging = useRef(isCharging);
  const basePosition = [-0.9, 0.075, 0.75] as const;  // Match other weapons' base positioning
  const bowBodyMatRef = useRef<MeshStandardMaterial>(null);
  const leftWingMatRef = useRef<MeshStandardMaterial>(null);
  const rightWingMatRef = useRef<MeshStandardMaterial>(null);
  const leftBladeMatRef = useRef<MeshStandardMaterial>(null);
  const rightBladeMatRef = useRef<MeshStandardMaterial>(null);
  const perfectShotMatRefs = [bowBodyMatRef, leftWingMatRef, rightWingMatRef, leftBladeMatRef, rightBladeMatRef];
  const isPerfectShotWindow = isBowPerfectShotProgress(chargeProgress);
  
  // Perfect-window pulse (R3F clock) + charge release: only real bow draw, not ability animations
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

    if (isPerfectShotWindow) {
      const pulse = 4.0 + Math.sin(state.clock.elapsedTime * 20) * 2.0;
      for (const matRef of perfectShotMatRefs) {
        if (matRef.current) matRef.current.emissiveIntensity = pulse;
      }
    }
    const actualIsCharging = isCharging && !isAbilityBowAnimation && !isViperStingCharging && !isBarrageCharging && !isCobraShotCharging && !isRejuvenatingShotCharging;

    if (prevIsCharging.current && !actualIsCharging && !isViperStingCharging && !isBarrageCharging && !isCobraShotCharging && !isRejuvenatingShotCharging) {
      onRelease(chargeProgress, isBowPerfectShotProgress(chargeProgress));
    }

    prevIsCharging.current = actualIsCharging;
  });

  const bowCurve = useMemo(
    () =>
      new CatmullRomCurve3([
        new Vector3(-0.875, 0, 0),
        new Vector3(-0.85, 0.2, 0),
        new Vector3(-0.25, 0.5, 0),
        new Vector3(-0.4, 0.35, 0),
        new Vector3(0.4, 0.35, 0),
        new Vector3(0.25, 0.5, 0),
        new Vector3(0.85, 0.2, 0),
        new Vector3(0.875, 0, 0),
      ]),
    [],
  );

  const bladeShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.4, -0.130);
    shape.bezierCurveTo(0.8, 0.22, 1.33, 0.5, 1.6, 0.515);
    shape.lineTo(1.125, 0.75);
    shape.bezierCurveTo(0.5, 0.2, 0.225, 0.0, 0.1, 0.7);
    shape.lineTo(0, 0);
    return shape;
  }, []);

  const bladeExtrudeSettings = useMemo(
    () => ({ steps: 1, depth: 0.03, bevelEnabled: false }),
    [],
  );

  const rawDrawProgress = isCobraShotCharging
    ? cobraShotChargeProgress
    : isBarrageCharging
      ? barrageChargeProgress
      : isViperStingCharging
        ? viperStingChargeProgress
        : isRejuvenatingShotCharging
          ? rejuvenatingShotChargeProgress
          : chargeProgress;
  const quantizedDrawProgress = Math.round(rawDrawProgress * 20) / 20;

  const stringCurve = useMemo(() => {
    const pullback = quantizedDrawProgress * maxDrawDistance;
    return new CubicBezierCurve3(
      new Vector3(-0.8, 0, 0),
      new Vector3(0, 0, -pullback),
      new Vector3(0, 0, -pullback),
      new Vector3(0.8, 0, 0),
    );
  }, [quantizedDrawProgress]);

  const stringTubeGeo = useMemo(
    () => new TubeGeometry(stringCurve, 16, 0.02, 8, false),
    [stringCurve],
  );

  useEffect(() => () => stringTubeGeo.dispose(), [stringTubeGeo]);

  return (
    <group
      position={[0.6, 1.0, 1.375]}
      rotation={[-Math.PI/2.0, -Math.PI/2,  -Math.PI/1.95]}   // Reset base rotation
      scale={[0.875, 0.8, 0.8]}
    >
      <group
        ref={bowRef}
        position={[basePosition[0], basePosition[1], basePosition[2]]}
        rotation={[
          Math.PI,
          Math.PI/2,
          0
        ]}
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
        {/* Bow body with dynamic color for instant powershot, charging, and perfect shot timing */}
        <mesh rotation={[Math.PI/2, 0, 0]}>
          <tubeGeometry args={[bowCurve, 64, 0.035, 8, false]} />
          <meshStandardMaterial 
            ref={bowBodyMatRef}
            color={
              isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
              isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 136)}, ${Math.floor(136 + barrageChargeProgress * 119)}, ${Math.floor(255)})` : // Light blue Barrage colors
              isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
              isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
              isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)})` : // Teal/cyan Rejuvenating Shot colors
              currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
              currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
              "#C18C4B"
            }
            emissive={
              isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
              isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 100)}, ${Math.floor(100 + barrageChargeProgress * 100)}, ${Math.floor(200 + barrageChargeProgress * 55)})` : // Light blue Barrage emissive
              isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
              isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
              isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)})` : // Teal/cyan Rejuvenating Shot emissive
              currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
              currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ?
                `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
              "#C18C4B"
            }
            emissiveIntensity={
              isPerfectShotWindow ? 4 : // Pulsing effect driven via material ref in useFrame
              isBarrageCharging ? 2.0 + barrageChargeProgress * 2.0 : // Barrage charging glow
              isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
              isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
              isRejuvenatingShotCharging ? 2.0 + rejuvenatingShotChargeProgress * 2.0 : // Rejuvenating Shot charging glow
              currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
              currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
              1.5
            }
            transparent
            opacity={0.8}
          />
        </mesh>

        {/* Bow string — quantized draw + memoized TubeGeometry */}
        <mesh geometry={stringTubeGeo}>
          <meshStandardMaterial 
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={1}
            transparent
            opacity={0.6}
          />
        </mesh>

        {/* Decorative wing elements */}
        <group>
          {/* Left wing */}
          <mesh position={[-0.4, 0, 0.475]} rotation={[Math.PI/2, 0, Math.PI/6]}>
            <boxGeometry args={[0.6, 0.02, 0.05]} />
            <meshStandardMaterial 
              ref={leftWingMatRef}
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 136)}, ${Math.floor(136 + barrageChargeProgress * 119)}, ${Math.floor(255)})` : // Light blue Barrage colors
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)})` : // Teal/cyan Rejuvenating Shot colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 100)}, ${Math.floor(100 + barrageChargeProgress * 100)}, ${Math.floor(200 + barrageChargeProgress * 55)})` : // Light blue Barrage emissive
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)})` : // Teal/cyan Rejuvenating Shot emissive
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4 : // Pulsing effect driven via material ref in useFrame
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              transparent
              opacity={0.8}
            />
          </mesh>

          {/* Right wing */}
          <mesh position={[0.4, 0, 0.475]} rotation={[Math.PI/2, 0, -Math.PI/6]}>
            <boxGeometry args={[0.6, 0.02, 0.05]} />
            <meshStandardMaterial 
              ref={rightWingMatRef}
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 136)}, ${Math.floor(136 + barrageChargeProgress * 119)}, ${Math.floor(255)})` : // Light blue Barrage colors
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)})` : // Teal/cyan Rejuvenating Shot colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 100)}, ${Math.floor(100 + barrageChargeProgress * 100)}, ${Math.floor(200 + barrageChargeProgress * 55)})` : // Light blue Barrage emissive
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)})` : // Teal/cyan Rejuvenating Shot emissive
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4 : // Pulsing effect driven via material ref in useFrame
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              transparent
              opacity={0.8}
            />
          </mesh>
        </group>

        {/* Custom blade elements at bow ends */}
        <group>
          {/* Left blade */}
          <mesh position={[-1, 0, -0.2]} rotation={[Math.PI/2, 0, Math.PI/2]} scale={[0.4, -0.4, 0.4]}>
            <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
            <meshStandardMaterial 
              ref={leftBladeMatRef}
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 136)}, ${Math.floor(136 + barrageChargeProgress * 119)}, ${Math.floor(255)})` : // Light blue Barrage colors
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)})` : // Teal/cyan Rejuvenating Shot colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 100)}, ${Math.floor(100 + barrageChargeProgress * 100)}, ${Math.floor(200 + barrageChargeProgress * 55)})` : // Light blue Barrage emissive
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)})` : // Teal/cyan Rejuvenating Shot emissive
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4 : // Pulsing effect driven via material ref in useFrame
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              metalness={0.8}
              roughness={0.1}
              transparent
              opacity={0.8}
              side={DoubleSide}
            />
          </mesh>

          {/* Right blade */}
          <mesh position={[1.0, 0, -0.2]} rotation={[Math.PI/2, 0, Math.PI/2]} scale={[0.4, 0.4, 0.4]}>
            <extrudeGeometry args={[bladeShape, bladeExtrudeSettings]} />
            <meshStandardMaterial 
              ref={rightBladeMatRef}
              color={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 136)}, ${Math.floor(136 + barrageChargeProgress * 119)}, ${Math.floor(255)})` : // Light blue Barrage colors
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 255)}, ${Math.floor(255)}, ${Math.floor(64 + cobraShotChargeProgress * 32)})` : // Green cobra colors
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)}, ${Math.floor(128 + rejuvenatingShotChargeProgress * 127)})` : // Teal/cyan Rejuvenating Shot colors
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00ff40" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissive={
                isPerfectShotWindow ? "#ffffff" : // Flash white during perfect shot window
                isBarrageCharging ? `rgb(${Math.floor(0 + barrageChargeProgress * 100)}, ${Math.floor(100 + barrageChargeProgress * 100)}, ${Math.floor(200 + barrageChargeProgress * 55)})` : // Light blue Barrage emissive
                isCobraShotCharging ? `rgb(${Math.floor(0 + cobraShotChargeProgress * 170)}, ${Math.floor(170 + cobraShotChargeProgress * 85)}, ${Math.floor(32 + cobraShotChargeProgress * 32)})` : // Green cobra emissive
                isViperStingCharging ? `rgb(${Math.floor(193 + viperStingChargeProgress * 62)}, ${Math.floor(68 - viperStingChargeProgress * 68)}, ${Math.floor(0)})` : // Reddish-orange Viper Sting colors (#ff4400)
                isRejuvenatingShotCharging ? `rgb(${Math.floor(0)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)}, ${Math.floor(85 + rejuvenatingShotChargeProgress * 85)})` : // Teal/cyan Rejuvenating Shot emissive
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? "#00aa20" :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 
                  `rgb(${Math.floor(193 + chargeProgress * 62)}, ${Math.floor(140 - chargeProgress * 140)}, ${Math.floor(75 - chargeProgress * 75)})` :
                "#C18C4B"
              }
              emissiveIntensity={
                isPerfectShotWindow ? 4 : // Pulsing effect driven via material ref in useFrame
                isCobraShotCharging ? 2.0 + cobraShotChargeProgress * 2.0 : // Cobra Shot charging glow
                isViperStingCharging ? 2.0 + viperStingChargeProgress * 2.0 : // Viper Sting charging glow
                currentSubclass === WeaponSubclass.VENOM && hasInstantPowershot ? 2.5 :
                currentSubclass === WeaponSubclass.ELEMENTAL && isCharging ? 1.5 + chargeProgress * 1.5 :
                1.5
              }
              metalness={0.8}
              roughness={0.1}
              transparent
              opacity={0.8}
              side={DoubleSide}
            />
          </mesh>
        </group>

        {/* Arrow  */}
        {(isCharging || isViperStingCharging || isBarrageCharging || isCobraShotCharging || isRejuvenatingShotCharging) && (
          <group
            position={[0, 0, 0.8 - (isCobraShotCharging ? cobraShotChargeProgress : isBarrageCharging ? barrageChargeProgress : isViperStingCharging ? viperStingChargeProgress : isRejuvenatingShotCharging ? rejuvenatingShotChargeProgress : chargeProgress) * maxDrawDistance]}
            rotation={[Math.PI/2, 0, 0]}
          >
            {/* Arrow shaft - increased length from 0.5 to 0.7 */}
            <mesh>
              <cylinderGeometry args={[0.015, 0.02, 0.9, 8]} />
              <meshStandardMaterial
                color={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#88BBFF" : isViperStingCharging ? "#ff4400" : isRejuvenatingShotCharging ? "#00FFFF" : "#00ffff"}
                emissive={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#88BBFF" : isViperStingCharging ? "#ff4400" : isRejuvenatingShotCharging ? "#00FFFF" : "#00ffff"}
                emissiveIntensity={3}
                transparent
                opacity={0.9}
              />
            </mesh>
            {/* Arrow head - adjusted position for longer shaft */}
            <mesh position={[0, 0.35, 0]}>
              <coneGeometry args={[0.03, 0.175, 8]} />
              <meshStandardMaterial
                color={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#88BBFF" : isViperStingCharging ? "#ff4400" : isRejuvenatingShotCharging ? "#00FFFF" : "#00ffff"}
                emissive={isCobraShotCharging ? "#00ff40" : isBarrageCharging ? "#88BBFF" : isViperStingCharging ? "#ff4400" : isRejuvenatingShotCharging ? "#00FFFF" : "#00ffff"}
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
  // Custom comparison function for performance optimization
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
    (!prevProps.position || !nextProps.position || prevProps.position.equals(nextProps.position)) &&
    (!prevProps.direction || !nextProps.direction || prevProps.direction.equals(nextProps.direction))
  );
});

export default EtherBowComponent;
