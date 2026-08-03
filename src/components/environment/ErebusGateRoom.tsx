'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { Group, InstancedMesh, Mesh, PointLight } from 'three';
import {
  BoxGeometry,
  CircleGeometry,
  Euler,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { Color, ShaderMaterial } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import { CASTLE_ROOM_HALF_SIZE } from '@/utils/mapConstants';

const ARENA_RADIUS = CASTLE_ROOM_HALF_SIZE;
const WALL_SEGMENTS = 28;
const WALL_HEIGHT = 2.8;
const WALL_DEPTH = 0.55;
const WALL_TIER_HEIGHT = 1.35;
const TORCH_Y = 1.4;
const TORCH_COLOR = '#ffaa44';
const TORCH_GLOW = '#d4af37';
const TORCH_BASE_INTENSITY = 5.5;
const TORCH_DISTANCE = 9;

interface WallSegmentDef {
  position: [number, number, number];
  scale: [number, number, number];
  rotationY: number;
}

function buildColosseumWallSegments(): WallSegmentDef[] {
  const segments: WallSegmentDef[] = [];
  const wallRadius = ARENA_RADIUS - 0.35;
  const arcLen = (Math.PI * 2 * wallRadius) / WALL_SEGMENTS;

  for (let tier = 0; tier < 2; tier++) {
    const tierY = tier === 0 ? WALL_TIER_HEIGHT / 2 : WALL_TIER_HEIGHT + (WALL_HEIGHT - WALL_TIER_HEIGHT) / 2;
    const tierH = tier === 0 ? WALL_TIER_HEIGHT : WALL_HEIGHT - WALL_TIER_HEIGHT;
    const tierRadius = wallRadius - tier * 0.15;

    for (let i = 0; i < WALL_SEGMENTS; i++) {
      const angle = (Math.PI * 2 * i) / WALL_SEGMENTS;
      const x = Math.sin(angle) * tierRadius;
      const z = Math.cos(angle) * tierRadius;
      segments.push({
        position: [x, tierY, z],
        scale: [arcLen * 0.92, tierH, WALL_DEPTH],
        rotationY: angle,
      });
    }
  }

  return segments;
}

const COLOSSEUM_WALL_SEGMENTS = buildColosseumWallSegments();

const TORCH_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
const COLOSSEUM_TORCH_POSITIONS: [number, number, number][] = TORCH_ANGLES.map((angle) => {
  const r = ARENA_RADIUS - 1.2;
  return [Math.sin(angle) * r, TORCH_Y, Math.cos(angle) * r];
});

function ColosseumTorch({
  position,
  phaseOffset,
}: {
  position: [number, number, number];
  phaseOffset: number;
}) {
  const lightRef = useRef<PointLight>(null);
  const orbRef = useRef<Mesh>(null);
  const orbMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: TORCH_GLOW,
        emissive: TORCH_COLOR,
        emissiveIntensity: 2.4,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  );
  const bracketMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#5a5048',
        emissive: '#2a2418',
        emissiveIntensity: 0.15,
      }),
    [],
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime + phaseOffset;
    const flicker = 0.82 + Math.sin(t * 2.3) * 0.1 + Math.sin(t * 5.7 + 1.1) * 0.08;
    if (lightRef.current) {
      lightRef.current.intensity = TORCH_BASE_INTENSITY * flicker;
    }
    if (orbRef.current) {
      orbMat.emissiveIntensity = 2.0 + flicker * 0.9;
      const sc = 1.0 + flicker * 0.18;
      orbRef.current.scale.setScalar(sc);
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={lightRef}
        color={new Color(TORCH_COLOR)}
        intensity={TORCH_BASE_INTENSITY}
        distance={TORCH_DISTANCE}
        decay={1.6}
        castShadow={false}
      />
      <mesh position={[0, -0.55, 0]} material={bracketMat}>
        <boxGeometry args={[0.28, 0.5, 0.22]} />
      </mesh>
      <mesh ref={orbRef} position={[0, 0.08, 0]} material={orbMat}>
        <sphereGeometry args={[0.16, 8, 8]} />
      </mesh>
    </group>
  );
}

const COLOSSEUM_WALL_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  void main() {
    vUv = uv;
    vec4 worldPos = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const COLOSSEUM_WALL_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    return noise(p) * 0.5 + noise(p * 2.1 + 1.7) * 0.25 + noise(p * 4.3 + 3.1) * 0.125;
  }

  void main() {
    vec2 wp = vWorldPos.xz * 0.55 + vWorldPos.y * 0.12;
    vec3 stone = vec3(0.48, 0.42, 0.36);
    float macro = fbm(wp * 0.7);
    stone += (macro - 0.5) * 0.12;
    stone += noise(wp * 5.5 + 1.3) * 0.04;

    float course = abs(sin(vWorldPos.y * 3.2 + noise(wp * 2.0) * 0.5));
    stone *= 0.78 + smoothstep(0.1, 0.0, course) * 0.22;

    float diff = max(dot(vNormal, normalize(vec3(0.5, 1.0, 0.3))), 0.0) * 0.35 + 0.65;
    stone *= diff;

    gl_FragColor = vec4(stone, 1.0);
  }
`;

const SAND_FLOOR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SAND_FLOOR_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    return noise(p) * 0.55 + noise(p * 2.0 + 1.3) * 0.28 + noise(p * 4.0 + 2.7) * 0.17;
  }

  void main() {
    vec2 wp = vWorldPos.xz;
    float dunes = fbm(wp * 0.35);
    float ripples = sin(wp.x * 2.8 + dunes * 4.0) * sin(wp.y * 2.6 + dunes * 3.5) * 0.04;

    vec3 sandLight = vec3(0.82, 0.72, 0.52);
    vec3 sandDark = vec3(0.62, 0.50, 0.34);
    vec3 sand = mix(sandDark, sandLight, dunes + ripples);
    sand += (hash(floor(wp * 3.0)) - 0.5) * 0.03;

    float dist = length(wp);
    float rim = smoothstep(${ARENA_RADIUS.toFixed(1)} - 2.5, ${ARENA_RADIUS.toFixed(1)} - 0.5, dist);
    sand = mix(sand, sand * 0.72, rim * 0.45);

    float diff = max(dot(vec3(0.0, 1.0, 0.0), normalize(vec3(0.4, 1.0, 0.25))), 0.0) * 0.18 + 0.88;
    sand *= diff;

    gl_FragColor = vec4(sand, 1.0);
  }
`;

function ColosseumInstancedWalls({
  segments,
}: {
  segments: WallSegmentDef[];
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: COLOSSEUM_WALL_VERTEX,
        fragmentShader: COLOSSEUM_WALL_FRAGMENT,
      }),
    [],
  );

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const mat4 = new Matrix4();
    const pos = new Vector3();
    const quat = new Quaternion();
    const scl = new Vector3();
    const euler = new Euler();

    segments.forEach((def, i) => {
      pos.set(...def.position);
      euler.set(0, def.rotationY, 0);
      quat.setFromEuler(euler);
      scl.set(...def.scale);
      mat4.compose(pos, quat, scl);
      mesh.setMatrixAt(i, mat4);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [segments]);

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  return (
    <instancedMesh
      ref={meshRef}
      name="erebus-colosseum-walls"
      args={[geometry, material, segments.length]}
      frustumCulled={false}
    />
  );
}

interface ErebusGateRoomProps {
  combatActive?: boolean;
  /** Server-authoritative random CustomSky preset index. */
  skyPresetIndex?: number;
}

export default function ErebusGateRoom({ combatActive = false, skyPresetIndex }: ErebusGateRoomProps) {
  const groundGeo = useMemo(() => new CircleGeometry(ARENA_RADIUS, 64), []);
  const sandMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: SAND_FLOOR_VERTEX,
        fragmentShader: SAND_FLOOR_FRAGMENT,
      }),
    [],
  );

  useEffect(() => {
    return () => {
      groundGeo.dispose();
      sandMaterial.dispose();
    };
  }, [groundGeo, sandMaterial]);

  return (
    <group name="erebus-gate-room">
      <CustomSky skyPresetIndex={skyPresetIndex} skyPreset="colosseum" animateClouds={!combatActive} />

      <mesh
        geometry={groundGeo}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        receiveShadow
      >
        <primitive object={sandMaterial} attach="material" />
      </mesh>

      <ColosseumInstancedWalls segments={COLOSSEUM_WALL_SEGMENTS} />

      {COLOSSEUM_TORCH_POSITIONS.map((pos, i) => (
        <ColosseumTorch key={`erebus-torch-${i}`} position={pos} phaseOffset={i * 1.7} />
      ))}
    </group>
  );
}