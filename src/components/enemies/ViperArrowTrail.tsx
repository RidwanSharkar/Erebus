import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Line, Vector3, BufferGeometry, LineBasicMaterial, AdditiveBlending, BufferAttribute, SphereGeometry, MeshStandardMaterial } from '@/utils/three-exports';

interface ViperArrowTrailProps {
  color: string;
  size: number;
  arrowHeadRef: React.RefObject<Mesh>;
  opacity?: number;
}

const THICKNESS = 1.35;
const MAX_TRAIL_LENGTH = 85;
const GLOW_COUNT = 5;
const SPARK_GROUP_COUNT = 3;
const SPARKS_PER_GROUP = 3;

function ViperArrowTrail({
  color,
  size,
  arrowHeadRef,
  opacity = 1,
}: ViperArrowTrailProps) {
  const trailRef = useRef<Line>(null);
  // Ring buffer: avoids per-frame clone() and O(N) Array.unshift.
  const posRing = useRef<Vector3[]>(Array.from({ length: MAX_TRAIL_LENGTH }, () => new Vector3()));
  const ringHead = useRef(0);
  const ringFill = useRef(0);
  const initialized = useRef(false);
  const glowRefs = useRef<(Mesh | null)[]>([]);
  const sparkRefs = useRef<(Mesh | null)[]>([]);

  const trailGeometry = useMemo(() => {
    const geometry = new BufferGeometry();
    const positions = new Float32Array(MAX_TRAIL_LENGTH * 3);
    const colors = new Float32Array(MAX_TRAIL_LENGTH * 3);
    const indices: number[] = [];

    for (let i = 0; i < MAX_TRAIL_LENGTH; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;

      const alpha = 1 - i / MAX_TRAIL_LENGTH;
      colors[i * 3] = 0.8 * alpha + 0.067 * (1 - alpha);
      colors[i * 3 + 1] = 1.0 * alpha + 0.33 * (1 - alpha);
      colors[i * 3 + 2] = 0.0;
    }

    for (let i = 0; i < MAX_TRAIL_LENGTH - 1; i++) {
      indices.push(i, i + 1);
    }

    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.setIndex(indices);

    return geometry;
  }, []);

  const trailMaterial = useMemo(() => {
    return new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: opacity * 0.95,
      blending: AdditiveBlending,
      depthWrite: false,
      linewidth: 3,
    });
  }, [opacity]);

  const trailLine = useMemo(() => new Line(trailGeometry, trailMaterial), [trailGeometry, trailMaterial]);

  const glowGeos = useMemo(
    () => Array.from({ length: GLOW_COUNT }, (_, i) => new SphereGeometry(size * 2 * (0.3 - i * 0.05) * THICKNESS, 8, 8)),
    [size],
  );
  const glowMats = useMemo(
    () =>
      Array.from({ length: GLOW_COUNT }, (_, i) =>
        new MeshStandardMaterial({
          color,
          emissive: '#aaff44',
          emissiveIntensity: 2 - i * 0.3,
          transparent: true,
          opacity: opacity * (1 - i * 0.2),
          depthWrite: false,
          blending: AdditiveBlending,
          toneMapped: false,
        }),
      ),
    [color, opacity],
  );

  const sparkGeo = useMemo(() => new SphereGeometry(0.032, 4, 4), []);
  const sparkMats = useMemo(
    () =>
      Array.from({ length: SPARK_GROUP_COUNT * SPARKS_PER_GROUP }, (_, i) =>
        new MeshStandardMaterial({
          color: '#aaff44',
          emissive: '#88ff00',
          emissiveIntensity: 3,
          transparent: true,
          opacity: opacity * (1 - Math.floor(i / SPARKS_PER_GROUP) * 0.3),
          depthWrite: false,
          blending: AdditiveBlending,
        }),
      ),
    [opacity],
  );

  const sparkOffsets = useMemo(
    () =>
      Array.from({ length: SPARK_GROUP_COUNT * SPARKS_PER_GROUP }, () => [
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * 0.3,
      ] as [number, number, number]),
    [],
  );

  useEffect(() => {
    return () => {
      trailGeometry.dispose();
      trailMaterial.dispose();
      glowGeos.forEach((g) => g.dispose());
      glowMats.forEach((m) => m.dispose());
      sparkGeo.dispose();
      sparkMats.forEach((m) => m.dispose());
    };
  }, [trailGeometry, trailMaterial, glowGeos, glowMats, sparkGeo, sparkMats]);

  const _scratchPos = useRef(new Vector3());

  useFrame(() => {
    if (!arrowHeadRef.current || !trailRef.current) return;

    const currentPos = _scratchPos.current;
    arrowHeadRef.current.getWorldPosition(currentPos);

    if (currentPos.lengthSq() < 0.01) return;

    if (!initialized.current) {
      for (let i = 0; i < MAX_TRAIL_LENGTH; i++) {
        posRing.current[i].copy(currentPos);
      }
      ringHead.current = 0;
      ringFill.current = MAX_TRAIL_LENGTH;
      initialized.current = true;

      const positions = trailGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < MAX_TRAIL_LENGTH; i++) {
        positions[i * 3] = currentPos.x;
        positions[i * 3 + 1] = currentPos.y;
        positions[i * 3 + 2] = currentPos.z;
      }
      trailGeometry.attributes.position.needsUpdate = true;
    } else {
      // Ring-buffer write.
      ringHead.current = (ringHead.current + MAX_TRAIL_LENGTH - 1) % MAX_TRAIL_LENGTH;
      posRing.current[ringHead.current].copy(currentPos);
      if (ringFill.current < MAX_TRAIL_LENGTH) ringFill.current++;

      const positions = trailGeometry.attributes.position.array as Float32Array;
      const len = ringFill.current;
      const head = ringHead.current;
      for (let i = 0; i < len; i++) {
        const p = posRing.current[(head + i) % MAX_TRAIL_LENGTH];
        positions[i * 3] = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
      }

      trailGeometry.attributes.position.needsUpdate = true;
    }

    const _head = ringHead.current;
    const _ring = posRing.current;
    const _fill = ringFill.current;

    for (let i = 0; i < GLOW_COUNT; i++) {
      const glow = glowRefs.current[i];
      if (glow && i < _fill) {
        glow.position.copy(_ring[(_head + i) % MAX_TRAIL_LENGTH]);
      }
    }

    for (let g = 0; g < SPARK_GROUP_COUNT; g++) {
      if (g >= _fill) continue;
      const groupPos = _ring[(_head + g) % MAX_TRAIL_LENGTH];
      if (!groupPos) continue;
      for (let s = 0; s < SPARKS_PER_GROUP; s++) {
        const idx = g * SPARKS_PER_GROUP + s;
        const spark = sparkRefs.current[idx];
        if (!spark) continue;
        const offset = sparkOffsets[idx];
        spark.position.set(groupPos.x + offset[0], groupPos.y + offset[1], groupPos.z + offset[2]);
      }
    }
  });

  return (
    <group name="viper-arrow-trail">
      <primitive ref={trailRef} object={trailLine} />

      {glowGeos.map((geo, i) => (
        <mesh
          key={`glow-${i}`}
          ref={(el) => {
            glowRefs.current[i] = el;
          }}
          geometry={geo}
          material={glowMats[i]}
        />
      ))}

      {Array.from({ length: SPARK_GROUP_COUNT * SPARKS_PER_GROUP }, (_, i) => (
        <mesh
          key={`spark-${i}`}
          ref={(el) => {
            sparkRefs.current[i] = el;
          }}
          geometry={sparkGeo}
          material={sparkMats[i]}
        />
      ))}
    </group>
  );
}

export default ViperArrowTrail;
