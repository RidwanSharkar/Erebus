import { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { useFrame } from '@react-three/fiber';
import { Group, Vector3, Color, AdditiveBlending, DoubleSide, BackSide } from '@/utils/three-exports';
import { WeaponType } from '@/components/dragon/weapons';
import { getAegisShieldPalette, type AegisPaletteVariant } from '@/utils/aegisShieldPalette';

function tagShieldMaterials(root: Group) {
  root.traverse((child: any) => {
    if (child.material && child.userData.shieldBaseTagged !== 'v1') {
      child.userData.shieldBaseOpacity = child.material.opacity;
      child.userData.shieldBaseEmissive = child.material.emissiveIntensity ?? 1;
      child.userData.shieldBaseTagged = 'v1';
    }
  });
}

interface DeflectShieldProps {
  isActive: boolean;
  duration: number;
  onComplete?: () => void;
  playerPosition?: Vector3;
  playerRotation?: Vector3;
  dragonGroupRef?: React.RefObject<Group>;
  weaponType?: WeaponType;
  /** Purple room Aegis boon uses distinct Scythe/Bow palettes. */
  paletteVariant?: AegisPaletteVariant;
  /** Local player only: pulse shell on `aegis-block` window event. */
  enableBlockFlash?: boolean;
}

export default function DeflectShield({
  isActive,
  duration,
  onComplete,
  playerPosition = new Vector3(0, 0, 0),
  playerRotation = new Vector3(0, 0, 0),
  dragonGroupRef,
  weaponType = WeaponType.RUNEBLADE,
  paletteVariant = 'default',
  enableBlockFlash = false,
}: DeflectShieldProps) {
  const bodyShellRef = useRef<Group>(null);
  const forwardGroupRef = useRef<Group>(null);
  const startTime = useRef<number | null>(null);
  const blockFlashEndMs = useRef(0);

  const palette = useMemo(
    () => getAegisShieldPalette(weaponType, paletteVariant),
    [weaponType, paletteVariant],
  );

  useEffect(() => {
    if (!enableBlockFlash || typeof window === 'undefined') return;
    const onBlock = () => {
      blockFlashEndMs.current = Date.now() + 150;
      window.audioSystem?.playAegisBlockSound?.();
    };
    window.addEventListener('aegis-block', onBlock);
    return () => window.removeEventListener('aegis-block', onBlock);
  }, [enableBlockFlash]);

  useEffect(() => {
    if (isActive) {
      startTime.current = Date.now();
    } else {
      startTime.current = null;
    }
  }, [isActive]);

  useLayoutEffect(() => {
    if (!isActive) return;
    if (bodyShellRef.current) tagShieldMaterials(bodyShellRef.current);
    if (forwardGroupRef.current) tagShieldMaterials(forwardGroupRef.current);
  }, [isActive, weaponType, palette]);

  useFrame(() => {
    if (!isActive || !startTime.current) return;
    if (!bodyShellRef.current || !forwardGroupRef.current) return;

    const elapsed = (Date.now() - startTime.current) / 1000;
    const progress = Math.min(elapsed / duration, 1);

    let currentPosition = playerPosition;
    let currentRotation = playerRotation;

    if (dragonGroupRef?.current) {
      currentPosition = dragonGroupRef.current.position;
      currentRotation = new Vector3(
        dragonGroupRef.current.rotation.x,
        dragonGroupRef.current.rotation.y,
        dragonGroupRef.current.rotation.z
      );
    }

    const bodyCenter = currentPosition.clone();
    bodyCenter.y += 1.05;
    bodyShellRef.current.position.copy(bodyCenter);

    const forwardDirection = new Vector3(
      Math.sin(currentRotation.y),
      0,
      Math.cos(currentRotation.y - 0.75)
    );
    const shieldPosition = currentPosition.clone().add(forwardDirection.multiplyScalar(2.5));
    shieldPosition.y += 0.25;

    forwardGroupRef.current.position.copy(shieldPosition);
    forwardGroupRef.current.rotation.set(
      currentRotation.x,
      currentRotation.y,
      currentRotation.z
    );

    let opacityMul = 1;
    const scale = 0.325;
    if (progress < 0.1) {
      opacityMul = progress / 0.1;
    } else if (progress > 0.9) {
      opacityMul = 1 - (progress - 0.9) / 0.1;
    }

    const bodyScale = scale * 1.15;
    bodyShellRef.current.scale.setScalar(bodyScale);
    forwardGroupRef.current.scale.setScalar(scale);

    const applyOpacityPulse = (root: Group, mul: number, pulseMul: number) => {
      root.traverse((child: any) => {
        if (child.material) {
          const bOp = child.userData.shieldBaseOpacity ?? 1;
          const bEm = child.userData.shieldBaseEmissive ?? 1;
          child.material.opacity = bOp * mul;
          if (child.material.emissiveIntensity !== undefined) {
            child.material.emissiveIntensity = bEm * pulseMul;
          }
        }
      });
    };

    const flashBoost = Date.now() < blockFlashEndMs.current ? 2.0 : 1;
    const pulseIntensity = (1 + Math.sin(elapsed * 8) * 0.3) * flashBoost;

    applyOpacityPulse(bodyShellRef.current, opacityMul, pulseIntensity);
    applyOpacityPulse(forwardGroupRef.current, opacityMul, pulseIntensity);

    if (progress >= 1) {
      onComplete?.();
    }
  });

  if (!isActive) return null;

  const cMain = new Color(palette.main);
  const cEm = new Color(palette.emissive);
  const cDeep = new Color(palette.emissiveDeep);
  const cAccent = new Color(palette.accent);

  return (
    <>
      <group ref={bodyShellRef}>
        <mesh>
          <sphereGeometry args={[1.75, 40, 40]} />
          <meshStandardMaterial
            color={cMain}
            emissive={cEm}
            emissiveIntensity={1.2}
            transparent
            opacity={0.55}
            side={BackSide}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <mesh scale={1.04}>
          <sphereGeometry args={[1.75, 32, 32]} />
          <meshStandardMaterial
            color={cAccent}
            emissive={cDeep}
            emissiveIntensity={0.8}
            transparent
            opacity={0.22}
            side={DoubleSide}
            blending={AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <PooledEffectLight color={cMain} intensity={1.2} distance={6} decay={2} />
      </group>

      <group ref={forwardGroupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[3, 3, 0.1, 32]} />
          <meshStandardMaterial
            color={cMain}
            emissive={cEm}
            emissiveIntensity={1.5}
            transparent
            opacity={0.7}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.2, 2.2, 0.05, 32]} />
          <meshStandardMaterial
            color={cAccent}
            emissive={cEm}
            emissiveIntensity={2}
            transparent
            opacity={0.5}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </mesh>

        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[3.5, 3.5, 0.02, 32]} />
          <meshStandardMaterial
            color={cEm}
            emissive={cDeep}
            emissiveIntensity={1}
            transparent
            opacity={0.3}
            side={DoubleSide}
            blending={AdditiveBlending}
          />
        </mesh>

        <group rotation={[Math.PI / 2, 0, 0]}>
          {[...Array(8)].map((_, i) => (
            <mesh
              key={i}
              position={[
                Math.cos((i * Math.PI) / 4) * 1.5,
                Math.sin((i * Math.PI) / 4) * 1.5,
                0.05,
              ]}
              rotation={[0, 0, (i * Math.PI) / 4]}
            >
              <boxGeometry args={[0.8, 0.1, 0.05]} />
              <meshStandardMaterial
                color={cAccent}
                emissive={cEm}
                emissiveIntensity={3}
                transparent
                opacity={0.8}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>

        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, 0.1]}>
            <boxGeometry args={[0.15, 2.5, 0.05]} />
            <meshStandardMaterial
              color={cAccent}
              emissive={cEm}
              emissiveIntensity={4}
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>
          <mesh position={[0, 0, 0.1]}>
            <boxGeometry args={[2.5, 0.15, 0.05]} />
            <meshStandardMaterial
              color={cAccent}
              emissive={cEm}
              emissiveIntensity={4}
              transparent
              opacity={0.9}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>

        <group rotation={[Math.PI / 2, 0, 0]}>
          {[...Array(12)].map((_, i) => (
            <mesh
              key={`particle-${i}`}
              position={[
                Math.cos((i * Math.PI) / 6) * (3.8 + Math.sin(Date.now() * 0.005 + i) * 0.3),
                Math.sin((i * Math.PI) / 6) * (3.8 + Math.sin(Date.now() * 0.005 + i) * 0.3),
                Math.sin(Date.now() * 0.003 + i) * 0.2,
              ]}
            >
              <sphereGeometry args={[0.08, 8, 8]} />
              <meshStandardMaterial
                color={cMain}
                emissive={cEm}
                emissiveIntensity={2}
                transparent
                opacity={0.6}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>

        <PooledEffectLight color={cMain} intensity={2} distance={8} decay={2} />
      </group>
    </>
  );
}
