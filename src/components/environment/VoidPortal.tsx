'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type { Mesh, MeshBasicMaterial, Points as PointsType, ShaderMaterial as ShaderMaterialType } from 'three';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  NormalBlending,
  ShaderMaterial,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export const VOID_PORTAL_RADIUS = 2.5;
export const VOID_PORTAL_INTERACT_RADIUS = 3.3;

export type VoidPortalScheme = 'void' | 'boss';

const VOID_PORTAL_SCHEMES: Record<
  VoidPortalScheme,
  {
    energyDim: [number, number, number];
    energyBright: [number, number, number];
    rim: string;
    light: string;
    particleDim: [number, number, number];
    particleBright: [number, number, number];
  }
> = {
  void: {
    energyDim: [0.12, 0.0, 0.18],
    energyBright: [0.72, 0.04, 1.0],
    rim: '#7c3aed',
    light: '#6c3dff',
    particleDim: [0.12, 0.0, 0.18],
    particleBright: [0.72, 0.04, 1.0],
  },
  boss: {
    energyDim: [0.18, 0.0, 0.02],
    energyBright: [1.0, 0.16, 0.16],
    rim: '#ef4444',
    light: '#dc2626',
    particleDim: [0.15, 0.0, 0.02],
    particleBright: [1.0, 0.1, 0.1],
  },
};

const VOID_PORTAL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const VOID_MAW_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  uniform vec3 uEnergyDim;
  uniform vec3 uEnergyBright;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float dist = length(centered);
    if (dist > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float spiral = sin(angle * 6.0 + uTime * 4.2 - dist * 14.0) * 0.5 + 0.5;
    float pull = sin(angle * 9.0 - uTime * 6.0 + dist * 11.0) * 0.5 + 0.5;

    float voidCore = smoothstep(0.88, 0.08, dist);
    float rimBand = smoothstep(0.58, 0.82, dist) * (1.0 - smoothstep(0.94, 1.0, dist));
    float wisp = spiral * smoothstep(0.22, 0.68, dist) * (1.0 - smoothstep(0.68, 0.9, dist));

    vec3 voidBlack = vec3(0.0, 0.0, 0.0);
    vec3 energy = mix(uEnergyDim, uEnergyBright, spiral * 0.55 + pull * 0.45);
    vec3 color = mix(voidBlack, energy, rimBand * 0.95 + wisp * 0.4);

    float alpha = max(voidCore * 0.995, (rimBand * 0.9 + wisp * 0.25) * 0.85) * uOpen;
    gl_FragColor = vec4(color, alpha);
  }
`;

const VOID_RIM_GLOW_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  uniform vec3 uEnergyBright;
  varying vec2 vUv;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float dist = length(centered);
    if (dist > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float pulse = sin(angle * 7.0 - uTime * 5.0) * 0.5 + 0.5;
    float rim = smoothstep(0.72, 0.9, dist) * (1.0 - smoothstep(0.94, 1.0, dist));
    float alpha = rim * (0.45 + pulse * 0.25) * uOpen;
    gl_FragColor = vec4(uEnergyBright, alpha);
  }
`;

const VOID_DRAG_VERT = /* glsl */ `
  attribute float aIndex;
  attribute vec3  aOrigin;
  attribute float aSpeed;
  attribute float aSize;
  attribute float aStartHeight;

  uniform float uTime;
  uniform float uOpen;
  uniform float uEffectHeightOffset;
  uniform float uPortalRadius;
  uniform vec3 uParticleDim;
  uniform vec3 uParticleBright;

  varying float vAlpha;
  varying vec3  vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float cycle = 1.8 + hash(aIndex) * 1.4;
    float t     = mod(uTime * aSpeed + aIndex * 1.618, cycle);
    float tNorm = t / cycle;

    float angle = aIndex * 2.39996 - uTime * aSpeed * 0.85;
    float startRadius = 0.35 + hash(aIndex + 3.0) * uPortalRadius * 0.72;
    float radius = startRadius * pow(1.0 - tNorm, 1.6);

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius;
    pos.z += sin(angle) * radius;
    pos.y = uEffectHeightOffset + aStartHeight * (1.0 - tNorm * 1.1);

    pos.x += sin(uTime * 4.2 + aIndex * 5.7) * 0.04 * (1.0 - tNorm);
    pos.z += cos(uTime * 3.5 + aIndex * 3.3) * 0.04 * (1.0 - tNorm);

    vAlpha = smoothstep(0.0, 0.08, tNorm) * (1.0 - smoothstep(0.45, 0.88, tNorm)) * uOpen;

    float heat = 1.0 - tNorm;
    vColor = mix(uParticleDim, uParticleBright, heat * heat);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.2 - tNorm * 0.5) * (220.0 / -mvPos.z) * uOpen;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const VOID_DRAG_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.3, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.9);
  }
`;

const VOID_DRAG_PARTICLE_COUNT = 36;

interface VoidPortalProps {
  position?: [number, number, number];
  /** 0 = closed/hidden, 1 = fully open */
  open?: number;
  visible?: boolean;
  /** Raises particle spawn band and point light (throne room tile height). */
  effectHeightOffset?: number;
  scheme?: VoidPortalScheme;
}

export default function VoidPortal({
  position = [0, 0.25, 0],
  open = 1,
  visible = true,
  effectHeightOffset = 0,
  scheme = 'void',
}: VoidPortalProps) {
  const matRef = useRef<ShaderMaterialType>(null);
  const rimGlowRef = useRef<ShaderMaterialType>(null);
  const ringRef = useRef<Mesh>(null);
  const dragPointsRef = useRef<PointsType>(null);
  const openSfxPlayedRef = useRef(false);
  const prevOpenRef = useRef(0);

  const palette = VOID_PORTAL_SCHEMES[scheme];

  const mawMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpen: { value: 1 },
          uEnergyDim: { value: palette.energyDim },
          uEnergyBright: { value: palette.energyBright },
        },
        vertexShader: VOID_PORTAL_VERTEX,
        fragmentShader: VOID_MAW_FRAGMENT,
        transparent: true,
        depthWrite: true,
        side: DoubleSide,
        blending: NormalBlending,
      }),
    [palette.energyBright, palette.energyDim],
  );

  const rimGlowMaterial = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpen: { value: 1 },
          uEnergyBright: { value: palette.energyBright },
        },
        vertexShader: VOID_PORTAL_VERTEX,
        fragmentShader: VOID_RIM_GLOW_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [palette.energyBright],
  );

  const portalLight = useDynamicLight({ color: palette.light, distance: 12, decay: 2, priority: 1 });

  const { dragGeo, dragMat } = useMemo(() => {
    const indices = new Float32Array(VOID_DRAG_PARTICLE_COUNT);
    const origins = new Float32Array(VOID_DRAG_PARTICLE_COUNT * 3);
    const speeds = new Float32Array(VOID_DRAG_PARTICLE_COUNT);
    const sizes = new Float32Array(VOID_DRAG_PARTICLE_COUNT);
    const startHeights = new Float32Array(VOID_DRAG_PARTICLE_COUNT);
    const positions = new Float32Array(VOID_DRAG_PARTICLE_COUNT * 3);

    for (let i = 0; i < VOID_DRAG_PARTICLE_COUNT; i++) {
      indices[i] = i;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * VOID_PORTAL_RADIUS * 0.85;
      origins[i * 3] = Math.cos(a) * r;
      origins[i * 3 + 1] = 0;
      origins[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 1.8 + Math.random() * 2.0;
      sizes[i] = 1.4 + Math.random() * 2.4;
      startHeights[i] = -0.3 + Math.random() * 3.5;
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aIndex', new Float32BufferAttribute(indices, 1));
    geometry.setAttribute('aOrigin', new Float32BufferAttribute(origins, 3));
    geometry.setAttribute('aSpeed', new Float32BufferAttribute(speeds, 1));
    geometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aStartHeight', new Float32BufferAttribute(startHeights, 1));

    const dragMaterial = new ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uOpen: { value: open },
        uEffectHeightOffset: { value: effectHeightOffset },
        uPortalRadius: { value: VOID_PORTAL_RADIUS },
        uParticleDim: { value: palette.particleDim },
        uParticleBright: { value: palette.particleBright },
      },
      vertexShader: VOID_DRAG_VERT,
      fragmentShader: VOID_DRAG_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    return { dragGeo: geometry, dragMat: dragMaterial };
  }, [palette.particleBright, palette.particleDim]);

  useEffect(() => {
    mawMaterial.uniforms.uEnergyDim.value = palette.energyDim;
    mawMaterial.uniforms.uEnergyBright.value = palette.energyBright;
    rimGlowMaterial.uniforms.uEnergyBright.value = palette.energyBright;
    dragMat.uniforms.uParticleDim.value = palette.particleDim;
    dragMat.uniforms.uParticleBright.value = palette.particleBright;
    portalLight.current?.setColor(palette.light);
  }, [palette, mawMaterial, rimGlowMaterial, dragMat, portalLight]);

  useEffect(() => {
    dragMat.uniforms.uEffectHeightOffset.value = effectHeightOffset;
  }, [effectHeightOffset, dragMat]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.elapsedTime;

    if (open <= 0.01) {
      openSfxPlayedRef.current = false;
    } else if (
      open > 0.05 &&
      prevOpenRef.current <= 0.05 &&
      !openSfxPlayedRef.current
    ) {
      openSfxPlayedRef.current = true;
      (window as Window & { audioSystem?: { playVoidPortalOpenSound?: () => void } }).audioSystem
        ?.playVoidPortalOpenSound?.();
    }
    prevOpenRef.current = open;

    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uOpen.value = open;
    }
    if (rimGlowRef.current) {
      rimGlowRef.current.uniforms.uTime.value = t;
      rimGlowRef.current.uniforms.uOpen.value = open;
    }
    dragMat.uniforms.uTime.value = t;
    dragMat.uniforms.uOpen.value = open;
    dragMat.uniforms.uPortalRadius.value = VOID_PORTAL_RADIUS;
    const light = portalLight.current;
    if (light?.active) {
      light.setPosition(position[0], position[1] + 0.35 + effectHeightOffset, position[2]);
      light.setIntensity(2.2 * open);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.45;
      ringRef.current.scale.setScalar(0.82 + open * 0.18);
      const ringMat = ringRef.current.material as MeshBasicMaterial;
      ringMat.opacity = 0.5 * open;
    }
  });

  useEffect(() => {
    return () => {
      mawMaterial.dispose();
      rimGlowMaterial.dispose();
      dragGeo.dispose();
      dragMat.dispose();
    };
  }, [mawMaterial, rimGlowMaterial, dragGeo, dragMat]);

  if (!visible && open <= 0.01) return null;

  const groupPosition: [number, number, number] = [
    position[0],
    position[1] + 0.35,
    position[2],
  ];

  return (
    <group position={groupPosition}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
        <circleGeometry args={[VOID_PORTAL_RADIUS, 48]} />
        <primitive ref={matRef} object={mawMaterial} attach="material" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]} renderOrder={2}>
        <circleGeometry args={[VOID_PORTAL_RADIUS, 48]} />
        <primitive ref={rimGlowRef} object={rimGlowMaterial} attach="material" />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} renderOrder={3}>
        <ringGeometry args={[VOID_PORTAL_RADIUS * 0.9, VOID_PORTAL_RADIUS * 1.1, 48]} />
        <meshBasicMaterial
          color={palette.rim}
          transparent
          opacity={0}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <points ref={dragPointsRef} geometry={dragGeo} material={dragMat} frustumCulled={false} renderOrder={4} />
    </group>
  );
}
