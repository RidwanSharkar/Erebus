import React, {
  forwardRef,
  useRef,
  useMemo,
  useLayoutEffect,
  useCallback,
  useEffect,
  useImperativeHandle,
} from 'react';
import { useFrame } from '@react-three/fiber';
import {
  InstancedMesh,
  ShaderMaterial,
  CylinderGeometry,
  Matrix4,
  Vector3,
  Color,
  DoubleSide,
  DynamicDrawUsage,
} from '@/utils/three-exports';
import { MUSHROOM_COUNT, buildMushroomInstances, type MushroomInstance } from '@/utils/mushroomLayout';
import { isInsideHexArenaXZ } from '@/utils/mapConstants';

const STEM_VERT = `
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vHeight   = position.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const STEM_FRAG = `
  uniform float uTime;
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec3 stemLow  = vec3(0.60, 0.72, 0.62);
    vec3 stemHigh = vec3(0.78, 0.92, 0.80);
    vec3 col = mix(stemLow, stemHigh, vHeight + 0.5);
    col *= 0.88 + sin(vHeight * 18.0 + vWorldPos.x * 6.0) * 0.06;
    float pulse = 0.55 + sin(uTime * 1.8 + vWorldPos.x * 3.1 + vWorldPos.z * 2.7) * 0.45;
    vec3 glow = vec3(0.10, 0.85, 0.78) * pulse * 0.35;
    col += glow;
    col *= 0.5 + smoothstep(-0.5, 0.2, vHeight) * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const CAP_VERT = `
  varying vec3 vWorldPos;
  varying float vHeight;

  void main() {
    vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    vHeight   = position.y;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const CAP_FRAG = `
  uniform float uTime;
  uniform vec3  uCapColor;
  varying vec3  vWorldPos;
  varying float vHeight;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  void main() {
    float seed = floor(vWorldPos.x * 0.35) + floor(vWorldPos.z * 0.35) * 17.0;
    float variant = hash(vec2(seed, seed + 3.7));
    vec3 col = mix(uCapColor, vec3(0.15, 0.72, 0.85), variant * 0.5);
    vec2 uv = vWorldPos.xz * 2.1;
    float spot = smoothstep(0.36, 0.28, length(fract(uv) - 0.5)) * 0.45;
    col += vec3(0.9, 0.9, 0.95) * spot;
    float underside = smoothstep(0.1, -0.35, vHeight);
    float pulse = 0.5 + sin(uTime * 2.1 + seed) * 0.5;
    col += vec3(0.08, 0.95, 0.82) * underside * pulse * 0.55;
    col *= 0.7 + smoothstep(0.0, 0.5, vHeight) * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const _zero = new Matrix4().makeScale(0, 0, 0);

export interface InstancedMushroomsProps {
  /** Indices to hide (server-destroyed). */
  hiddenIndices?: ReadonlySet<number>;
  /** When set, hide mushrooms outside this hex circumradius (e.g. Fae Realm r=21). */
  hexRadius?: number;
  /** Override arena-ring layout (explore streamed mushrooms). */
  instances?: readonly MushroomInstance[];
  /** InstancedMesh capacity when using a custom instance list. */
  maxCount?: number;
}

export type InstancedMushroomsHandle = {
  write(instances: readonly MushroomInstance[], hidden?: ReadonlySet<number>): boolean;
};

const InstancedMushrooms = forwardRef<InstancedMushroomsHandle, InstancedMushroomsProps>(
  function InstancedMushrooms(
    {
      hiddenIndices,
      hexRadius,
      instances: instancesProp,
      maxCount,
    },
    ref,
  ) {
    const stemRef = useRef<InstancedMesh | null>(null);
    const capRef = useRef<InstancedMesh | null>(null);

    const arenaInstances = useMemo(() => buildMushroomInstances(), []);
    const streamed = maxCount != null && instancesProp === undefined;
    const liveRef = useRef<readonly MushroomInstance[]>(
      instancesProp ?? (streamed ? [] : arenaInstances),
    );
    if (instancesProp) liveRef.current = instancesProp;
    const hiddenRef = useRef(hiddenIndices);
    hiddenRef.current = hiddenIndices;
    const hexRadiusRef = useRef(hexRadius);
    hexRadiusRef.current = hexRadius;
    const capacity = Math.max(1, maxCount ?? liveRef.current.length ?? MUSHROOM_COUNT);

    const stemGeo = useMemo(() => new CylinderGeometry(0.06, 0.09, 0.32, 7, 2), []);
    const capGeo = useMemo(() => new CylinderGeometry(0.05, 0.28, 0.12, 10, 1), []);

    const stemMat = useMemo(
      () =>
        new ShaderMaterial({
          uniforms: { uTime: { value: 0 } },
          vertexShader: STEM_VERT,
          fragmentShader: STEM_FRAG,
          side: DoubleSide,
        }),
      [],
    );

    const capMat = useMemo(
      () =>
        new ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uCapColor: { value: new Color('#7c22d4') },
          },
          vertexShader: CAP_VERT,
          fragmentShader: CAP_FRAG,
          side: DoubleSide,
        }),
      [],
    );

    useEffect(() => {
      return () => {
        stemGeo.dispose();
        capGeo.dispose();
      };
    }, [stemGeo, capGeo]);

    useEffect(() => {
      return () => {
        stemMat.dispose();
        capMat.dispose();
      };
    }, [stemMat, capMat]);

    const fillInstances = useCallback((
      list: readonly MushroomInstance[],
      hide: ReadonlySet<number> | undefined,
    ): boolean => {
      const stem = stemRef.current;
      const cap = capRef.current;
      if (!stem || !cap) return false;

      const m = new Matrix4();
      const scl = new Vector3();
      const pos = new Vector3();
      const hex = hexRadiusRef.current;

      const n = Math.min(list.length, capacity);
      for (let i = 0; i < n; i++) {
        const inst = list[i]!;
        const { index, x, z, h, cr } = inst;
        const outsideHex =
          typeof hex === 'number'
          && !isInsideHexArenaXZ(x, z, hex, 0.5);
        if (hide?.has(index) || outsideHex) {
          stem.setMatrixAt(i, _zero);
          cap.setMatrixAt(i, _zero);
          continue;
        }
        scl.set(1, h / 0.32, 1);
        m.makeScale(scl.x, scl.y, scl.z);
        pos.set(x, h * 0.5, z);
        m.setPosition(pos);
        stem.setMatrixAt(i, m);

        scl.set(cr, h * 0.5, cr);
        m.makeScale(scl.x, scl.y, scl.z);
        pos.set(x, h + 0.04 * h, z);
        m.setPosition(pos);
        cap.setMatrixAt(i, m);
      }

      stem.count = n;
      cap.count = n;
      stem.instanceMatrix.needsUpdate = true;
      cap.instanceMatrix.needsUpdate = true;
      stem.computeBoundingSphere();
      cap.computeBoundingSphere();
      return true;
    }, [capacity]);

    useImperativeHandle(
      ref,
      () => ({
        write(instances: readonly MushroomInstance[], hidden?: ReadonlySet<number>): boolean {
          liveRef.current = instances;
          return fillInstances(instances, hidden ?? hiddenRef.current);
        },
      }),
      [fillInstances],
    );

    useLayoutEffect(() => {
      if (streamed) return;
      if (stemRef.current && capRef.current) {
        fillInstances(liveRef.current, hiddenIndices);
        return;
      }
      let raf = 0;
      let attempts = 0;
      const maxAttempts = 90;
      const tick = () => {
        if (stemRef.current && capRef.current) {
          fillInstances(liveRef.current, hiddenIndices);
          return;
        }
        if (++attempts >= maxAttempts) return;
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }, [fillInstances, hiddenIndices, streamed]);

    useLayoutEffect(() => {
      if (!streamed) return;
      fillInstances(liveRef.current, hiddenIndices);
    }, [fillInstances, hiddenIndices, streamed]);

    useFrame((_, delta) => {
      stemMat.uniforms.uTime.value += delta;
      capMat.uniforms.uTime.value += delta;
    });

    const attachStem = useCallback((mesh: InstancedMesh | null) => {
      stemRef.current = mesh;
      if (!mesh) return;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
    }, []);
    const attachCap = useCallback((mesh: InstancedMesh | null) => {
      capRef.current = mesh;
      if (!mesh) return;
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.count = 0;
    }, []);

    return (
      <group>
        <instancedMesh ref={attachStem} args={[stemGeo, stemMat, capacity]} frustumCulled />
        <instancedMesh ref={attachCap} args={[capGeo, capMat, capacity]} frustumCulled />
      </group>
    );
  },
);

export default React.memo(InstancedMushrooms);
