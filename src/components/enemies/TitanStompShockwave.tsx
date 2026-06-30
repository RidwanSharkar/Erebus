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
} from '@/utils/three-exports';
import { useDynamicLight } from '@/components/effects/DynamicLightPool';

export interface TitanStompShockwaveBurst {
  id: string;
  origin: { x: number; y: number; z: number };
  direction: { ux: number; uz: number };
  maxRange: number;
  travelMs: number;
}

interface TitanStompShockwaveProps {
  burst: TitanStompShockwaveBurst;
  onComplete: () => void;
}

const GROUND_Y = 0.12;
/** Narrow half-width at Titan feet — matches server TITAN_STOMP_HALF_WIDTH_MIN. */
const MIN_HALF_WIDTH = 0.5;
/** Wide half-width at wavefront — matches server TITAN_STOMP_HALF_WIDTH_MAX. */
const MAX_HALF_WIDTH = 2.0;
/** Max world-units of wedge visible behind the wavefront. */
const TRAIL_LENGTH = 4.0;
/** Fraction of trail band used for soft trailing-edge falloff. */
const TRAIL_FADE = 0.35;

const DUST_COUNT = 32;
const DUST_SPAWN_MS = 45;
const DUST_COLORS = ['#e8dcc8', '#c8b89a', '#a89878', '#8b7355'];

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
  geom.computeVertexNormals();
}

type DustParticle = {
  x: number;
  z: number;
  yJitter: number;
  size: number;
  color: string;
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
  const coreMeshRef = useRef<Mesh>(null);
  const midMeshRef = useRef<Mesh>(null);
  const frontRingRef = useRef<Mesh>(null);
  const elapsed = useRef(0);
  const spawnAcc = useRef(0);
  const doneRef = useRef(false);
  const { origin, direction, maxRange, travelMs } = burst;

  const dustParticles = useRef<DustParticle[]>(
    Array.from({ length: DUST_COUNT }, () => ({
      x: 0,
      z: 0,
      yJitter: 0,
      size: 0,
      color: DUST_COLORS[0],
      active: false,
    })),
  );

  const stompLight = useDynamicLight({
    color: new Color('#c8b89a'),
    distance: 8,
    decay: 2,
    priority: 0,
  });

  const { matCore, matMid, matHalo } = useMemo(() => {
    const core = createWedgeShaderMaterial('#e8dcc8', 0.88);
    const mid = createWedgeShaderMaterial('#a89878', 0.62);
    const halo = new MeshBasicMaterial({
      color: new Color('#8b7355'),
      transparent: true,
      opacity: 0.38,
      blending: AdditiveBlending,
      depthWrite: false,
      side: 2,
    });
    return { matCore: core, matMid: mid, matHalo: halo };
  }, []);

  const geomCore = useMemo(
    () => createWedgeGeometry(0.01, MIN_HALF_WIDTH, MIN_HALF_WIDTH),
    [],
  );
  const geomMid = useMemo(
    () => createWedgeGeometry(0.01, MIN_HALF_WIDTH * 1.12, MIN_HALF_WIDTH * 1.12),
    [],
  );
  const geomRing = useMemo(() => new RingGeometry(0.35, 0.85, 24), []);

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
      blending: AdditiveBlending,
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
      dustGeom.dispose();
      dustMat.dispose();
    };
  }, [matCore, matMid, matHalo, geomCore, geomMid, geomRing, dustGeom, dustMat]);

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
      pool[i] = {
        x: (Math.random() * 2 - 1) * frontHalfWidth * 0.92,
        z: length,
        yJitter: 0.04 + Math.random() * 0.14,
        size: 0.18 + Math.random() * 0.22,
        color: DUST_COLORS[Math.floor(Math.random() * DUST_COLORS.length)],
        active: true,
      };
      spawned += 1;
    }
  };

  const updateDust = (length: number, globalFade: number) => {
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
      const opacity = 0.72 * globalFade * trailFade;

      scratchColor.set(p.color);
      posAttr.setXYZ(i, p.x, p.yJitter, p.z);
      opaAttr.setX(i, opacity);
      sizeAttr.setX(i, p.size * (0.85 + trailFade * 0.15));
      colAttr.setXYZ(i, scratchColor.r, scratchColor.g, scratchColor.b);
    }

    posAttr.needsUpdate = true;
    opaAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  };

  useFrame((_, dt) => {
    if (!grp.current || doneRef.current) return;
    elapsed.current += dt * 1000;
    spawnAcc.current += dt * 1000;
    const u = Math.min(1, elapsed.current / Math.max(1, travelMs));
    const length = maxRange * u;
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
    matHalo.opacity = 0.38 * globalFade;

    while (spawnAcc.current >= DUST_SPAWN_MS && u < 1 && length > 0.05) {
      spawnAcc.current -= DUST_SPAWN_MS;
      spawnDust(length, frontHalfWidth, Math.random() < 0.45 ? 2 : 1);
    }
    updateDust(length, globalFade);

    const frontX = origin.x + direction.ux * length;
    const frontZ = origin.z + direction.uz * length;
    stompLight.current?.setPosition(frontX, y + 0.1, frontZ);
    stompLight.current?.setIntensity(4 + 6 * Math.sin(u * Math.PI));

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
    </group>
  );
}

export default function TitanStompShockwave({ burst, onComplete }: TitanStompShockwaveProps) {
  return <ExpandingWedge burst={burst} onComplete={onComplete} />;
}
