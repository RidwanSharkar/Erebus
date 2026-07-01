'use client';

import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  MeshBasicMaterial,
  ShaderMaterial,
  Group,
  Color,
  RingGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  PlaneGeometry,
  Vector3,
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

type SoulType = 'green' | 'red' | 'blue' | 'purple';

export interface TitanStompShockwaveBurst {
  id: string;
  origin: { x: number; y: number; z: number };
  direction: { ux: number; uz: number };
  maxRange: number;
  travelMs: number;
  soulType?: SoulType;
}

interface TitanStompShockwaveProps {
  burst: TitanStompShockwaveBurst;
  onComplete: () => void;
}

interface TitanStompPalette {
  wedgeCore: string;
  wedgeMid: string;
  wedgeHalo: string;
  lightColor: string;
  dustTints: string[];
}

const GROUND_Y = 0.12;
const MIN_HALF_WIDTH = 0.5;
const MAX_HALF_WIDTH = 2.0;
const TRAIL_LENGTH = 4.0;
const TRAIL_FADE = 0.35;

const DUST_COUNT = 48;
const DUST_SPAWN_MS = 35;
const PUFF_COUNT = 18;
const PUFF_SPAWN_MS = 55;
const PUFF_MAX_AGE = 0.9;

const SOUL_BASE: Record<SoulType, { core: string; glow: string; light: string }> = {
  green:  { core: '#00ff88', glow: '#00cc55', light: '#00ff66' },
  red:    { core: '#ff3344', glow: '#cc1122', light: '#ff2233' },
  blue:   { core: '#44aaff', glow: '#2266dd', light: '#3399ff' },
  purple: { core: '#cc44ff', glow: '#8811cc', light: '#bb33ff' },
};

const EARTHY_DUST = ['#8b7d6a', '#a89878', '#6b5d4a', '#c8b89a'];

function mixHex(soul: string, earth: string, soulWeight = 0.3): string {
  const c1 = new Color(soul);
  const c2 = new Color(earth);
  return '#' + c1.lerp(c2, 1 - soulWeight).getHexString();
}

function getTitanStompPalette(soulType?: SoulType): TitanStompPalette {
  const base = SOUL_BASE[soulType ?? 'green'] ?? SOUL_BASE.green;
  return {
    wedgeCore: base.core,
    wedgeMid: base.glow,
    wedgeHalo: base.glow,
    lightColor: base.light,
    dustTints: EARTHY_DUST.map((e) => mixHex(base.glow, e, 0.3)),
  };
}

const WEDGE_VERT = `
  varying float vAlong;
  uniform float uWedgeLen;
  void main() {
    vAlong = uWedgeLen > 0.001 ? position.z / uWedgeLen : 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const WEDGE_FRAG = `
  varying float vAlong;
  uniform vec3 uColor;
  uniform float uBaseOpacity;
  uniform float uGlobalFade;
  uniform float uFadeStart;
  void main() {
    float trailFade = smoothstep(0.0, uFadeStart, vAlong);
    float alpha = uBaseOpacity * uGlobalFade * trailFade;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

const DUST_VERT = `
  attribute float aOpacity;
  attribute float aSize;
  attribute vec3 aColor;
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vOpacity = aOpacity;
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * (280.0 / max(-mvPos.z, 0.1));
    gl_Position = projectionMatrix * mvPos;
  }
`;

const DUST_FRAG = `
  varying float vOpacity;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float soft = 1.0 - smoothstep(0.35, 0.5, length(c) * 2.0);
    gl_FragColor = vec4(vColor, vOpacity * soft);
  }
`;

const PUFF_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const PUFF_FRAG = `
  varying vec2 vUv;
  uniform vec3 uColor;
  uniform float uOpacity;
  void main() {
    vec2 c = vUv - 0.5;
    float dist = length(c);
    float alpha = smoothstep(0.5, 0.05, dist) * uOpacity;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

function lerpHalfWidth(u: number): number {
  return MIN_HALF_WIDTH + (MAX_HALF_WIDTH - MIN_HALF_WIDTH) * u;
}

function createWedgeShaderMaterial(color: string, baseOpacity: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uBaseOpacity: { value: baseOpacity },
      uGlobalFade: { value: 1 },
      uFadeStart: { value: TRAIL_FADE },
      uWedgeLen: { value: 0.01 },
    },
    vertexShader: WEDGE_VERT,
    fragmentShader: WEDGE_FRAG,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
    side: 2,
  });
}

function createPuffMaterial(color: string): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color(color) },
      uOpacity: { value: 0 },
    },
    vertexShader: PUFF_VERT,
    fragmentShader: PUFF_FRAG,
    transparent: true,
    depthWrite: false,
    side: 2,
  });
}

function createWedgeGeometry(
  length: number,
  backHalfWidth: number,
  frontHalfWidth: number,
): BufferGeometry {
  const y = 0.01;
  const positions = new Float32Array([
    -backHalfWidth, y, 0,
    backHalfWidth, y, 0,
    frontHalfWidth, y, length,
    -frontHalfWidth, y, length,
  ]);
  const indices = [0, 1, 2, 0, 2, 3];
  const geom = new BufferGeometry();
  geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function updateWedgeGeometry(
  geom: BufferGeometry,
  length: number,
  backHalfWidth: number,
  frontHalfWidth: number,
): void {
  const attr = geom.getAttribute('position') as Float32BufferAttribute;
  const y = 0.01;
  attr.setXYZ(0, -backHalfWidth, y, 0);
  attr.setXYZ(1, backHalfWidth, y, 0);
  attr.setXYZ(2, frontHalfWidth, y, length);
  attr.setXYZ(3, -frontHalfWidth, y, length);
  attr.needsUpdate = true;
  // Normals are unused by the custom ShaderMaterial — skip recompute every frame.
}

type DustParticle = {
  x: number;
  y: number;
  z: number;
  vy: number;
  size: number;
  baseSize: number;
  color: string;
  active: boolean;
};

type PuffParticle = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  scale: number;
  color: string;
  age: number;
  active: boolean;
};

function ExpandingWedge({
  burst,
  onComplete,
}: {
  burst: TitanStompShockwaveBurst;
  onComplete: () => void;
}) {
  const grp = useRef<Group>(null);
  const puffGroupRef = useRef<Group>(null);
  const coreMeshRef = useRef<Mesh>(null);
  const midMeshRef = useRef<Mesh>(null);
  const frontRingRef = useRef<Mesh>(null);
  const puffMeshRefs = useRef<(Mesh | null)[]>(Array(PUFF_COUNT).fill(null));
  const elapsed = useRef(0);
  const spawnAcc = useRef(0);
  const puffSpawnAcc = useRef(0);
  const doneRef = useRef(false);
  const { origin, direction, maxRange, travelMs } = burst;

  const palette = useMemo(
    () => getTitanStompPalette(burst.soulType),
    [burst.soulType],
  );

  // Pre-allocate the light color so we never call `new Color` inside useFrame.
  const _lightColor = useMemo(() => new Color(palette.lightColor), [palette]);

  const dustParticles = useRef<DustParticle[]>(
    Array.from({ length: DUST_COUNT }, () => ({
      x: 0,
      y: 0,
      z: 0,
      vy: 0,
      size: 0,
      baseSize: 0,
      color: palette.dustTints[0],
      active: false,
    })),
  );

  const puffParticles = useRef<PuffParticle[]>(
    Array.from({ length: PUFF_COUNT }, () => ({
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      scale: 0,
      color: palette.dustTints[0],
      age: 0,
      active: false,
    })),
  );

  const stompLight = useDynamicLight({
    color: new Color(palette.lightColor),
    distance: 8,
    decay: 2,
    priority: 0,
  });

  const { matCore, matMid, matHalo } = useMemo(() => {
    const core = createWedgeShaderMaterial(palette.wedgeCore, 0.55);
    const mid = createWedgeShaderMaterial(palette.wedgeMid, 0.38);
    const halo = new MeshBasicMaterial({
      color: new Color(palette.wedgeHalo),
      transparent: true,
      opacity: 0.28,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2,
      toneMapped: false,
    });
    return { matCore: core, matMid: mid, matHalo: halo };
  }, [palette]);

  const puffMats = useMemo(
    () => Array.from({ length: PUFF_COUNT }, () => createPuffMaterial(palette.dustTints[0])),
    [palette],
  );

  const geomCore = useMemo(
    () => createWedgeGeometry(0.01, MIN_HALF_WIDTH, MIN_HALF_WIDTH),
    [],
  );
  const geomMid = useMemo(
    () => createWedgeGeometry(0.01, MIN_HALF_WIDTH * 1.12, MIN_HALF_WIDTH * 1.12),
    [],
  );
  const geomRing = useMemo(() => new RingGeometry(0.35, 0.85, 24), []);
  const puffGeo = useMemo(() => new PlaneGeometry(1.4, 1.4), []);

  const { dustGeom, dustMat } = useMemo(() => {
    const positions = new Float32Array(DUST_COUNT * 3);
    const opacities = new Float32Array(DUST_COUNT);
    const sizes = new Float32Array(DUST_COUNT);
    const colors = new Float32Array(DUST_COUNT * 3);
    const geom = new BufferGeometry();
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geom.setAttribute('aOpacity', new Float32BufferAttribute(opacities, 1));
    geom.setAttribute('aSize', new Float32BufferAttribute(sizes, 1));
    geom.setAttribute('aColor', new Float32BufferAttribute(colors, 3));
    const mat = new ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      transparent: true,
      depthWrite: false,
    });
    return { dustGeom: geom, dustMat: mat };
  }, []);

  useEffect(() => {
    return () => {
      matCore.dispose();
      matMid.dispose();
      matHalo.dispose();
      geomCore.dispose();
      geomMid.dispose();
      geomRing.dispose();
      puffGeo.dispose();
      puffMats.forEach((m) => m.dispose());
      dustGeom.dispose();
      dustMat.dispose();
    };
  }, [matCore, matMid, matHalo, geomCore, geomMid, geomRing, puffGeo, puffMats, dustGeom, dustMat]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (!doneRef.current) {
        doneRef.current = true;
        onComplete();
      }
    }, Math.max(travelMs + 350, 500));
    return () => clearTimeout(t);
  }, [travelMs, onComplete]);

  const spawnDust = (length: number, frontHalfWidth: number, count: number) => {
    const pool = dustParticles.current;
    let spawned = 0;
    for (let i = 0; i < DUST_COUNT && spawned < count; i++) {
      if (pool[i].active) continue;
      const baseSize = 0.18 + Math.random() * 0.22;
      pool[i] = {
        x: (Math.random() * 2 - 1) * frontHalfWidth * 0.92,
        y: 0.04 + Math.random() * 0.1,
        z: length,
        vy: 0.3 + Math.random() * 0.6,
        size: baseSize,
        baseSize,
        color: palette.dustTints[Math.floor(Math.random() * palette.dustTints.length)],
        active: true,
      };
      spawned += 1;
    }
  };

  const spawnPuff = (length: number, frontHalfWidth: number, waveSpeed: number) => {
    const pool = puffParticles.current;
    for (let i = 0; i < PUFF_COUNT; i++) {
      if (pool[i].active) continue;
      pool[i] = {
        x: (Math.random() * 2 - 1) * frontHalfWidth * 0.85,
        y: 0.06 + Math.random() * 0.12,
        z: length + (Math.random() - 0.5) * 0.3,
        vx: (Math.random() * 2 - 1) * 0.5,
        vy: 0.4 + Math.random() * 0.8,
        vz: waveSpeed * (0.85 + Math.random() * 0.2),
        scale: 0.3 + Math.random() * 0.2,
        color: palette.dustTints[Math.floor(Math.random() * palette.dustTints.length)],
        age: 0,
        active: true,
      };
      return;
    }
  };

  const updateDust = (length: number, globalFade: number, dt: number) => {
    const posAttr = dustGeom.getAttribute('position') as Float32BufferAttribute;
    const opaAttr = dustGeom.getAttribute('aOpacity') as Float32BufferAttribute;
    const sizeAttr = dustGeom.getAttribute('aSize') as Float32BufferAttribute;
    const colAttr = dustGeom.getAttribute('aColor') as Float32BufferAttribute;
    const pool = dustParticles.current;
    const fadeEnd = TRAIL_LENGTH + 0.5;
    const fadeStart = TRAIL_LENGTH * 0.25;
    const scratchColor = new Color();

    for (let i = 0; i < DUST_COUNT; i++) {
      const p = pool[i];
      if (!p.active) {
        posAttr.setXYZ(i, 0, -99, 0);
        opaAttr.setX(i, 0);
        sizeAttr.setX(i, 0);
        continue;
      }

      p.y += p.vy * dt;
      p.vy *= 0.96;

      const distBehind = length - p.z;
      if (distBehind > fadeEnd) {
        p.active = false;
        posAttr.setXYZ(i, 0, -99, 0);
        opaAttr.setX(i, 0);
        sizeAttr.setX(i, 0);
        continue;
      }

      const t = distBehind <= 0 ? 0 : (distBehind - fadeStart) / Math.max(0.001, TRAIL_LENGTH - fadeStart);
      const trailFade = distBehind <= 0 ? 1 : Math.max(0, 1 - t * t * (3 - 2 * t));
      const ageScale = 1 + (1 - trailFade) * 0.35;
      const opacity = 0.65 * globalFade * trailFade;

      scratchColor.set(p.color);
      posAttr.setXYZ(i, p.x, p.y, p.z);
      opaAttr.setX(i, opacity);
      sizeAttr.setX(i, p.baseSize * ageScale);
      colAttr.setXYZ(i, scratchColor.r, scratchColor.g, scratchColor.b);
    }

    posAttr.needsUpdate = true;
    opaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  const updatePuffs = (length: number, globalFade: number, dt: number, cameraPos: Vector3) => {
    const pool = puffParticles.current;

    for (let i = 0; i < PUFF_COUNT; i++) {
      const p = pool[i];
      const mesh = puffMeshRefs.current[i];
      const mat = puffMats[i];

      if (!p.active || !mesh) {
        if (mesh) mesh.visible = false;
        continue;
      }

      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vy *= 0.98;
      p.vx *= 0.97;

      const distBehind = length - p.z;
      const lifeFade = Math.max(0, 1 - p.age / PUFF_MAX_AGE);
      const trailFade = distBehind > TRAIL_LENGTH + 0.5 ? 0 : 1;

      if (lifeFade <= 0 || trailFade <= 0) {
        p.active = false;
        mesh.visible = false;
        continue;
      }

      const growScale = p.scale + p.age * 1.6;
      const opacity = 0.55 * globalFade * lifeFade * trailFade * (1 - p.age / PUFF_MAX_AGE * 0.4);

      mesh.position.set(p.x, p.y, p.z);
      mesh.scale.setScalar(growScale);
      mesh.visible = opacity > 0.01;
      mesh.lookAt(cameraPos);
      mat.uniforms.uColor.value.set(p.color);
      mat.uniforms.uOpacity.value = opacity;
    }
  };

  useFrame(({ camera }, dt) => {
    if (!grp.current || doneRef.current) return;
    elapsed.current += dt * 1000;
    spawnAcc.current += dt * 1000;
    puffSpawnAcc.current += dt * 1000;
    const u = Math.min(1, elapsed.current / Math.max(1, travelMs));
    const length = maxRange * u;
    const waveSpeed = maxRange / Math.max(0.001, travelMs / 1000);
    const backZ = Math.max(0, length - TRAIL_LENGTH);
    const wedgeLen = Math.max(0.01, length - backZ);
    const backU = backZ / maxRange;
    const backHalfWidth = lerpHalfWidth(backU);
    const frontHalfWidth = lerpHalfWidth(u);
    const y = (origin.y > 0.05 ? origin.y : 0) + GROUND_Y;

    grp.current.position.set(origin.x, y, origin.z);
    grp.current.rotation.set(0, Math.atan2(direction.ux, direction.uz), 0);

    if (length > 0.01) {
      if (coreMeshRef.current) coreMeshRef.current.position.z = backZ;
      if (midMeshRef.current) midMeshRef.current.position.z = backZ;

      updateWedgeGeometry(geomCore, wedgeLen, backHalfWidth, frontHalfWidth);
      updateWedgeGeometry(
        geomMid,
        wedgeLen * 1.02,
        backHalfWidth * 1.15,
        frontHalfWidth * 1.12,
      );

      matCore.uniforms.uWedgeLen.value = wedgeLen;
      matMid.uniforms.uWedgeLen.value = wedgeLen * 1.02;
    }

    if (frontRingRef.current && length > 0.05) {
      const ringScale = frontHalfWidth / 0.85;
      frontRingRef.current.position.set(0, 0.02, length);
      frontRingRef.current.scale.set(ringScale, ringScale, 1);
      frontRingRef.current.visible = true;
    } else if (frontRingRef.current) {
      frontRingRef.current.visible = false;
    }

    const globalFade = u > 0.9 ? 1 - (u - 0.9) / 0.1 : 1;
    matCore.uniforms.uGlobalFade.value = globalFade;
    matMid.uniforms.uGlobalFade.value = globalFade;
    matHalo.opacity = 0.28 * globalFade;

    while (spawnAcc.current >= DUST_SPAWN_MS && u < 1 && length > 0.05) {
      spawnAcc.current -= DUST_SPAWN_MS;
      spawnDust(length, frontHalfWidth, Math.random() < 0.5 ? 2 : 1);
    }

    while (puffSpawnAcc.current >= PUFF_SPAWN_MS && u < 1 && length > 0.05) {
      puffSpawnAcc.current -= PUFF_SPAWN_MS;
      spawnPuff(length, frontHalfWidth, waveSpeed);
      if (Math.random() < 0.4) spawnPuff(length, frontHalfWidth, waveSpeed);
    }

    updateDust(length, globalFade, dt);
    updatePuffs(length, globalFade, dt, camera.position);

    const frontX = origin.x + direction.ux * length;
    const frontZ = origin.z + direction.uz * length;
    stompLight.current?.setPosition(frontX, y + 0.1, frontZ);
    stompLight.current?.setIntensity(4 + 6 * Math.sin(u * Math.PI));
    stompLight.current?.setColor(_lightColor);

    if (u >= 1 && !doneRef.current) {
      doneRef.current = true;
      onComplete();
    }
  });

  return (
    <group ref={grp}>
      <mesh ref={coreMeshRef} geometry={geomCore} material={matCore} />
      <mesh ref={midMeshRef} geometry={geomMid} material={matMid} position={[0, 0.008, 0]} />
      <mesh
        ref={frontRingRef}
        geometry={geomRing}
        material={matHalo}
        rotation={[-Math.PI / 2, 0, 0]}
        visible={false}
      />
      <points geometry={dustGeom} material={dustMat} />
      <group ref={puffGroupRef}>
        {Array.from({ length: PUFF_COUNT }).map((_, i) => (
          <mesh
            key={i}
            ref={(el) => { puffMeshRefs.current[i] = el; }}
            geometry={puffGeo}
            material={puffMats[i]}
            visible={false}
          />
        ))}
      </group>
    </group>
  );
}

export default function TitanStompShockwave({ burst, onComplete }: TitanStompShockwaveProps) {
  return <ExpandingWedge burst={burst} onComplete={onComplete} />;
}
