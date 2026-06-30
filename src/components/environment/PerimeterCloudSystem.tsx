import React, { useRef, useMemo, useState, useCallback, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  Float32BufferAttribute,
  ShaderMaterial,
  Vector3,
} from '@/utils/three-exports';
import { shaderRegistry } from '@/utils/shaderRegistry';
import type { RoomBorderTheme } from './SimpleBorderEffects';

/** Perimeter cloud tint — gold matches prep throne; red for boss arenas. */
export type PerimeterCloudTheme = 'gold' | RoomBorderTheme;

const CLOUD_PALETTE: Record<
  PerimeterCloudTheme,
  { deep: [number, number, number]; bright: [number, number, number]; hot: [number, number, number] }
> = {
  gold: {
    deep: [0.6, 0.45, 0.05],
    bright: [1.0, 0.82, 0.25],
    hot: [1.0, 0.95, 0.55],
  },
  red: {
    deep: [0.45, 0.02, 0.02],
    bright: [0.969, 0.31, 0.31],
    hot: [1.0, 0.35, 0.3],
  },
  blue: {
    deep: [0.05, 0.2, 0.45],
    bright: [0.5, 0.78, 1.0],
    hot: [0.72, 0.89, 1.0],
  },
  green: {
    deep: [0.04, 0.25, 0.08],
    bright: [0.29, 0.87, 0.5],
    hot: [0.55, 1.0, 0.65],
  },
  purple: {
    deep: [0.2, 0.05, 0.35],
    bright: [0.54, 0.17, 0.89],
    hot: [0.87, 0.63, 0.87],
  },
};

const MAX_ACTIVE_CLOUDS = 48;

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
  cloudTheme: PerimeterCloudTheme;
}

const PerimeterCloudParticles: React.FC<PerimeterCloudParticlesProps> = ({
  cloud,
  geometry,
  cloudTheme,
}) => {
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

  useLayoutEffect(() => {
    if (!material) return;
    const palette = CLOUD_PALETTE[cloudTheme] ?? CLOUD_PALETTE.gold;
    material.uniforms.uDeepColor.value.set(...palette.deep);
    material.uniforms.uBrightColor.value.set(...palette.bright);
    material.uniforms.uHotCoreColor.value.set(...palette.hot);
  }, [material, cloudTheme]);

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
  /** Defaults to gold (prep throne). Boss arenas use red. */
  cloudTheme?: PerimeterCloudTheme;
}

function buildCloudParams(radius: number, startTime: number, id: number): PerimeterCloud {
  const angle = Math.random() * Math.PI * 2;
  const perimeterOffset = (Math.random() - 0.5) * 2.0;
  const distance = radius + perimeterOffset;

  const origin = new Vector3(
    Math.cos(angle) * distance,
    0.2 + Math.random() * 0.3,
    Math.sin(angle) * distance,
  );

  const direction = new Vector3(
    Math.cos(angle) * 0.2,
    0.85 + Math.random() * 0.15,
    Math.sin(angle) * 0.2,
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
  const duration = baseDuration * (0.9 + cloudHeight * 0.1) * (0.95 + scale * 0.05);

  return {
    id,
    origin,
    direction,
    startTime,
    duration,
    scale,
    spread,
    height: cloudHeight,
    speed,
    rotationSpeed,
    rotationOffset,
  };
}

const PerimeterCloudSystem: React.FC<PerimeterCloudSystemProps> = ({
  radius,
  cloudTheme = 'gold',
}) => {
  const activeCloudsRef = useRef<PerimeterCloud[]>([]);
  const [cloudVersion, setCloudVersion] = useState(0);
  const cloudIdCounterRef = useRef(0);
  const lastCloudTimeRef = useRef(0);
  const mountedRef = useRef(true);
  const nextSpawnIntervalRef = useRef(0.75);

  const bumpCloudVersion = useCallback(() => {
    setCloudVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const spawnCloudWave = useCallback(
    (baseTime: number) => {
      if (!mountedRef.current) return;
      const clouds = activeCloudsRef.current;
      const cloudCount = 14 + Math.floor(Math.random() * 10);
      const room = MAX_ACTIVE_CLOUDS - clouds.length;
      const toSpawn = Math.min(cloudCount, room);
      if (toSpawn <= 0) return;

      for (let i = 0; i < toSpawn; i++) {
        clouds.push(buildCloudParams(radius, baseTime + i * 0.1, cloudIdCounterRef.current++));
      }
      bumpCloudVersion();
    },
    [radius, bumpCloudVersion],
  );

  const cloudGeometry = useMemo(() => {
    const particleCount = 24;
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

  useEffect(() => {
    return () => {
      cloudGeometry.dispose();
    };
  }, [cloudGeometry]);

  useFrame(({ clock }) => {
    if (!mountedRef.current) return;
    const t = clock.getElapsedTime();
    const timeSinceLastCloud = t - lastCloudTimeRef.current;

    if (timeSinceLastCloud > nextSpawnIntervalRef.current || lastCloudTimeRef.current === 0) {
      spawnCloudWave(t);
      lastCloudTimeRef.current = t;
      nextSpawnIntervalRef.current = 0.25 + Math.random() * 1.0;
    }

    const clouds = activeCloudsRef.current;
    const before = clouds.length;
    if (before > 0) {
      const alive = clouds.filter((cloud) => t - cloud.startTime < cloud.duration + 1.0);
      if (alive.length !== before) {
        activeCloudsRef.current = alive;
        bumpCloudVersion();
      }
    }
  });

  const activeClouds = activeCloudsRef.current;

  // cloudVersion forces re-render only when clouds are added or removed (not every frame).
  void cloudVersion;

  return (
    <group name="perimeter-clouds">
      {activeClouds.map((cloud) => (
        <PerimeterCloudParticles
          key={cloud.id}
          cloud={cloud}
          geometry={cloudGeometry}
          cloudTheme={cloudTheme}
        />
      ))}
    </group>
  );
};

export default PerimeterCloudSystem;
