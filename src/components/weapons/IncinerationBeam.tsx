import { useRef, useEffect, useMemo, useState } from 'react';
import {
  Group,
  Vector3,
  Color,
  CylinderGeometry,
  ConeGeometry,
  SphereGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  AdditiveBlending,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { createBeamCylinderAdditiveMaterial } from '@/utils/beamCylinderAdditiveMaterial';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';
import DirectionalProcLightning, {
  type DirectionalProcLightningPalette,
} from '@/components/enemies/DirectionalProcLightning';
import {
  getIncinerationRuneBandTexture,
  INCINERATION_FIRE_CORE,
  INCINERATION_FIRE_DEEP,
  INCINERATION_FIRE_GLOW,
  INCINERATION_RUNE_BAND_BASE_OPACITY,
  INCINERATION_RUNE_BAND_INNER,
  INCINERATION_RUNE_BAND_OUTER,
  INCINERATION_RUNE_RIM_LINE_WIDTH,
} from '@/components/weapons/IncinerationChargeAura';
import {
  INCINERATION_BEAM_MAX_HALF_WIDTH,
  INCINERATION_BEAM_MIN_HALF_WIDTH,
  INCINERATION_BEAM_RANGE,
  INCINERATION_BURST_MAX_SCALE,
  INCINERATION_PLASMA_BOLT_LATERAL_OFFSET,
  INCINERATION_PLASMA_SIDE_BOLT_RANGE,
} from '@/utils/talents';

const _scratchA = new Color();
const _scratchB = new Color();
const _scratchC = new Color();
const _sourceLightPos = new Vector3();
const _tipLightPos = new Vector3();
const _boltFromLeft = new Vector3();
const _boltFromRight = new Vector3();
const _boltToLeft = new Vector3();
const _boltToRight = new Vector3();
const _dirVec = new Vector3();
const _perpVec = new Vector3();
const _centerPos = new Vector3();
const _beamTip = new Vector3();

const FIRE_BEAM_BRI_GAIN = 25;
const BEAM_DURATION_SEC = 0.65;
const MUZZLE_JET_LENGTH = 1.0;
const LAUNCH_RING_DURATION_SEC = 0.75;
const LAUNCH_RING_GROUND_Y = 1.5;
const LAUNCH_RING_FORWARD = 0.75;
const LAUNCH_RING_SCALE = 0.775;

const FIRE_HOT = '#fff1b8';
const FIRE_CORE = '#ff6600';
const FIRE_GLOW = '#ffaa33';
const FIRE_DEEP = '#cc2200';

const PLASMA_BOLT_PALETTE: DirectionalProcLightningPalette = {
  core: '#e6f4ff',
  glow: '#3399ff',
  halo: '#44aaff',
  light: '#1166cc',
};

export interface IncinerationBeamProps {
  origin: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  charge: number;
  isPlasma?: boolean;
  onComplete: () => void;
}

function getBeamHalfWidth(charge: number): number {
  const t = Math.min(1, Math.max(0, charge / 100));
  return (
    INCINERATION_BEAM_MIN_HALF_WIDTH +
    t * (INCINERATION_BEAM_MAX_HALF_WIDTH - INCINERATION_BEAM_MIN_HALF_WIDTH)
  );
}

function createFireCylinderMaterials() {
  const placeholder = new Color(FIRE_CORE);
  return {
    core: createBeamCylinderAdditiveMaterial(placeholder, 0.95, 0.18),
    inner: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.78, 0.12),
    outer: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.55, 0.08),
    outermost: createBeamCylinderAdditiveMaterial(placeholder.clone(), 0.40, 0.05),
  };
}

function updateFireCylinderUniforms(
  mats: ReturnType<typeof createFireCylinderMaterials>,
  fadeProg: number,
  intensity: number,
): void {
  const vx = intensity * fadeProg * FIRE_BEAM_BRI_GAIN;
  _scratchA.set(FIRE_HOT);
  _scratchB.set(FIRE_CORE);

  mats.core.uniforms.uColor.value.copy(_scratchA).lerp(_scratchB, 0.35);
  mats.core.uniforms.uOpacity.value = 0.90 * fadeProg;
  mats.core.uniforms.uBrightnessMul.value = vx;

  mats.inner.uniforms.uColor.value.copy(_scratchB).lerp(_scratchC.set(FIRE_GLOW), 0.25);
  mats.inner.uniforms.uOpacity.value = 0.55 * fadeProg;
  mats.inner.uniforms.uBrightnessMul.value = vx * 0.20;

  mats.outer.uniforms.uColor.value.copy(_scratchB).lerp(_scratchC.set(FIRE_GLOW), 0.15);
  mats.outer.uniforms.uOpacity.value = 0.30 * fadeProg;
  mats.outer.uniforms.uBrightnessMul.value = vx * 0.04;

  mats.outermost.uniforms.uColor.value.set(FIRE_DEEP);
  mats.outermost.uniforms.uOpacity.value = 0.18 * fadeProg;
  mats.outermost.uniforms.uBrightnessMul.value = vx * 0.015;
}

export default function IncinerationBeam({
  origin,
  direction,
  charge,
  isPlasma = false,
  onComplete,
}: IncinerationBeamProps) {
  const beamRef = useRef<Group>(null);
  const muzzleRef = useRef<Group>(null);
  const muzzlePuffRef = useRef<Group>(null);
  const muzzleJetRef = useRef<Group>(null);
  const muzzlePuffMatRef = useRef<MeshBasicMaterial>(null);
  const muzzleJetMatRef = useRef<MeshBasicMaterial>(null);
  const launchRingRef = useRef<Group>(null);
  const launchInnerRunesRef = useRef<Group>(null);
  const launchOuterRunesRef = useRef<Group>(null);
  const launchRuneBandMatRef = useRef<MeshBasicMaterial>(null);
  const launchInnerRimMatRef = useRef<MeshStandardMaterial>(null);
  const launchOuterRimMatRef = useRef<MeshStandardMaterial>(null);
  const startTimeRef = useRef(Date.now());
  const completedRef = useRef(false);
  const [showLaunchRings, setShowLaunchRings] = useState(true);
  const halfWidth = getBeamHalfWidth(charge);
  const intensity = 0.65 + Math.min(1, charge / 100) * 0.55;
  const chargeFactor = Math.min(1, Math.max(0, charge / 100));

  const beamLength = INCINERATION_BEAM_RANGE;
  const beamGeometries = useMemo(
    () => ({
      core: new CylinderGeometry(halfWidth * 0.15, halfWidth * 0.28, beamLength, 16),
      inner: new CylinderGeometry(halfWidth * 0.35, halfWidth * 0.55, beamLength, 16),
      outer: new CylinderGeometry(halfWidth * 0.65, halfWidth * 0.85, beamLength, 16),
      outermost: new CylinderGeometry(halfWidth * 0.85, halfWidth * 1.05, beamLength, 16),
    }),
    [beamLength, halfWidth],
  );

  const muzzleGeometries = useMemo(
    () => ({
      puff: new SphereGeometry(0.35 + chargeFactor * 0.15, 12, 12),
      jet: new ConeGeometry(halfWidth * 0.4, MUZZLE_JET_LENGTH, 12, 1, true),
    }),
    [chargeFactor, halfWidth],
  );

  const fireCylinderMaterials = useMemo(() => createFireCylinderMaterials(), []);

  const runeBandTexture = useMemo(() => getIncinerationRuneBandTexture(), []);

  const sourceLight = useDynamicLight({ color: _scratchA.clone(), priority: 3 });
  const tipLight = useDynamicLight({ color: _scratchB.clone(), priority: 3 });

  const dirVec = useMemo(
    () => new Vector3(direction.x, direction.y, direction.z).normalize(),
    [direction.x, direction.y, direction.z],
  );
  const originVec = useMemo(
    () => new Vector3(origin.x, origin.y, origin.z),
    [origin.x, origin.y, origin.z],
  );
  const beamYaw = useMemo(() => Math.atan2(dirVec.x, dirVec.z), [dirVec.x, dirVec.z]);

  const plasmaBoltEndpoints = useMemo(() => {
    if (!isPlasma) return null;

    _dirVec.set(direction.x, 0, direction.z);
    if (_dirVec.lengthSq() < 1e-8) {
      _dirVec.set(0, 0, -1);
    } else {
      _dirVec.normalize();
    }
    _perpVec.set(-_dirVec.z, 0, _dirVec.x);

    const range = INCINERATION_PLASMA_SIDE_BOLT_RANGE;
    const lateral = INCINERATION_PLASMA_BOLT_LATERAL_OFFSET;
    const converge = lateral * 0.25;

    _boltFromLeft.set(
      origin.x + _perpVec.x * lateral,
      origin.y,
      origin.z + _perpVec.z * lateral,
    );
    _boltToLeft.set(
      origin.x + _dirVec.x * range + _perpVec.x * converge,
      origin.y,
      origin.z + _dirVec.z * range + _perpVec.z * converge,
    );
    _boltFromRight.set(
      origin.x - _perpVec.x * lateral,
      origin.y,
      origin.z - _perpVec.z * lateral,
    );
    _boltToRight.set(
      origin.x + _dirVec.x * range - _perpVec.x * converge,
      origin.y,
      origin.z + _dirVec.z * range - _perpVec.z * converge,
    );

    return {
      fromLeft: _boltFromLeft.clone(),
      toLeft: _boltToLeft.clone(),
      fromRight: _boltFromRight.clone(),
      toRight: _boltToRight.clone(),
    };
  }, [direction.x, direction.z, isPlasma, origin.x, origin.y, origin.z]);

  useEffect(() => {
    window.audioSystem?.playIncinerateFireSound?.(originVec);
  }, [originVec]);

  useEffect(() => {
    return () => {
      beamGeometries.core.dispose();
      beamGeometries.inner.dispose();
      beamGeometries.outer.dispose();
      beamGeometries.outermost.dispose();
      muzzleGeometries.puff.dispose();
      muzzleGeometries.jet.dispose();
      fireCylinderMaterials.core.dispose();
      fireCylinderMaterials.inner.dispose();
      fireCylinderMaterials.outer.dispose();
      fireCylinderMaterials.outermost.dispose();
    };
  }, [beamGeometries, muzzleGeometries, fireCylinderMaterials]);

  useFrame((_, delta) => {
    if (!beamRef.current) return;

    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const fadeIn = Math.min(1, elapsed / 0.08);
    const fadeOut = elapsed > BEAM_DURATION_SEC - 0.2
      ? Math.max(0, 1 - (elapsed - (BEAM_DURATION_SEC - 0.2)) / 0.2)
      : 1;
    const fadeProg = fadeIn * fadeOut;
    const muzzleT = Math.min(1, elapsed / 0.18);

    updateFireCylinderUniforms(fireCylinderMaterials, fadeProg, intensity);

    _dirVec.copy(dirVec);
    _centerPos.copy(originVec).add(_dirVec.multiplyScalar(beamLength * 0.5));
    beamRef.current.position.copy(_centerPos);
    beamRef.current.rotation.y = beamYaw;

    if (muzzleRef.current) {
      muzzleRef.current.position.copy(originVec);
      muzzleRef.current.rotation.y = beamYaw;
    }

    if (launchRingRef.current) {
      _dirVec.set(direction.x, 0, direction.z);
      if (_dirVec.lengthSq() < 1e-8) {
        _dirVec.set(0, 0, -1);
      } else {
        _dirVec.normalize();
      }
      launchRingRef.current.position.set(
        origin.x + _dirVec.x * LAUNCH_RING_FORWARD,
        LAUNCH_RING_GROUND_Y,
        origin.z + _dirVec.z * LAUNCH_RING_FORWARD,
      );
      launchRingRef.current.rotation.set(0, beamYaw, 0);
    }

    const ringT = Math.min(1, elapsed / LAUNCH_RING_DURATION_SEC);
    const ringFadeIn = Math.min(1, elapsed / 0.06);
    const ringFadeOut = 1 - ringT * ringT;
    const ringOpacity = ringFadeIn * ringFadeOut;

    if (launchInnerRunesRef.current) {
      launchInnerRunesRef.current.rotation.z += delta * 2.8;
    }
    if (launchOuterRunesRef.current) {
      launchOuterRunesRef.current.rotation.z -= delta * 3.4;
    }
    if (launchRuneBandMatRef.current) {
      launchRuneBandMatRef.current.opacity = INCINERATION_RUNE_BAND_BASE_OPACITY * ringOpacity;
    }
    if (launchInnerRimMatRef.current) {
      launchInnerRimMatRef.current.opacity = 0.92 * ringOpacity;
      launchInnerRimMatRef.current.emissiveIntensity = 2.6 + Math.sin(elapsed * 18) * 0.4;
    }
    if (launchOuterRimMatRef.current) {
      launchOuterRimMatRef.current.opacity = 0.95 * ringOpacity;
      launchOuterRimMatRef.current.emissiveIntensity = 2.4 + Math.cos(elapsed * 16) * 0.35;
    }
    if (ringOpacity <= 0.01 && showLaunchRings) {
      setShowLaunchRings(false);
    }

    const cappedBurstScale = Math.min(
      INCINERATION_BURST_MAX_SCALE,
      (0.35 + chargeFactor * 0.15) * (1 + muzzleT * 1.4),
    );
    if (muzzlePuffRef.current) {
      muzzlePuffRef.current.scale.setScalar(cappedBurstScale);
    }
    if (muzzleJetRef.current) {
      const jetScale = Math.min(INCINERATION_BURST_MAX_SCALE * 1.6, 0.55 + chargeFactor * 0.25);
      muzzleJetRef.current.scale.set(jetScale, jetScale * (0.85 + muzzleT * 0.35), jetScale);
      muzzleJetRef.current.position.set(0, 0, MUZZLE_JET_LENGTH * 0.5 * jetScale);
    }
    if (muzzlePuffMatRef.current) {
      muzzlePuffMatRef.current.opacity = fadeProg * (muzzleT < 0.15 ? muzzleT / 0.15 : Math.max(0, 1 - (muzzleT - 0.15) / 0.35)) * 0.85;
    }
    if (muzzleJetMatRef.current) {
      muzzleJetMatRef.current.opacity = fadeProg * (muzzleT < 0.08 ? muzzleT / 0.08 : Math.max(0, 1 - (muzzleT - 0.08) / 0.25)) * 0.72;
    }

    _sourceLightPos.copy(originVec);
    _beamTip.copy(dirVec).multiplyScalar(beamLength).add(originVec);
    _tipLightPos.copy(_beamTip);
    sourceLight.current?.setPosition(_sourceLightPos.x, _sourceLightPos.y, _sourceLightPos.z);
    sourceLight.current?.setColor(_scratchA.set(FIRE_CORE));
    sourceLight.current?.setIntensity(3.5 * fadeProg * intensity);
    sourceLight.current?.setDistance(8);
    tipLight.current?.setPosition(_tipLightPos.x, _tipLightPos.y, _tipLightPos.z);
    tipLight.current?.setColor(_scratchB.set(FIRE_CORE));
    tipLight.current?.setIntensity(2.8 * fadeProg * intensity);
    tipLight.current?.setDistance(10);

    if (elapsed >= BEAM_DURATION_SEC && !completedRef.current) {
      completedRef.current = true;
      onComplete();
    }
  });

  return (
    <group>
      {showLaunchRings && (
        <group ref={launchRingRef} scale={[LAUNCH_RING_SCALE, LAUNCH_RING_SCALE, LAUNCH_RING_SCALE]}>
          <group ref={launchInnerRunesRef} position={[0, 0, 0.005]}>
            <mesh>
              <ringGeometry args={[INCINERATION_RUNE_BAND_INNER, INCINERATION_RUNE_BAND_OUTER, 48]} />
              <meshBasicMaterial
                ref={launchRuneBandMatRef}
                map={runeBandTexture}
                transparent
                opacity={INCINERATION_RUNE_BAND_BASE_OPACITY}
                depthWrite={false}
                side={2}
              />
            </mesh>
          </group>
          <group ref={launchOuterRunesRef} position={[0, 0, -0.005]}>
            <mesh>
              <ringGeometry args={[
                INCINERATION_RUNE_BAND_INNER - INCINERATION_RUNE_RIM_LINE_WIDTH,
                INCINERATION_RUNE_BAND_INNER,
                48,
              ]} />
              <meshStandardMaterial
                ref={launchInnerRimMatRef}
                color={INCINERATION_FIRE_CORE}
                emissive={INCINERATION_FIRE_GLOW}
                emissiveIntensity={2.6}
                transparent
                opacity={0.92}
                depthWrite={false}
                side={2}
              />
            </mesh>
            <mesh>
              <ringGeometry args={[
                INCINERATION_RUNE_BAND_OUTER,
                INCINERATION_RUNE_BAND_OUTER + INCINERATION_RUNE_RIM_LINE_WIDTH,
                48,
              ]} />
              <meshStandardMaterial
                ref={launchOuterRimMatRef}
                color={INCINERATION_FIRE_DEEP}
                emissive={INCINERATION_FIRE_CORE}
                emissiveIntensity={2.4}
                transparent
                opacity={0.95}
                depthWrite={false}
                side={2}
              />
            </mesh>
          </group>
        </group>
      )}

      <group ref={muzzleRef}>
        <group ref={muzzlePuffRef}>
          <mesh geometry={muzzleGeometries.puff}>
            <meshBasicMaterial
              ref={muzzlePuffMatRef}
              color={FIRE_HOT}
              transparent
              opacity={0}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
        <group ref={muzzleJetRef} rotation={[Math.PI / 2, 0, 0]}>
          <mesh geometry={muzzleGeometries.jet}>
            <meshBasicMaterial
              ref={muzzleJetMatRef}
              color={FIRE_CORE}
              transparent
              opacity={0}
              blending={AdditiveBlending}
              depthWrite={false}
              side={2}
            />
          </mesh>
        </group>
      </group>

      <group ref={beamRef}>
        <mesh geometry={beamGeometries.core} material={fireCylinderMaterials.core} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={beamGeometries.inner} material={fireCylinderMaterials.inner} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={beamGeometries.outer} material={fireCylinderMaterials.outer} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={beamGeometries.outermost} material={fireCylinderMaterials.outermost} rotation={[Math.PI / 2, 0, 0]} />
      </group>

      {isPlasma && plasmaBoltEndpoints && (
        <>
          <DirectionalProcLightning
            from={plasmaBoltEndpoints.fromLeft}
            to={plasmaBoltEndpoints.toLeft}
            palette={PLASMA_BOLT_PALETTE}
            thicknessScale={0.85}
            suppressImpactLight
          />
          <DirectionalProcLightning
            from={plasmaBoltEndpoints.fromRight}
            to={plasmaBoltEndpoints.toRight}
            palette={PLASMA_BOLT_PALETTE}
            thicknessScale={0.85}
            suppressImpactLight
          />
        </>
      )}
    </group>
  );
}
