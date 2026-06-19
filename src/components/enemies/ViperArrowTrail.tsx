import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, Line, Vector3, BufferGeometry, LineBasicMaterial, AdditiveBlending, BufferAttribute } from '@/utils/three-exports';

interface ViperArrowTrailProps {
  color: string;
  size: number;
  arrowHeadRef: React.RefObject<Mesh>;
  opacity?: number;
}

const THICKNESS = 1.35;
const MAX_TRAIL_LENGTH = 85;

function ViperArrowTrail({
  color,
  size,
  arrowHeadRef,
  opacity = 1,
}: ViperArrowTrailProps) {
  const trailRef = useRef<Line>(null);
  const trailPositions = useRef<Vector3[]>([]);
  const initialized = useRef(false);

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
      // Bright lime (#ccff00) → mid green (#22aa00) → dark green (#115500)
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

  useEffect(() => {
    return () => {
      trailGeometry.dispose();
      trailMaterial.dispose();
    };
  }, [trailGeometry, trailMaterial]);

  const _scratchPos = useRef(new Vector3());

  useFrame(() => {
    if (!arrowHeadRef.current || !trailRef.current) return;

    const currentPos = _scratchPos.current;
    arrowHeadRef.current.getWorldPosition(currentPos);

    if (currentPos.lengthSq() < 0.01) return;

    if (!initialized.current) {
      for (let i = 0; i < MAX_TRAIL_LENGTH; i++) {
        trailPositions.current.push(currentPos.clone());
      }
      initialized.current = true;

      const positions = trailGeometry.attributes.position.array as Float32Array;
      for (let i = 0; i < MAX_TRAIL_LENGTH; i++) {
        positions[i * 3] = currentPos.x;
        positions[i * 3 + 1] = currentPos.y;
        positions[i * 3 + 2] = currentPos.z;
      }
      trailGeometry.attributes.position.needsUpdate = true;
      return;
    }

    trailPositions.current.unshift(currentPos);

    if (trailPositions.current.length > MAX_TRAIL_LENGTH) {
      trailPositions.current.pop();
    }

    const positions = trailGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < trailPositions.current.length; i++) {
      const pos = trailPositions.current[i];
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
    }

    trailGeometry.attributes.position.needsUpdate = true;
  });

  return (
    <group name="viper-arrow-trail">
      <primitive ref={trailRef} object={trailLine} />

      {trailPositions.current.slice(0, 5).map((pos, index) => (
        <mesh key={index} position={pos}>
          <sphereGeometry args={[size * 2 * (0.3 - index * 0.05) * THICKNESS, 8, 8]} />
          <meshStandardMaterial
            color={color}
            emissive="#aaff44"
            emissiveIntensity={2 - index * 0.3}
            transparent
            opacity={opacity * (1 - index * 0.2)}
            depthWrite={false}
            blending={AdditiveBlending}
            toneMapped={false}
          />
        </mesh>
      ))}

      {trailPositions.current.slice(0, 3).map((pos, index) => (
        <group key={`spark-${index}`} position={pos}>
          {[0, 1, 2].map((sparkIndex) => (
            <mesh
              key={sparkIndex}
              position={[
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
                (Math.random() - 0.5) * 0.3,
              ]}
            >
              <sphereGeometry args={[0.032, 4, 4]} />
              <meshStandardMaterial
                color="#aaff44"
                emissive="#88ff00"
                emissiveIntensity={3}
                transparent
                opacity={opacity * (1 - index * 0.3)}
                depthWrite={false}
                blending={AdditiveBlending}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

export default ViperArrowTrail;
