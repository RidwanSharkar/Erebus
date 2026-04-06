import React, { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  Vector3,
} from '@/utils/three-exports';
import { shaderRegistry } from '@/utils/shaderRegistry';

// Interface for tracking active perimeter clouds
interface PerimeterCloud {
  id: number;
  origin: Vector3;
  direction: Vector3;
  startTime: number;
  duration: number;
  scale: number;
  spread: number;
  height: number;
  speed: number;
  rotationSpeed: number;
  rotationOffset: number;
}

interface PerimeterCloudParticlesProps {
  cloud: PerimeterCloud;
  geometry: BufferGeometry;
}

const PerimeterCloudParticles: React.FC<PerimeterCloudParticlesProps> = ({ cloud, geometry }) => {
  const materialRef = useRef<ShaderMaterial>(null!);

  const material = useMemo(() => {
    const precompiledMaterial = shaderRegistry.getShader('perimeterCloud');
    if (precompiledMaterial) {
      precompiledMaterial.uniforms.uDuration.value = cloud.duration;
      precompiledMaterial.uniforms.uCloudOrigin.value.copy(cloud.origin);
      precompiledMaterial.uniforms.uCloudDirection.value.copy(cloud.direction);
      precompiledMaterial.uniforms.uScale.value = cloud.scale;
      precompiledMaterial.uniforms.uSpread.value = cloud.spread;
      precompiledMaterial.uniforms.uHeight.value = cloud.height;
      precompiledMaterial.uniforms.uSpeed.value = cloud.speed;
      precompiledMaterial.uniforms.uRotationSpeed.value = cloud.rotationSpeed;
      precompiledMaterial.uniforms.uRotationOffset.value = cloud.rotationOffset;
      precompiledMaterial.needsUpdate = true;
    }
    return precompiledMaterial;
  }, [
    cloud.origin,
    cloud.direction,
    cloud.duration,
    cloud.scale,
    cloud.spread,
    cloud.height,
    cloud.speed,
    cloud.rotationSpeed,
    cloud.rotationOffset,
  ]);

  useEffect(() => {
    return () => {
      if (material) {
        material.dispose();
      }
    };
  }, [material]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = t;
      materialRef.current.uniforms.uCloudTime.value = t - cloud.startTime;
    }
  });

  if (!material) return null;

  return (
    <points geometry={geometry}>
      <primitive object={material} attach="material" ref={materialRef} />
    </points>
  );
};

interface PerimeterCloudSystemProps {
  radius: number;
}

const PerimeterCloudSystem: React.FC<PerimeterCloudSystemProps> = ({ radius }) => {
  const [activeClouds, setActiveClouds] = useState<PerimeterCloud[]>([]);
  const cloudIdCounterRef = useRef(0);
  const lastCloudTimeRef = useRef(0);

  const spawnCloud = useCallback(
    (currentTime: number) => {
      const angle = Math.random() * Math.PI * 2;
      const perimeterOffset = (Math.random() - 0.5) * 2.0;
      const distance = radius + perimeterOffset;

      const origin = new Vector3(
        Math.cos(angle) * distance,
        0.2 + Math.random() * 0.3,
        Math.sin(angle) * distance
      );

      const direction = new Vector3(
        Math.cos(angle) * 0.2,
        0.85 + Math.random() * 0.15,
        Math.sin(angle) * 0.2
      );
      direction.normalize();

      const sizeRoll = Math.random();
      let scale: number;
      if (sizeRoll < 0.5) {
        scale = 0.5 + Math.random() * 0.5;
      } else if (sizeRoll < 0.8) {
        scale = 1.0 + Math.random() * 0.5;
      } else {
        scale = 1.5 + Math.random() * 0.3;
      }

      const spreadRoll = Math.random();
      let spread: number;
      if (spreadRoll < 0.4) {
        spread = 0.3 + Math.random() * 0.3;
      } else if (spreadRoll < 0.7) {
        spread = 0.6 + Math.random() * 0.3;
      } else {
        spread = 0.9 + Math.random() * 0.3;
      }

      const heightRoll = Math.random();
      let cloudHeight: number;
      if (heightRoll < 0.3) {
        cloudHeight = 0.8 + Math.random() * 0.4;
      } else if (heightRoll < 0.7) {
        cloudHeight = 1.2 + Math.random() * 0.5;
      } else {
        cloudHeight = 1.7 + Math.random() * 0.3;
      }

      const speed = 0.3 + Math.random() * 0.5;
      const rotationSpeed = 0.1 + Math.random() * 0.7;
      const rotationOffset = Math.random() * Math.PI * 2;

      const baseDuration = 3.0 + Math.random() * 2.0;
      const duration =
        baseDuration * (0.9 + cloudHeight * 0.1) * (0.95 + scale * 0.05);

      const newCloud: PerimeterCloud = {
        id: cloudIdCounterRef.current++,
        origin,
        direction,
        startTime: currentTime,
        duration,
        scale,
        spread,
        height: cloudHeight,
        speed,
        rotationSpeed,
        rotationOffset,
      };

      setActiveClouds((prev) => [...prev, newCloud]);
    },
    [radius]
  );

  const cloudGeometry = useMemo(() => {
    const particleCount = 17;
    const positions = new Float32Array(particleCount * 3);
    const randoms = new Float32Array(particleCount);
    const particleIndices = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      randoms[i] = Math.random();
      particleIndices[i] = i / particleCount;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new Float32BufferAttribute(randoms, 1));
    geometry.setAttribute('aParticleIndex', new Float32BufferAttribute(particleIndices, 1));

    return geometry;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const timeSinceLastCloud = t - lastCloudTimeRef.current;

    if (timeSinceLastCloud > 0.25 + Math.random() * 1.0 || lastCloudTimeRef.current === 0) {
      const cloudCount = 14 + Math.floor(Math.random() * 10);
      for (let i = 0; i < cloudCount; i++) {
        setTimeout(() => spawnCloud(t + i * 0.1), i * 100);
      }
      lastCloudTimeRef.current = t;
    }

    setActiveClouds((prev) => prev.filter((cloud) => t - cloud.startTime < cloud.duration + 1.0));
  });

  return (
    <group name="perimeter-clouds">
      {activeClouds.map((cloud) => (
        <PerimeterCloudParticles key={cloud.id} cloud={cloud} geometry={cloudGeometry} />
      ))}
    </group>
  );
};

export default PerimeterCloudSystem;
