'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import type { Group, InstancedMesh, Mesh, PointLight } from 'three';
import {
  BoxGeometry,
  CircleGeometry,
  Euler,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from '@/utils/three-exports';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, MeshStandardMaterial, ShaderMaterial } from '@/utils/three-exports';
import CustomSky from './CustomSky';
import SanctumIncinerationRuneDisc from './SanctumIncinerationRuneDisc';
import { CASTLE_ROOM_HALF_SIZE } from '@/utils/mapConstants';

const EDGE_INSET = CASTLE_ROOM_HALF_SIZE + 0.25;
const TORCH_Y = 0.8;
const TORCH_COLOR = '#ffaa44';
const TORCH_GLOW = '#d4af37';
const TORCH_BASE_INTENSITY = 6.0;
const TORCH_DISTANCE = 10;

const CASTLE_EDGE_TORCH_POSITIONS: [number, number, number][] = [
  [EDGE_INSET, TORCH_Y, 0],
  [-EDGE_INSET, TORCH_Y, 0],
  [0, TORCH_Y, EDGE_INSET],
  [0, TORCH_Y, -EDGE_INSET],
];

const WALL_LENGTH = CASTLE_ROOM_HALF_SIZE * 2;
const WALL_HEIGHT = 3.0;
const WALL_DEPTH = 0.6;
const PILLAR_WIDTH = 0.55;
const PILLAR_HEIGHT = 2.6;

interface WallSegmentDef {
  position: [number, number, number];
  scale: [number, number, number];
}

const CASTLE_WALL_SEGMENTS: WallSegmentDef[] = [
  { position: [0, WALL_HEIGHT / 2, CASTLE_ROOM_HALF_SIZE], scale: [WALL_LENGTH, WALL_HEIGHT, WALL_DEPTH] },
  { position: [0, WALL_HEIGHT / 2, -CASTLE_ROOM_HALF_SIZE], scale: [WALL_LENGTH, WALL_HEIGHT, WALL_DEPTH] },
  { position: [CASTLE_ROOM_HALF_SIZE, WALL_HEIGHT / 2, 0], scale: [WALL_DEPTH, WALL_HEIGHT, WALL_LENGTH] },
  { position: [-CASTLE_ROOM_HALF_SIZE, WALL_HEIGHT / 2, 0], scale: [WALL_DEPTH, WALL_HEIGHT, WALL_LENGTH] },
];

const CASTLE_PILLAR_DEFS: WallSegmentDef[] = CASTLE_EDGE_TORCH_POSITIONS.map(([x, , z]) => ({
  position: [x, PILLAR_HEIGHT / 2, z] as [number, number, number],
  scale: [PILLAR_WIDTH, PILLAR_HEIGHT, PILLAR_WIDTH] as [number, number, number],
}));

const STAR_RING_INNER = CASTLE_ROOM_HALF_SIZE - 0.35;
const STAR_RING_OUTER = CASTLE_ROOM_HALF_SIZE - 0.05;

function CastleEdgeTorch({
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
        emissiveIntensity: 2.6,
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

const CASTLE_TILE_VERTEX = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CASTLE_TILE_FRAGMENT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 wp = vWorldPos.xz;
    float tileSize = 2.0;
    vec2 tile = floor(wp / tileSize);
    vec2 tileUv = fract(wp / tileSize);

    float tileHash = hash(tile);
    vec3 stone = mix(vec3(0.42, 0.28, 0.62), vec3(0.32, 0.20, 0.50), tileHash);
    stone += (hash(tile + 0.17) - 0.5) * 0.04;

    float groutX = smoothstep(0.02, 0.08, tileUv.x) * smoothstep(0.02, 0.08, 1.0 - tileUv.x);
    float groutY = smoothstep(0.02, 0.08, tileUv.y) * smoothstep(0.02, 0.08, 1.0 - tileUv.y);
    float grout = groutX * groutY;
    vec3 groutColor = vec3(0.79, 0.66, 0.29);
    stone = mix(groutColor, stone, grout);

    float sacredTile = (1.0 - step(0.5, mod(tile.x, 4.0))) * (1.0 - step(0.5, mod(tile.y, 4.0)));
    vec2 crossUv = abs(tileUv - 0.5);
    float crossV = smoothstep(0.05, 0.02, crossUv.x) * smoothstep(0.35, 0.28, crossUv.y);
    float crossH = smoothstep(0.05, 0.02, crossUv.y) * smoothstep(0.35, 0.28, crossUv.x);
    float crossArm = max(crossV, crossH);
    vec3 goldInlay = vec3(0.79, 0.66, 0.29);
    stone = mix(stone, goldInlay, sacredTile * crossArm * 0.55);

    float dist = length(wp);
    float centerGlow = 1.0 + (1.0 - smoothstep(0.0, 10.0, dist)) * 0.08;
    stone *= centerGlow;

    float diff = max(dot(vec3(0.0, 1.0, 0.0), normalize(vec3(0.4, 1.0, 0.25))), 0.0) * 0.22 + 0.88;
    stone *= diff;

    float spec = pow(max(dot(normalize(vec3(0.4, 1.0, 0.25)), vec3(0.0, 1.0, 0.0)), 0.0), 8.0);
    stone += vec3(0.12, 0.08, 0.18) * spec;

    float edge = max(abs(wp.x), abs(wp.z)) / ${CASTLE_ROOM_HALF_SIZE.toFixed(1)};
    stone *= 1.0 - smoothstep(0.82, 1.0, edge) * 0.12;

    gl_FragColor = vec4(stone, 1.0);
  }
`;

const CASTLE_WALL_VERTEX = /* glsl */ `
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

const CASTLE_WALL_FRAGMENT = /* glsl */ `
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

    vec3 stone = vec3(0.42, 0.38, 0.34);
    float macro = fbm(wp * 0.7);
    stone += (macro - 0.5) * 0.14;
    stone += noise(wp * 5.5 + 1.3) * 0.05;

    float course = abs(sin(vWorldPos.y * 3.2 + noise(wp * 2.0) * 0.5));
    stone *= 0.78 + smoothstep(0.1, 0.0, course) * 0.22;

    float crackH = abs(sin(vUv.x * 9.0 + noise(wp * 2.0) * 3.0));
    float crackV = abs(sin(vUv.y * 9.0 + noise(wp * 2.0 + 5.5) * 3.0));
    stone *= 0.62 + smoothstep(0.04, 0.14, min(crackH, crackV)) * 0.38;

    float edgeU = 1.0 - smoothstep(0.0, 0.09, vUv.x) * smoothstep(0.0, 0.09, 1.0 - vUv.x);
    float edgeV = 1.0 - smoothstep(0.0, 0.09, vUv.y) * smoothstep(0.0, 0.09, 1.0 - vUv.y);
    stone *= 1.0 - max(edgeU, edgeV) * 0.35;
    stone = mix(vec3(0.72, 0.60, 0.28), stone, 0.88);

    float diff = max(dot(vNormal, normalize(vec3(0.5, 1.0, 0.3))), 0.0) * 0.35 + 0.65;
    stone *= diff;

    float topFace = smoothstep(0.6, 0.9, vNormal.y);
    stone = mix(stone * 0.62, stone, topFace);

    gl_FragColor = vec4(stone, 1.0);
  }
`;

function CastleInstancedGeometry({
  segments,
  vertexShader,
  fragmentShader,
  name,
}: {
  segments: WallSegmentDef[];
  vertexShader: string;
  fragmentShader: string;
  name: string;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => new BoxGeometry(1, 1, 1), []);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader,
        fragmentShader,
      }),
    [vertexShader, fragmentShader],
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
      euler.set(0, 0, 0);
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
      name={name}
      args={[geometry, material, segments.length]}
      frustumCulled={false}
    />
  );
}

function CastleRotatingStarRings({
  scale,
  ySpin,
  yStar,
  baseRotationY = 0,
  spinRef,
  starSpinRef,
  borderRef,
  starRef,
}: {
  scale: number;
  ySpin: number;
  yStar: number;
  baseRotationY?: number;
  spinRef: RefObject<Group>;
  starSpinRef: RefObject<Group>;
  borderRef: RefObject<Mesh>;
  starRef: RefObject<Mesh>;
}) {
  return (
    <group scale={[scale, 1, scale]} rotation={[0, baseRotationY, 0]}>
      <group ref={spinRef} position={[0, ySpin, 0]}>
        <mesh ref={borderRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[STAR_RING_INNER, STAR_RING_OUTER, 4]} />
          <meshBasicMaterial
            color="#d4af37"
            transparent
            opacity={0.32}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
      <group ref={starSpinRef} position={[0, yStar, 0]} rotation={[0, Math.PI / 4, 0]}>
        <mesh ref={starRef} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[STAR_RING_INNER, STAR_RING_OUTER, 4]} />
          <meshBasicMaterial
            color="#d4af37"
            transparent
            opacity={0.32}
            depthWrite={false}
            blending={AdditiveBlending}
          />
        </mesh>
      </group>
    </group>
  );
}

interface CastleRoomProps {
  combatActive?: boolean;
}

export default function CastleRoom({ combatActive = false }: CastleRoomProps) {
  const borderRef = useRef<Mesh>(null);
  const borderSpinRef = useRef<Group>(null);
  const borderStarRef = useRef<Mesh>(null);
  const borderStarSpinRef = useRef<Group>(null);
  const innerBorderRef = useRef<Mesh>(null);
  const innerBorderSpinRef = useRef<Group>(null);
  const innerBorderStarRef = useRef<Mesh>(null);
  const innerBorderStarSpinRef = useRef<Group>(null);
  const sacredRingRef = useRef<Mesh>(null);

  const groundGeo = useMemo(
    () => new CircleGeometry(CASTLE_ROOM_HALF_SIZE, 48),
    [],
  );
  const groundMat = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#3d2468',
        metalness: 0.72,
        roughness: 0.28,
        emissive: '#1a0e30',
        emissiveIntensity: 0.12,
      }),
    [],
  );

  const tileMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: CASTLE_TILE_VERTEX,
        fragmentShader: CASTLE_TILE_FRAGMENT,
      }),
    [],
  );

  useFrame(({ clock }, delta) => {
    const spin = delta * 0.07;
    const spinRefs = [borderSpinRef, innerBorderSpinRef];
    const starSpinRefs = [borderStarSpinRef, innerBorderStarSpinRef];
    const borderRefs = [borderRef, innerBorderRef];
    const starRefs = [borderStarRef, innerBorderStarRef];

    spinRefs.forEach((ref) => {
      if (ref.current) ref.current.rotation.y += spin;
    });
    starSpinRefs.forEach((ref) => {
      if (ref.current) ref.current.rotation.y -= spin;
    });

    const pulse = 0.32 + Math.sin(clock.elapsedTime * 1.4) * 0.04;
    borderRefs.forEach((ref) => {
      if (ref.current) {
        (ref.current.material as MeshBasicMaterial).opacity = pulse;
      }
    });
    starRefs.forEach((ref) => {
      if (ref.current) {
        (ref.current.material as MeshBasicMaterial).opacity = pulse;
      }
    });

    if (sacredRingRef.current && !combatActive) {
      const glow = 0.06 + Math.sin(clock.elapsedTime * 0.9) * 0.02;
      (sacredRingRef.current.material as MeshBasicMaterial).opacity = glow;
    }
  });

  return (
    <group name="castle-intro-room">
      <CustomSky skyPreset="sanctumHoly" animateClouds={!combatActive} />


      <mesh
        geometry={groundGeo}
        material={groundMat}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow>
        <planeGeometry args={[CASTLE_ROOM_HALF_SIZE * 2, CASTLE_ROOM_HALF_SIZE * 2]} />
        <primitive object={tileMaterial} attach="material" />
      </mesh>

      <SanctumIncinerationRuneDisc />

      <mesh ref={sacredRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[3.1, 3.6, 48]} />
        <meshBasicMaterial
          color="#d4af37"
          transparent
          opacity={combatActive ? 0.06 : 0.08}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>

      <mesh ref={sacredRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[6.2, 6.7, 48]} />
        <meshBasicMaterial
          color="#d4af37"
          transparent
          opacity={combatActive ? 0.06 : 0.08}
          depthWrite={false}
          blending={AdditiveBlending}
        />
      </mesh>



      <CastleRotatingStarRings
        scale={0.812}
        ySpin={0.04}
        yStar={0.041}
        spinRef={borderSpinRef}
        starSpinRef={borderStarSpinRef}
        borderRef={borderRef}
        starRef={borderStarRef}
      />
      <CastleRotatingStarRings
        scale={0.4435}
        baseRotationY={Math.PI / 4}
        ySpin={0.045}
        yStar={0.046}
        spinRef={innerBorderSpinRef}
        starSpinRef={innerBorderStarSpinRef}
        borderRef={innerBorderRef}
        starRef={innerBorderStarRef}
      />


    </group>
  );
}
