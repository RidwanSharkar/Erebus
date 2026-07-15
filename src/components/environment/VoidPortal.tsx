'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import type { Mesh, Points as PointsType, ShaderMaterial as ShaderMaterialType } from 'three';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  ShaderMaterial,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export const VOID_PORTAL_RADIUS = 2.5;
export const VOID_PORTAL_INTERACT_RADIUS = 3.3;

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

const VOID_PORTAL_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform float uOpen;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  void main() {
    vec2 centered = vUv * 2.0 - 1.0;
    float dist = length(centered);
    if (dist > 1.0) discard;

    float angle = atan(centered.y, centered.x);
    float swirl = sin(angle * 5.0 - uTime * 3.5 + dist * 8.0) * 0.5 + 0.5;
    float hole = smoothstep(0.15, 0.85, dist);
    float rim = smoothstep(0.72, 0.95, dist) * (1.0 - smoothstep(0.95, 1.0, dist));
    float alpha = (hole * 0.85 + rim * 0.55) * uOpen * (1.0 - smoothstep(0.98, 1.0, dist));

    vec3 core = mix(vec3(0.02, 0.0, 0.08), vec3(0.35, 0.05, 0.55), swirl);
    core = mix(core, vec3(0.0, 0.0, 0.0), smoothstep(0.0, 0.35, 1.0 - dist));
    gl_FragColor = vec4(core, alpha);
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

  varying float vAlpha;
  varying vec3  vColor;

  float hash(float n) { return fract(sin(n) * 43758.5453); }

  void main() {
    float cycle = 2.2 + hash(aIndex) * 1.8;
    float t     = mod(uTime * aSpeed + aIndex * 1.618, cycle);
    float tNorm = t / cycle;

    float angle = aIndex * 2.39996 - uTime * aSpeed * 0.55;
    float startRadius = 0.12 + hash(aIndex + 3.0) * uPortalRadius * 0.82;
    float radius = startRadius * (1.0 - tNorm * 0.9);

    vec3 pos = aOrigin;
    pos.x += cos(angle) * radius;
    pos.z += sin(angle) * radius;
    pos.y = uEffectHeightOffset + aStartHeight * (1.0 - tNorm);

    pos.x += sin(uTime * 3.1 + aIndex * 5.7) * 0.05 * (1.0 - tNorm);
    pos.z += cos(uTime * 2.7 + aIndex * 3.3) * 0.05 * (1.0 - tNorm);

    vAlpha = smoothstep(0.0, 0.1, tNorm) * (1.0 - smoothstep(0.5, 0.92, tNorm)) * uOpen;

    float heat = 1.0 - tNorm;
    vec3 dim = vec3(0.12, 0.00, 0.18);
    vec3 bright = vec3(0.72, 0.04, 1.00);
    vColor = mix(dim, bright, heat * heat);

    vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * (1.1 - tNorm * 0.45) * (200.0 / -mvPos.z) * uOpen;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const VOID_DRAG_FRAG = /* glsl */ `
  varying float vAlpha;
  varying vec3  vColor;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float r = length(c) * 2.0;
    float soft = 1.0 - smoothstep(0.35, 1.0, r);
    gl_FragColor = vec4(vColor, vAlpha * soft * 0.85);
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
}

export default function VoidPortal({
  position = [0, 0.25, 0],
  open = 1,
  visible = true,
  effectHeightOffset = 0,
}: VoidPortalProps) {
  const matRef = useRef<ShaderMaterialType>(null);
  const ringRef = useRef<Mesh>(null);
  const dragPointsRef = useRef<PointsType>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uOpen: { value: 1 },
        },
        vertexShader: VOID_PORTAL_VERTEX,
        fragmentShader: VOID_PORTAL_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        blending: AdditiveBlending,
      }),
    [],
  );

  const portalLight = useDynamicLight({ color: '#6c3dff', distance: 12, decay: 2, priority: 1 });

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
      const r = Math.random() * VOID_PORTAL_RADIUS * 0.75;
      origins[i * 3] = Math.cos(a) * r;
      origins[i * 3 + 1] = 0;
      origins[i * 3 + 2] = Math.sin(a) * r;
      speeds[i] = 1.55 + Math.random() * 1.75;
      sizes[i] = 1.2 + Math.random() * 2.2;
      startHeights[i] = -0.5 + Math.random() * 3.2;
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
      },
      vertexShader: VOID_DRAG_VERT,
      fragmentShader: VOID_DRAG_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });

    return { dragGeo: geometry, dragMat: dragMaterial };
  }, []);

  useEffect(() => {
    dragMat.uniforms.uEffectHeightOffset.value = effectHeightOffset;
  }, [effectHeightOffset, dragMat]);

  useFrame(({ clock }) => {
    if (!visible) return;
    const t = clock.elapsedTime;
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uOpen.value = open;
    }
    dragMat.uniforms.uTime.value = t;
    dragMat.uniforms.uOpen.value = open;
    dragMat.uniforms.uPortalRadius.value = VOID_PORTAL_RADIUS;
    const light = portalLight.current;
    if (light?.active) {
      light.setPosition(position[0], position[1] + 0.35 + effectHeightOffset, position[2]);
      light.setIntensity(1.8 * open);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.35;
      ringRef.current.scale.setScalar(0.85 + open * 0.15);
    }
  });

  useEffect(() => {
    return () => {
      material.dispose();
      dragGeo.dispose();
      dragMat.dispose();
    };
  }, [material, dragGeo, dragMat]);

  if (!visible && open <= 0.01) return null;

  return (
    <group position={position} position-y={0.35}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[VOID_PORTAL_RADIUS, 48]} />
        <primitive ref={matRef} object={material} attach="material" />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[VOID_PORTAL_RADIUS * 0.92, VOID_PORTAL_RADIUS * 1.08, 48]} />
        <meshBasicMaterial
          color="#7c3aed"
          transparent
          opacity={0.35 * open}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>
      <points ref={dragPointsRef} geometry={dragGeo} material={dragMat} frustumCulled={false} />
    </group>
  );
}
