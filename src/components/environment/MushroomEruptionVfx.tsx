import React, { useMemo, useEffect, useLayoutEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute, Vector3, ShaderMaterial } from '@/utils/three-exports';
import { shaderRegistry } from '@/utils/shaderRegistry';
import { MUSHROOM_ERUPTION_VFX_MS } from '@/utils/mushroomConstants';

interface MushroomEruptionVfxProps {
  origin: Vector3;
  onDone?: () => void;
}

const ERUPTION_DURATION = 2.8;

const VolcanicEruptionParticles: React.FC<{
  geometry: BufferGeometry;
  material: ShaderMaterial;
  startTime: number;
}> = ({ geometry, material, startTime }) => {
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    material.uniforms.uEruptionTime.value = t - startTime;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </points>
  );
};

const GroundSplashMesh: React.FC<{
  geometry: BufferGeometry;
  material: ShaderMaterial;
  startTime: number;
}> = ({ geometry, material, startTime }) => {
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    material.uniforms.uTime.value = t;
    material.uniforms.uSplashTime.value = Math.max(0, t - (startTime - 0.5));
  });

  // No `position` prop: the shader places vertices in world space via `uOrigin`.
  // Adding a position here would double-offset the splash (origin + uOrigin).
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <primitive object={material} attach="material" />
    </mesh>
  );
};

/**
 * One-shot green volcanic burst + ground splash (cloned materials per instance).
 */
const MushroomEruptionVfx: React.FC<MushroomEruptionVfxProps> = ({ origin, onDone }) => {
  const { clock } = useThree();
  const [burstStart, setBurstStart] = useState<number | null>(null);
  useLayoutEffect(() => {
    setBurstStart(clock.getElapsedTime());
  }, [clock, origin.x, origin.y, origin.z]);

  useEffect(() => {
    (window as any).audioSystem?.playAcidSound?.(origin);
  }, [origin]);

  const scale = 1.1;
  const spread = 0.22;
  const distance = 1.4;
  const speed = 1.35;
  const rotationSpeed = 2.2;
  const rotationOffset = 0.85;

  const particleGeo = useMemo(() => {
    const particleCount = 20;
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

  const splashGeo = useMemo(() => {
    const radialSegments = 16;
    const heightSegments = 8;
    const positions: number[] = [];
    const uvs: number[] = [];
    for (let h = 0; h <= heightSegments; h++) {
      const heightRatio = h / heightSegments;
      const phi = (heightRatio * Math.PI) / 2;
      for (let r = 0; r <= radialSegments; r++) {
        const radialRatio = r / radialSegments;
        const theta = radialRatio * Math.PI * 2;
        const x = Math.sin(phi) * Math.cos(theta);
        const y = Math.cos(phi);
        const z = Math.sin(phi) * Math.sin(theta);
        positions.push(x, y, z);
        uvs.push(radialRatio, heightRatio);
      }
    }
    const indices: number[] = [];
    for (let h = 0; h < heightSegments; h++) {
      for (let r = 0; r < radialSegments; r++) {
        const current = h * (radialSegments + 1) + r;
        const next = current + 1;
        const below = (h + 1) * (radialSegments + 1) + r;
        const belowNext = below + 1;
        indices.push(current, below, next);
        indices.push(below, belowNext, next);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aUV', new Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    return geometry;
  }, []);

  const { volcMat, splashMat } = useMemo(() => {
    const volcMat = shaderRegistry.getShader('volcanicEruption') as ShaderMaterial | null;
    const splashMat = shaderRegistry.getShader('groundSplash') as ShaderMaterial | null;
    if (volcMat) {
      volcMat.uniforms.uDuration.value = ERUPTION_DURATION;
      volcMat.uniforms.uEruptionOrigin.value.set(origin.x, origin.y, origin.z);
      volcMat.uniforms.uEruptionDirection.value.set(0, 1, 0);
      volcMat.uniforms.uScale.value = scale;
      volcMat.uniforms.uSpread.value = spread;
      volcMat.uniforms.uDistance.value = distance;
      volcMat.uniforms.uSpeed.value = speed;
      volcMat.uniforms.uRotationSpeed.value = rotationSpeed;
      volcMat.uniforms.uRotationOffset.value = rotationOffset;
    }
    if (splashMat) {
      splashMat.uniforms.uDuration.value = ERUPTION_DURATION * 0.6;
      splashMat.uniforms.uOrigin.value.set(origin.x, origin.y, origin.z);
      splashMat.uniforms.uScale.value = scale;
      splashMat.uniforms.uMaxRadius.value = scale * 0.4;
    }
    return { volcMat, splashMat };
  }, [origin.x, origin.y, origin.z]);

  useEffect(() => {
    const t = window.setTimeout(() => onDone?.(), MUSHROOM_ERUPTION_VFX_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  useEffect(() => {
    return () => {
      volcMat?.dispose();
      splashMat?.dispose();
      particleGeo.dispose();
      splashGeo.dispose();
    };
  }, [volcMat, splashMat, particleGeo, splashGeo]);

  if (!volcMat || !splashMat || burstStart === null) return null;

  return (
    <group>
      <VolcanicEruptionParticles geometry={particleGeo} material={volcMat} startTime={burstStart} />
      <GroundSplashMesh geometry={splashGeo} material={splashMat} startTime={burstStart} />
    </group>
  );
};

export default React.memo(MushroomEruptionVfx);
