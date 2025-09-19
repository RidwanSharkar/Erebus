import React, { useRef } from 'react';
import { Group, MeshStandardMaterial, CylinderGeometry, ConeGeometry, PlaneGeometry, SphereGeometry } from 'three';

const SHARED_MATERIALS = {
  bone: new MeshStandardMaterial({
    color: "#D2B48C",
    roughness: 1,
    metalness: 0
  }),
  spikes: new MeshStandardMaterial({
    color: "#BC8F8F",
    roughness: 1,
    metalness: 0
  }),
  runes: new MeshStandardMaterial({
    color: "#00ff88",
    emissive: "#00ff88",
    transparent: true,
    opacity: 0.9
  }),
  crown: new MeshStandardMaterial({
    color: "#DEB887",
    roughness: 1,
    metalness: 0
  })
};

const SHARED_GEOMETRIES = {
  tower: new CylinderGeometry(0.6, 0.8, 4, 8),
  spike: new ConeGeometry(0.2, 0.8, 4),
  rune: new PlaneGeometry(0.2, 0.2),
  crown: new ConeGeometry(0.15, 1.2, 4),
  eye: new SphereGeometry(0.3, 32, 32),
  base: new CylinderGeometry(1, 1.2, 0.6, 8),
  lightning: new SphereGeometry(0.1, 16, 16)
};

interface TotemModelProps {
  isAttacking: boolean;
}

export default function TotemModel({ isAttacking }: TotemModelProps) {
  const totemRef = useRef<Group>(null);

  return (
    <group ref={totemRef} scale={0.40} position={[0, -0.80, 0]}>
      {/* Main tower structure */}
      <mesh position={[0, 2, 0]}>
        <primitive object={SHARED_GEOMETRIES.tower} />
        <primitive object={SHARED_MATERIALS.bone} />
      </mesh>

      {/* Jagged spikes around the structure */}
      {[...Array(12)].map((_, i) => (
        <group key={i} rotation={[0, (-Math.PI  * i) / 12, Math.PI * 0.25]} position={[0, 2.5, 0]}>
          <mesh position={[0.7, Math.sin(i * 3) * 0.5, 0]} rotation={[Math.PI/3, 0, -Math.PI * 0.25]}>
            <primitive object={SHARED_GEOMETRIES.spike} />
            <primitive object={SHARED_MATERIALS.spikes} />
          </mesh>
        </group>
      ))}

      {/* Glowing rune circles */}
      {[0.5, 1.5, 2.5, 3.5].map((height, i) => (
        <group key={i} position={[0, height, 0]}>
          <mesh>
            <torusGeometry args={[0.7, 0.05, 16, 32]} />
            <primitive object={SHARED_MATERIALS.runes} emissiveIntensity={isAttacking ? 3 : 1} />
          </mesh>
          {/* Floating rune symbols */}
          {[...Array(4)].map((_, j) => (
            <mesh
              key={j}
              position={[
                Math.cos((Math.PI * 2 * j) / 4) * 0.7,
                Math.sin(Date.now() * 0.001 + j) * 0.1,
                Math.sin((Math.PI * 2 * j) / 4) * 0.7
              ]}
            >
              <primitive object={SHARED_GEOMETRIES.rune} />
              <primitive object={SHARED_MATERIALS.runes} emissiveIntensity={isAttacking ? 4 : 2} opacity={0.8} side={2} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Top crown structure */}
      <group position={[0, 4, 0]}>
        {[...Array(8)].map((_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos((Math.PI * 2 * i) / 8) * 0.5,
              0.3,
              Math.sin((Math.PI * 2 * i) / 8) * 0.5
            ]}
            rotation={[
              Math.random() * 0.2,
              (Math.PI * 2 * i) / 8,
              Math.PI * 0.15
            ]}
          >
            <primitive object={SHARED_GEOMETRIES.crown} />
            <primitive object={SHARED_MATERIALS.crown} />
          </mesh>
        ))}

        {/* Central eye */}
        <mesh position={[0, 0.5, 0]}>
          <primitive object={SHARED_GEOMETRIES.eye} />
          <primitive object={SHARED_MATERIALS.runes} emissiveIntensity={isAttacking ? 5 : 3} />
        </mesh>
      </group>

      {/* Base structure */}
      <mesh position={[0, 0.3, 0]}>
        <primitive object={SHARED_GEOMETRIES.base} />
        <primitive object={SHARED_MATERIALS.bone} />
      </mesh>

      {/* Lightning effects when attacking */}
      {isAttacking && [...Array(4)].map((_, i) => (
        <mesh
          key={i}
          position={[
            Math.cos((Math.PI * 2 * i) / 4) * 1,
            2,
            Math.sin((Math.PI * 2 * i) / 4) * 1
          ]}
        >
          <primitive object={SHARED_GEOMETRIES.lightning} />
          <primitive object={SHARED_MATERIALS.runes} emissiveIntensity={5} opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}
