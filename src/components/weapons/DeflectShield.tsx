import { useRef, useEffect, useMemo, useLayoutEffect } from 'react';
import { PooledEffectLight } from '@/components/effects/DynamicLightPool';
import { useFrame } from '@react-three/fiber';
import {
  Group,
  Vector3,
  Color,
  AdditiveBlending,
  DoubleSide,
  BackSide,
  SphereGeometry,
  CylinderGeometry,
  BoxGeometry,
  MeshStandardMaterial,
} from '@/utils/three-exports';

// Module-level scratch vectors — DeflectShield is always a singleton.
const _dRotScratch = new Vector3();
const _bodyCenterScratch = new Vector3();
const _fwdDirScratch = new Vector3();
const _shieldPosScratch = new Vector3();
import { WeaponType } from '@/components/dragon/weapons';
import { getAegisShieldPalette, type AegisPaletteVariant } from '@/utils/aegisShieldPalette';

const BODY_OUTER_GEO = new SphereGeometry(1.75, 40, 40);
const BODY_INNER_GEO = new SphereGeometry(1.75, 32, 32);
const FWD_CYL_OUTER_GEO = new CylinderGeometry(3, 3, 0.1, 32);
const FWD_CYL_MID_GEO = new CylinderGeometry(2.2, 2.2, 0.05, 32);
const FWD_CYL_INNER_GEO = new CylinderGeometry(3.5, 3.5, 0.02, 32);
const FWD_BOX_GEO = new BoxGeometry(0.8, 0.1, 0.05);
const FWD_CROSS_V_GEO = new BoxGeometry(0.15, 2.5, 0.05);
const FWD_CROSS_H_GEO = new BoxGeometry(2.5, 0.15, 0.05);
const FWD_PARTICLE_GEO = new SphereGeometry(0.08, 8, 8);

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
      currentRotation = _dRotScratch.set(
        dragonGroupRef.current.rotation.x,
        dragonGroupRef.current.rotation.y,
        dragonGroupRef.current.rotation.z
      );
    }

    _bodyCenterScratch.copy(currentPosition);
    _bodyCenterScratch.y += 1.05;
    bodyShellRef.current.position.copy(_bodyCenterScratch);

    _fwdDirScratch.set(
      Math.sin(currentRotation.y),
      0,
      Math.cos(currentRotation.y - 0.75)
    );
    _shieldPosScratch.copy(currentPosition).add(_fwdDirScratch.multiplyScalar(2.5));
    _shieldPosScratch.y += 0.25;

    forwardGroupRef.current.position.copy(_shieldPosScratch);
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

  const colors = useMemo(() => ({
    cMain:   new Color(palette.main),
    cEm:     new Color(palette.emissive),
    cDeep:   new Color(palette.emissiveDeep),
    cAccent: new Color(palette.accent),
  }), [palette]);
  const { cMain, cEm, cDeep, cAccent } = colors;

  const materials = useMemo(() => {
    const shared = {
      transparent: true as const,
      blending: AdditiveBlending,
      depthWrite: false as const,
    };
    return {
      bodyOuter: new MeshStandardMaterial({
        color: cMain,
        emissive: cEm,
        emissiveIntensity: 1.2,
        opacity: 0.55,
        side: BackSide,
        ...shared,
      }),
      bodyInner: new MeshStandardMaterial({
        color: cAccent,
        emissive: cDeep,
        emissiveIntensity: 0.8,
        opacity: 0.22,
        side: DoubleSide,
        ...shared,
      }),
      fwdOuter: new MeshStandardMaterial({
        color: cMain,
        emissive: cEm,
        emissiveIntensity: 1.5,
        opacity: 0.7,
        side: DoubleSide,
        transparent: true,
        blending: AdditiveBlending,
      }),
      fwdMid: new MeshStandardMaterial({
        color: cAccent,
        emissive: cEm,
        emissiveIntensity: 2,
        opacity: 0.5,
        side: DoubleSide,
        transparent: true,
        blending: AdditiveBlending,
      }),
      fwdInner: new MeshStandardMaterial({
        color: cEm,
        emissive: cDeep,
        emissiveIntensity: 1,
        opacity: 0.3,
        side: DoubleSide,
        transparent: true,
        blending: AdditiveBlending,
      }),
      spoke: new MeshStandardMaterial({
        color: cAccent,
        emissive: cEm,
        emissiveIntensity: 3,
        opacity: 0.8,
        transparent: true,
        blending: AdditiveBlending,
      }),
      cross: new MeshStandardMaterial({
        color: cAccent,
        emissive: cEm,
        emissiveIntensity: 4,
        opacity: 0.9,
        transparent: true,
        blending: AdditiveBlending,
      }),
      particle: new MeshStandardMaterial({
        color: cMain,
        emissive: cEm,
        emissiveIntensity: 2,
        opacity: 0.6,
        transparent: true,
        blending: AdditiveBlending,
      }),
    };
  }, [cMain, cEm, cDeep, cAccent]);

  useEffect(() => {
    return () => {
      Object.values(materials).forEach((mat) => mat.dispose());
    };
  }, [materials]);

  if (!isActive) return null;

  return (
    <>
      <group ref={bodyShellRef}>
        <mesh geometry={BODY_OUTER_GEO} material={materials.bodyOuter} />
        <mesh geometry={BODY_INNER_GEO} material={materials.bodyInner} scale={1.04} />
        <PooledEffectLight color={cMain} intensity={1.2} distance={6} decay={2} />
      </group>

      <group ref={forwardGroupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={FWD_CYL_OUTER_GEO} material={materials.fwdOuter} />
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={FWD_CYL_MID_GEO} material={materials.fwdMid} />
        <mesh rotation={[Math.PI / 2, 0, 0]} geometry={FWD_CYL_INNER_GEO} material={materials.fwdInner} />

        <group rotation={[Math.PI / 2, 0, 0]}>
          {[...Array(8)].map((_, i) => (
            <mesh
              key={i}
              geometry={FWD_BOX_GEO}
              material={materials.spoke}
              position={[
                Math.cos((i * Math.PI) / 4) * 1.5,
                Math.sin((i * Math.PI) / 4) * 1.5,
                0.05,
              ]}
              rotation={[0, 0, (i * Math.PI) / 4]}
            />
          ))}
        </group>

        <group rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0, 0.1]} geometry={FWD_CROSS_V_GEO} material={materials.cross} />
          <mesh position={[0, 0, 0.1]} geometry={FWD_CROSS_H_GEO} material={materials.cross} />
        </group>

        <group rotation={[Math.PI / 2, 0, 0]}>
          {[...Array(12)].map((_, i) => (
            <mesh
              key={`particle-${i}`}
              geometry={FWD_PARTICLE_GEO}
              material={materials.particle}
              position={[
                Math.cos((i * Math.PI) / 6) * (3.8 + Math.sin(Date.now() * 0.005 + i) * 0.3),
                Math.sin((i * Math.PI) / 6) * (3.8 + Math.sin(Date.now() * 0.005 + i) * 0.3),
                Math.sin(Date.now() * 0.003 + i) * 0.2,
              ]}
            />
          ))}
        </group>

        <PooledEffectLight color={cMain} intensity={2} distance={8} decay={2} />
      </group>
    </>
  );
}
