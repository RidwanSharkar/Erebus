import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  Vector3,
  Quaternion,
  Group,
  Mesh,
  AdditiveBlending,
  TorusGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  PointsMaterial,
  MeshBasicMaterial,
} from '@/utils/three-exports';

const WRAITH_BUZZSAW_COLORS = {
  beam: '#ff8833',
  puff: '#ffcc88',
  core: '#ffaa44',
};

interface WraithBuzzsawVfxProps {
  active: boolean;
  /** Channel duration in ms (default 1500). */
  durationMs?: number;
}

const BEAM_LENGTH = 5.5;
const BEAM_RADIUS = 1;
const BEAM_ORIGIN_FORWARD_OFFSET = 0.5;
const BEAM_ORIGIN_Y_LOCAL = 0.9;

const upAxis = new Vector3(0, 1, 0);
const forwardAxis = new Vector3(0, 0, 1);
const BEAM_Y_TO_FORWARD_Z = new Quaternion().setFromUnitVectors(upAxis, forwardAxis);

function coneRadius(t: number): number {
  return BEAM_RADIUS * (0.62 + (0.32 - 0.62) * t);
}

function buildHelixGeo(
  strands: number,
  perStrand: number,
  twists: number,
  radiusScale: number,
): BufferGeometry {
  const n = strands * perStrand;
  const pos = new Float32Array(n * 3);
  for (let s = 0; s < strands; s++) {
    const phase = (s / strands) * Math.PI * 2;
    for (let i = 0; i < perStrand; i++) {
      const t = (i + 0.5) / perStrand;
      const y = t * BEAM_LENGTH;
      const r = coneRadius(t) * radiusScale;
      const angle = phase + t * Math.PI * 2 * twists;
      const idx = (s * perStrand + i) * 3;
      pos[idx] = Math.cos(angle) * r;
      pos[idx + 1] = y;
      pos[idx + 2] = Math.sin(angle) * r;
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  return geo;
}

type MatRef = { opacity?: number };

export default function WraithBuzzsawVfx({
  active,
  durationMs = 1500,
}: WraithBuzzsawVfxProps) {
  const groupRef = useRef<Group>(null);
  const burstRef = useRef<Mesh>(null);
  const beamMatRef = useRef<MeshBasicMaterial & MatRef>(null);
  const innerMatRef = useRef<MeshBasicMaterial & MatRef>(null);
  const puffMatRef = useRef<MeshBasicMaterial & MatRef>(null);
  const outerHelixRef = useRef<Group>(null);
  const outerHelixMat = useRef<PointsMaterial & MatRef>(null);
  const innerHelixRef = useRef<Group>(null);
  const innerHelixMat = useRef<PointsMaterial & MatRef>(null);
  const tipRingGroupRef = useRef<Group>(null);
  const tipRingRef = useRef<Mesh>(null);
  const tipRingMat = useRef<MeshBasicMaterial & MatRef>(null);
  const tipBurstRef = useRef<Mesh>(null);
  const tipBurstMat = useRef<MeshBasicMaterial & MatRef>(null);
  const startRef = useRef<number | null>(null);

  const half = BEAM_LENGTH * 0.5;
  const { beam: beamColor, puff: puffColor, core: coreColor } = WRAITH_BUZZSAW_COLORS;

  const outerHelixGeo = useMemo(() => buildHelixGeo(3, 22, 3.5, 0.97), []);
  const innerHelixGeo = useMemo(() => buildHelixGeo(2, 18, 5.0, 0.52), []);
  const tipTorusGeo = useMemo(
    () => new TorusGeometry(coneRadius(1) * 0.82, 0.042, 8, 28),
    [],
  );

  useEffect(() => {
    return () => {
      outerHelixGeo.dispose();
      innerHelixGeo.dispose();
      tipTorusGeo.dispose();
    };
  }, [outerHelixGeo, innerHelixGeo, tipTorusGeo]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    groupRef.current.position.set(
      0,
      BEAM_ORIGIN_Y_LOCAL,
      BEAM_ORIGIN_FORWARD_OFFSET,
    );
    groupRef.current.quaternion.copy(BEAM_Y_TO_FORWARD_Z);

    if (!active) {
      startRef.current = null;
      if (beamMatRef.current) beamMatRef.current.opacity = 0;
      if (innerMatRef.current) innerMatRef.current.opacity = 0;
      if (puffMatRef.current) puffMatRef.current.opacity = 0;
      if (outerHelixMat.current) outerHelixMat.current.opacity = 0;
      if (innerHelixMat.current) innerHelixMat.current.opacity = 0;
      if (tipRingMat.current) tipRingMat.current.opacity = 0;
      if (tipBurstMat.current) tipBurstMat.current.opacity = 0;
      return;
    }

    const now = performance.now();
    if (startRef.current == null) startRef.current = now;
    const t = Math.min(1, (now - startRef.current) / durationMs);
    const rise = Math.min(1, t / 0.1);
    const hold = t < 0.85 ? 1 : Math.max(0, 1 - (t - 0.85) / 0.15);
    const alpha = rise * hold;

    if (beamMatRef.current) beamMatRef.current.opacity = alpha * 0.42;
    if (innerMatRef.current) innerMatRef.current.opacity = alpha * 0.78;

    if (puffMatRef.current) {
      puffMatRef.current.opacity =
        alpha * 0.85 * (t < 0.12 ? 1 : Math.max(0, 1 - (t - 0.12) / 0.18));
    }
    if (burstRef.current) burstRef.current.scale.setScalar(1 + t * 1.4);

    if (outerHelixRef.current) outerHelixRef.current.rotation.y += delta * 10.5;
    if (outerHelixMat.current) outerHelixMat.current.opacity = alpha * 0.82;

    if (innerHelixRef.current) innerHelixRef.current.rotation.y -= delta * 7.2;
    if (innerHelixMat.current) innerHelixMat.current.opacity = alpha * 0.65;

    if (tipRingGroupRef.current) tipRingGroupRef.current.rotation.y += delta * 16.0;
    if (tipRingRef.current) {
      const pulse = 1 + Math.sin(now * 0.022) * 0.16;
      tipRingRef.current.scale.setScalar(pulse);
    }
    if (tipRingMat.current) tipRingMat.current.opacity = alpha * 0.94;

    if (tipBurstRef.current) {
      const s = 0.84 + Math.sin(now * 0.028 + 1.2) * 0.14;
      tipBurstRef.current.scale.setScalar(s);
    }
    if (tipBurstMat.current) tipBurstMat.current.opacity = alpha * 0.48;
  });

  if (!active) return null;

  return (
    <group ref={groupRef}>
      <mesh ref={burstRef} position={[0, 0.05, 0]}>
        <sphereGeometry args={[0.45, 12, 12]} />
        <meshBasicMaterial
          ref={puffMatRef as any}
          color={puffColor}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh position={[0, half, 0]}>
        <cylinderGeometry
          args={[
            BEAM_RADIUS * 0.32,
            BEAM_RADIUS * 0.62,
            BEAM_LENGTH,
            20, 1, true,
          ]}
        />
        <meshBasicMaterial
          ref={beamMatRef as any}
          color={beamColor}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh position={[0, half, 0]}>
        <cylinderGeometry
          args={[
            BEAM_RADIUS * 0.13,
            BEAM_RADIUS * 0.26,
            BEAM_LENGTH,
            16, 1, true,
          ]}
        />
        <meshBasicMaterial
          ref={innerMatRef as any}
          color={coreColor}
          transparent
          opacity={0}
          side={DoubleSide}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <group ref={outerHelixRef}>
        <points geometry={outerHelixGeo}>
          <pointsMaterial
            ref={outerHelixMat as any}
            color={beamColor}
            size={0.068}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
            sizeAttenuation
          />
        </points>
      </group>

      <group ref={innerHelixRef}>
        <points geometry={innerHelixGeo}>
          <pointsMaterial
            ref={innerHelixMat as any}
            color={coreColor}
            size={0.052}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
            sizeAttenuation
          />
        </points>
      </group>

      <group position={[0, BEAM_LENGTH, 0]}>
        <group ref={tipRingGroupRef}>
          <mesh
            ref={tipRingRef}
            geometry={tipTorusGeo}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <meshBasicMaterial
              ref={tipRingMat as any}
              color={puffColor}
              transparent
              opacity={0}
              depthWrite={false}
              blending={AdditiveBlending}
            />
          </mesh>
        </group>
        <mesh ref={tipBurstRef}>
          <sphereGeometry args={[coneRadius(1) * 0.65, 10, 8]} />
          <meshBasicMaterial
            ref={tipBurstMat as any}
            color={puffColor}
            transparent
            opacity={0}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}
