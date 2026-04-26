import React, { useMemo, useRef, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Group, Quaternion, Vector3, Matrix4, Euler } from '@/utils/three-exports';
import {
  FOREST_CANOPY_TIERS,
  createForestTrunkTaperedSegmentGeometries,
  createForestCanopyGeometries,
  createForestShadowDiscGeometry,
  createForestTrunkShaderMaterial,
  createForestCanopyShaderMaterials,
  createForestShadowMaterial,
  DEFAULT_FOREST_PALETTE,
  getForestSingleTreeLayoutFromId,
} from '@/components/environment/forestTreeVisual';

const TRUNK_SEGMENTS = 5;
const CYL_H = 3.25;
const CYL_HALF = CYL_H * 0.5;
const WINDUP_TILT = -0.72;
const TILT_SMOOTH = 10;
const SLAM_FORWARD_TILT = 1.1;
const SLAM_FWD_SMOOTH = 30;
const SLAM_RBD_SMOOTH = 8;

export interface TentacleSpineRendererProps {
  id: string;
  position: Vector3;
  rotation: number;
  isDying: boolean;
  windSeq: number;
  slamSeq: number;
  windDirXZ: { x: number; z: number };
}

const _axis = new Vector3();
const _dir = new Vector3();
const _qTarget = new Quaternion();
const _qCur = new Quaternion();

function segmentBendWeight(i: number, n: number): number {
  if (n <= 1) return 1;
  const t = i / (n - 1);
  return 0.08 + 0.92 * t * t;
}

const TentacleSpineRenderer: React.FC<TentacleSpineRendererProps> = ({
  id,
  position,
  rotation,
  isDying,
  windSeq,
  slamSeq,
  windDirXZ,
}) => {
  const segmentGroupRefs = useRef<(Group | null)[]>([]);
  const shadowRef = useRef<Mesh>(null);
  const trunkMeshRefs = useRef<(Mesh | null)[]>([]);
  const canopyRefs = useRef<(Mesh | null)[]>([]);

  const tiltRef = useRef(0);
  const tiltTargetRef = useRef(0);
  const lastWindSeq = useRef(0);
  const lastSlamSeq = useRef(0);
  const leanDirRef = useRef({ x: 0, z: 1 });
  const slamPhaseRef = useRef<'idle' | 'fwd' | 'rebound'>('idle');
  const slamReboundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layout = useMemo(() => getForestSingleTreeLayoutFromId(id), [id]);
  const { trunkH, trunkR, canopyR, rotAngle } = layout;

  const palette = DEFAULT_FOREST_PALETTE;
  const trunkGeos = useMemo(
    () => createForestTrunkTaperedSegmentGeometries(TRUNK_SEGMENTS, trunkR),
    [trunkR],
  );
  const canopyGeos = useMemo(() => createForestCanopyGeometries(), []);
  const shadowGeo = useMemo(() => createForestShadowDiscGeometry(), []);

  const trunkMat = useMemo(() => createForestTrunkShaderMaterial(palette, false), []);
  const canopyMats = useMemo(() => createForestCanopyShaderMaterials(palette, false), []);
  const shadowMat = useMemo(() => createForestShadowMaterial(false), []);

  const segLayout = useMemo(() => {
    const n = TRUNK_SEGMENTS;
    const hWorld = CYL_H * trunkH;
    const segH = hWorld / n;
    const baseCenterY = trunkH * 0.25 + 1.0;
    const baseBottomY = baseCenterY - CYL_HALF * trunkH;
    const meshCenterLocalY = CYL_HALF * (trunkH / n);
    const dStack = segH;
    const trunkTopY = baseCenterY + CYL_HALF * trunkH;
    return { n, baseBottomY, meshCenterLocalY, dStack, trunkTopY };
  }, [trunkH]);

  const segmentTrunkMatrices = useMemo(() => {
    const n = TRUNK_SEGMENTS;
    const { meshCenterLocalY } = segLayout;
    const rotY = new Matrix4().makeRotationY(rotAngle);
    const s = new Vector3();
    return Array.from({ length: n }, () => {
      const m = new Matrix4();
      s.set(1, trunkH / n, 1);
      m.makeScale(s.x, s.y, s.z);
      m.premultiply(rotY);
      m.setPosition(0, meshCenterLocalY, 0);
      return m;
    });
  }, [trunkH, rotAngle, segLayout]);

  const canopyMatrices = useMemo(() => {
    const rotMat = new Matrix4();
    const s = new Vector3();
    const { trunkTopY } = segLayout;
    return FOREST_CANOPY_TIERS.map((tier, ti) => {
      const cR = canopyR * tier.rScale;
      let xOff = 0,
        zOff = 0;
      if (ti === 1) xOff = canopyR * 0.22;
      if (ti === 2) {
        xOff = -canopyR * 0.15;
        zOff = canopyR * 0.1;
      }
      const cos = Math.cos(rotAngle),
        sin = Math.sin(rotAngle);
      const rxOff = xOff * cos - zOff * sin;
      const rzOff = xOff * sin + zOff * cos;
      const sphereY = trunkH + canopyR * (tier.yFrac * 0.8) + cR * 0.15;
      const m = new Matrix4();
      s.set(cR, cR, cR);
      m.makeScale(s.x, s.y, s.z);
      rotMat.makeRotationY(rotAngle + ti * 0.9);
      m.premultiply(rotMat);
      m.setPosition(rxOff, sphereY - trunkTopY, rzOff);
      return m;
    });
  }, [canopyR, trunkH, rotAngle, segLayout]);

  const shadowR = canopyR * 0.95;
  const shadowMatrix = useMemo(() => {
    const m = new Matrix4();
    const rotY = new Matrix4().makeRotationY(rotAngle);
    const s = new Vector3();
    s.set(shadowR, 1, shadowR * 0.75);
    m.makeScale(s.x, s.y, s.z);
    m.premultiply(rotY);
    m.premultiply(new Matrix4().makeRotationX(-Math.PI * 0.5));
    m.setPosition(0, 0.02, 0);
    return m;
  }, [shadowR, rotAngle]);

  useEffect(
    () => () => {
      if (slamReboundTimer.current) clearTimeout(slamReboundTimer.current);
      trunkGeos.forEach((g) => g.dispose());
      canopyGeos.forEach((g) => g.dispose());
      shadowGeo.dispose();
      trunkMat.dispose();
      canopyMats.forEach((m) => m.dispose());
      shadowMat.dispose();
    },
    [trunkGeos, canopyGeos, shadowGeo, trunkMat, canopyMats, shadowMat],
  );

  useLayoutEffect(() => {
    if (windSeq > lastWindSeq.current) {
      lastWindSeq.current = windSeq;
      tiltTargetRef.current = WINDUP_TILT;
      leanDirRef.current = { x: windDirXZ.x, z: windDirXZ.z };
    }
  }, [windSeq, windDirXZ.x, windDirXZ.z]);

  useLayoutEffect(() => {
    if (slamSeq > lastSlamSeq.current) {
      lastSlamSeq.current = slamSeq;
      if (slamReboundTimer.current) clearTimeout(slamReboundTimer.current);
      tiltTargetRef.current = SLAM_FORWARD_TILT;
      slamPhaseRef.current = 'fwd';
      slamReboundTimer.current = setTimeout(() => {
        tiltTargetRef.current = 0;
        slamPhaseRef.current = 'rebound';
      }, 220);
    }
  }, [slamSeq]);

  useLayoutEffect(() => {
    for (let i = 0; i < TRUNK_SEGMENTS; i++) {
      const mesh = trunkMeshRefs.current[i];
      if (mesh) {
        mesh.matrix.copy(segmentTrunkMatrices[i]!);
        mesh.matrixAutoUpdate = false;
      }
    }
    shadowRef.current?.matrix.copy(shadowMatrix);
    if (shadowRef.current) shadowRef.current.matrixAutoUpdate = false;
  }, [segmentTrunkMatrices, shadowMatrix]);

  useLayoutEffect(() => {
    canopyMatrices.forEach((cm, ti) => {
      const m = canopyRefs.current[ti];
      if (m) {
        m.matrix.copy(cm);
        m.matrixAutoUpdate = false;
      }
    });
  }, [canopyMatrices]);

  useFrame((_, delta) => {
    trunkMat.uniforms.uTime.value += delta;
    canopyMats.forEach((m) => {
      m.uniforms.uTime.value += delta;
    });

    const target = tiltTargetRef.current;
    const smoothFactor =
      slamPhaseRef.current === 'fwd' ? SLAM_FWD_SMOOTH :
      slamPhaseRef.current === 'rebound' ? SLAM_RBD_SMOOTH :
      TILT_SMOOTH;
    tiltRef.current += (target - tiltRef.current) * Math.min(1, delta * smoothFactor);

    const ld = leanDirRef.current;
    _dir.set(ld.x, 0, ld.z);
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 0, 1);
    _dir.normalize();
    _axis.set(-_dir.z, 0, _dir.x).normalize();
    const n = TRUNK_SEGMENTS;
    for (let i = 0; i < n; i++) {
      const g = segmentGroupRefs.current[i];
      if (!g) continue;
      const w = segmentBendWeight(i, n);
      const localAngle = tiltRef.current * w;
      _qTarget.setFromAxisAngle(_axis, localAngle);
      _qCur.copy(g.quaternion);
      _qCur.slerp(_qTarget, Math.min(1, delta * 16));
      g.quaternion.copy(_qCur);
    }

    if (isDying) {
      const op = Math.max(0, (trunkMat.opacity ?? 1) - delta * 2.2);
      trunkMat.transparent = true;
      trunkMat.opacity = op;
      canopyMats.forEach((m) => {
        m.transparent = true;
        m.opacity = op;
      });
      shadowMat.opacity = op * 0.38;
    }
  });

  const { baseBottomY, dStack } = segLayout;

  const TrunkChain = useMemo(
    () =>
      function TrunkChainInner({ depth }: { depth: number }) {
        if (depth >= TRUNK_SEGMENTS) return null;
        const isLast = depth === TRUNK_SEGMENTS - 1;
        return (
          <group
            key={`${id}-tseg-${depth}`}
            ref={(el) => {
              segmentGroupRefs.current[depth] = el;
            }}
          >
            <mesh
              ref={(el) => {
                trunkMeshRefs.current[depth] = el;
              }}
              geometry={trunkGeos[depth]!}
              material={trunkMat}
            />
            {isLast ? (
              <group position={[0, dStack, 0]}>
                {FOREST_CANOPY_TIERS.map((_, ti) => (
                  <mesh
                    key={`${id}-canopy-${ti}`}
                    ref={(el) => {
                      canopyRefs.current[ti] = el;
                    }}
                    geometry={canopyGeos[ti]}
                    material={canopyMats[ti]}
                  />
                ))}
              </group>
            ) : (
              <group position={[0, dStack, 0]}>
                <TrunkChainInner depth={depth + 1} />
              </group>
            )}
          </group>
        );
      },
    [canopyGeos, canopyMats, dStack, id, trunkGeos, trunkMat],
  );

  return (
    <group position={position} rotation={new Euler(0, rotation, 0)}>
      <mesh ref={shadowRef} geometry={shadowGeo} material={shadowMat} />
      <group position={[0, baseBottomY, 0]}>
        <TrunkChain depth={0} />
      </group>
    </group>
  );
};

export default React.memo(TentacleSpineRenderer);
