import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  Mesh,
  Line,
  Vector3,
  BufferGeometry,
  LineBasicMaterial,
  AdditiveBlending,
  BufferAttribute,
  SphereGeometry,
  MeshStandardMaterial,
  InstancedMesh,
  Object3D,
} from '@/utils/three-exports';
import { applyArrowTrailDrawRange } from '@/utils/arrowTrailDrawRange';
import {
  INSTANCE_EMISSIVE_ATTR,
  INSTANCE_OPACITY_ATTR,
  enableInstancedMaterialFalloff,
  ensureInstanceFloatAttribute,
} from '@/utils/instancedMaterialFalloff';

interface ChargedArrowTrailProps {
  color: string;
  size: number;
  arrowHeadRef: React.RefObject<Mesh>;
  arrowShaftRef: React.RefObject<Mesh>;
  opacity?: number;
}

const GLOW_COUNT = 5;
const SPARK_GROUP_COUNT = 3;
const SPARKS_PER_GROUP = 3;
const SPARK_COUNT = SPARK_GROUP_COUNT * SPARKS_PER_GROUP;

const _dummy = new Object3D();

function ChargedArrowTrail({
  color,
  size,
  arrowHeadRef,
  arrowShaftRef,
  opacity = 1,
}: ChargedArrowTrailProps) {
  const trailRef = useRef<Line>(null);
  const maxTrailLength = 75;
  // Ring buffer: avoids per-frame clone() and O(N) Array.unshift.
  const posRing = useRef<Vector3[]>(Array.from({ length: maxTrailLength }, () => new Vector3()));
  const ringHead = useRef(0);
  const ringFill = useRef(0);
  const initialized = useRef(false);
  const glowMeshRef = useRef<InstancedMesh>(null);
  const sparkMeshRef = useRef<InstancedMesh>(null);

  const trailGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(maxTrailLength * 3);
    const colors = new Float32Array(maxTrailLength * 3);
    const indices = [];

    for (let i = 0; i < maxTrailLength; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      const alpha = 1 - i / maxTrailLength;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.6 * alpha;
      colors[i * 3 + 2] = 0.0;
    }

    for (let i = 0; i < maxTrailLength - 1; i++) {
      indices.push(i, i + 1);
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.setDrawRange(0, 0);

    return geometry;
  }, [maxTrailLength]);

  const trailMaterial = useMemo(() => {
    return new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity * 0.8,
      blending: AdditiveBlending,
      depthWrite: false,
      linewidth: 3,
    });
  }, [opacity]);

  const trailLine = useMemo(() => {
    const line = new Line(trailGeometry, trailMaterial);
    line.visible = false;
    line.frustumCulled = false;
    return line;
  }, [trailGeometry, trailMaterial]);

  // Unit sphere — per-instance scale reproduces former glowGeos radii: size*2*(0.3 - i*0.05)
  const glowGeo = useMemo(() => {
    const geo = new SphereGeometry(1, 8, 8);
    ensureInstanceFloatAttribute(geo, INSTANCE_OPACITY_ATTR, GLOW_COUNT, 1);
    ensureInstanceFloatAttribute(geo, INSTANCE_EMISSIVE_ATTR, GLOW_COUNT, 1);
    return geo;
  }, []);
  const glowMat = useMemo(
    () =>
      enableInstancedMaterialFalloff(
        new MeshStandardMaterial({
          color,
          emissive: color,
          // Base intensity 1; absolute (2 - i*0.3) is written per instance.
          emissiveIntensity: 1,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
        { emissive: true },
      ),
    [color, opacity],
  );

  const sparkGeo = useMemo(() => {
    const geo = new SphereGeometry(0.02, 4, 4);
    ensureInstanceFloatAttribute(geo, INSTANCE_OPACITY_ATTR, SPARK_COUNT, 1);
    return geo;
  }, []);
  const sparkMat = useMemo(
    () =>
      enableInstancedMaterialFalloff(
        new MeshStandardMaterial({
          color: '#ffcc00',
          emissive: '#ff8800',
          emissiveIntensity: 3,
          transparent: true,
          opacity,
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      ),
    [opacity],
  );

  const sparkOffsets = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, () => [
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
      ] as [number, number, number]),
    [],
  );

  // Per-glow scale factors matching former SphereGeometry radii only (not opacity).
  const glowScales = useMemo(
    () => Array.from({ length: GLOW_COUNT }, (_, i) => size * 2 * (0.3 - i * 0.05)),
    [size],
  );

  useEffect(() => {
    return () => {
      trailLine.visible = false;
      trailGeometry.setDrawRange(0, 0);
      trailGeometry.dispose();
      trailMaterial.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      sparkGeo.dispose();
      sparkMat.dispose();
    };
  }, [trailGeometry, trailMaterial, trailLine, glowGeo, glowMat, sparkGeo, sparkMat]);

  const _scratchPos = useRef(new Vector3());

  useFrame(() => {
    if (!arrowHeadRef.current || !trailRef.current) return;

    const currentPos = _scratchPos.current;
    arrowHeadRef.current.getWorldPosition(currentPos);

    if (currentPos.lengthSq() < 0.01) return;

    if (!initialized.current) {
      for (let i = 0; i < maxTrailLength; i++) {
        posRing.current[i].copy(currentPos);
      }
      ringHead.current = 0;
      ringFill.current = maxTrailLength;
      initialized.current = true;

      const positions = trailGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < maxTrailLength; i++) {
        positions[i * 3] = currentPos.x;
        positions[i * 3 + 1] = currentPos.y;
        positions[i * 3 + 2] = currentPos.z;
      }
      trailGeometry.attributes.position.needsUpdate = true;
      applyArrowTrailDrawRange(trailGeometry, maxTrailLength);
      if (trailRef.current) trailRef.current.visible = true;
    } else {
      // Ring-buffer write.
      ringHead.current = (ringHead.current + maxTrailLength - 1) % maxTrailLength;
      posRing.current[ringHead.current].copy(currentPos);
      if (ringFill.current < maxTrailLength) ringFill.current++;

      const positions = trailGeometry.attributes.position.array as Float32Array;
      const len = ringFill.current;
      const head = ringHead.current;
      for (let i = 0; i < len; i++) {
        const p = posRing.current[(head + i) % maxTrailLength];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }

      trailGeometry.attributes.position.needsUpdate = true;
      applyArrowTrailDrawRange(trailGeometry, len);
      if (trailRef.current) trailRef.current.visible = len >= 2;
    }

    const _head = ringHead.current;
    const _ring = posRing.current;
    const _fill = ringFill.current;

    const glowMesh = glowMeshRef.current;
    if (glowMesh) {
      const opacityAttr = ensureInstanceFloatAttribute(
        glowMesh.geometry,
        INSTANCE_OPACITY_ATTR,
        GLOW_COUNT,
        1,
      );
      const emissiveAttr = ensureInstanceFloatAttribute(
        glowMesh.geometry,
        INSTANCE_EMISSIVE_ATTR,
        GLOW_COUNT,
        1,
      );
      const opacityArr = opacityAttr.array as Float32Array;
      const emissiveArr = emissiveAttr.array as Float32Array;

      for (let i = 0; i < GLOW_COUNT; i++) {
        if (i < _fill) {
          const p = _ring[(_head + i) % maxTrailLength];
          // Original per-mesh: opacity * (1 - i*0.2), emissiveIntensity 2 - i*0.3
          opacityArr[i] = 1 - i * 0.2;
          emissiveArr[i] = 2 - i * 0.3;
          _dummy.position.copy(p);
          _dummy.scale.setScalar(glowScales[i]);
          _dummy.rotation.set(0, 0, 0);
          _dummy.updateMatrix();
          glowMesh.setMatrixAt(i, _dummy.matrix);
        } else {
          opacityArr[i] = 0;
          emissiveArr[i] = 0;
          _dummy.position.set(0, -9999, 0);
          _dummy.scale.setScalar(0);
          _dummy.updateMatrix();
          glowMesh.setMatrixAt(i, _dummy.matrix);
        }
      }
      opacityAttr.needsUpdate = true;
      emissiveAttr.needsUpdate = true;
      glowMesh.instanceMatrix.needsUpdate = true;
    }

    const sparkMesh = sparkMeshRef.current;
    if (sparkMesh) {
      const opacityAttr = ensureInstanceFloatAttribute(
        sparkMesh.geometry,
        INSTANCE_OPACITY_ATTR,
        SPARK_COUNT,
        1,
      );
      const opacityArr = opacityAttr.array as Float32Array;

      for (let g = 0; g < SPARK_GROUP_COUNT; g++) {
        const groupPos = g < _fill ? _ring[(_head + g) % maxTrailLength] : null;
        // Original per-group material opacity: opacity * (1 - group * 0.3)
        const groupOpacityFactor = 1 - g * 0.3;
        for (let s = 0; s < SPARKS_PER_GROUP; s++) {
          const idx = g * SPARKS_PER_GROUP + s;
          if (groupPos) {
            const offset = sparkOffsets[idx];
            opacityArr[idx] = groupOpacityFactor;
            _dummy.position.set(groupPos.x + offset[0], groupPos.y + offset[1], groupPos.z + offset[2]);
            _dummy.scale.setScalar(1);
            _dummy.rotation.set(0, 0, 0);
            _dummy.updateMatrix();
            sparkMesh.setMatrixAt(idx, _dummy.matrix);
          } else {
            opacityArr[idx] = 0;
            _dummy.position.set(0, -9999, 0);
            _dummy.scale.setScalar(0);
            _dummy.updateMatrix();
            sparkMesh.setMatrixAt(idx, _dummy.matrix);
          }
        }
      }
      opacityAttr.needsUpdate = true;
      sparkMesh.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <group name="charged-arrow-trail">
      <primitive ref={trailRef} object={trailLine} />

      <instancedMesh
        ref={glowMeshRef}
        args={[glowGeo, glowMat, GLOW_COUNT]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={sparkMeshRef}
        args={[sparkGeo, sparkMat, SPARK_COUNT]}
        frustumCulled={false}
      />
    </group>
  );
}

export default ChargedArrowTrail;
