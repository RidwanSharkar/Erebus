'use client';

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, PointLight, Vector3 } from '@/utils/three-exports';
import {
  AcquireOptions,
  DynamicLightColor,
  DynamicLightHandle,
  DYNAMIC_LIGHT_POOL_SIZE,
  ENEMY_LIGHT_POOL_SIZE,
  EFFECT_LIGHT_POOL_SIZE,
  acquireDynamicLight,
  acquireEnemyLight,
  acquireEffectLight,
  dynamicLightPool,
  effectLightPool,
  enemyLightPool,
  getDynamicLightsEnabled,
  getEnemyLightsEnabled,
  resolveInitialDynamicLightsFlag,
  resolveInitialEnemyLightsFlag,
  setDynamicLightsEnabled,
  setEnemyLightsEnabled,
  subscribeEnemyLights,
} from '@/utils/dynamicLights';

/**
 * Mounts a fixed set of point lights for a pool and registers them with it. While the
 * set is mounted the light count never changes, so lit-material shaders compile once
 * and stay cached (no per-spawn recompile churn). Renders nothing when disabled.
 */
function PooledLightSet({
  pool,
  size,
  enabled,
}: {
  pool: typeof dynamicLightPool;
  size: number;
  enabled: boolean;
}) {
  const lightsRef = useRef<(PointLight | null)[]>(Array(size).fill(null));

  useEffect(() => {
    if (!enabled) {
      pool.unregister();
      return;
    }
    const lights = lightsRef.current.filter((l): l is PointLight => l !== null);
    if (lights.length > 0) {
      pool.register(lights);
    }
    return () => pool.unregister();
  }, [enabled, pool, size]);

  if (!enabled) return null;

  return (
    <>
      {Array.from({ length: size }).map((_, i) => (
        <pointLight
          key={i}
          ref={(el) => {
            lightsRef.current[i] = el as PointLight | null;
          }}
          intensity={0}
          distance={0}
          decay={2}
        />
      ))}
    </>
  );
}

/**
 * Mounts the dynamic-light pools (VFX + per-enemy) for the whole session. Render this
 * once, inside the Canvas/scene tree. Each pool keeps a fixed number of point lights
 * mounted so the scene's light count stays constant — the thing that, when it changed,
 * forced every lit material to recompile (the spawn/death / heavy-combat hitch).
 */
export default function DynamicLightPool() {
  const [vfxEnabled, setVfxEnabled] = useState(() => {
    const initial = resolveInitialDynamicLightsFlag();
    if (initial !== getDynamicLightsEnabled()) {
      dynamicLightPool.setEnabled(initial);
    }
    return initial;
  });

  // Enemy flag is read reactively so the enemy pool mounts/unmounts on toggle.
  const enemyEnabled = useEnemyLightsEnabled();

  // Keep VFX flag in sync with runtime toggles (e.g. window.erebusDynamicLights).
  useEffect(() => dynamicLightPool.subscribe(setVfxEnabled), []);

  // Resolve the enemy-lights flag once on the client (URL / localStorage).
  useEffect(() => {
    const initial = resolveInitialEnemyLightsFlag();
    if (initial !== getEnemyLightsEnabled()) {
      setEnemyLightsEnabled(initial);
    }
  }, []);

  // Expose console toggles for quick testing without a UI control.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (window as any).erebusDynamicLights = {
      on: () => setDynamicLightsEnabled(true),
      off: () => setDynamicLightsEnabled(false),
      toggle: () => setDynamicLightsEnabled(!getDynamicLightsEnabled()),
      get enabled() {
        return getDynamicLightsEnabled();
      },
      // Separate switch for per-enemy model/soul lights (the spawn/death hitch).
      enemyLights: {
        on: () => setEnemyLightsEnabled(true),
        off: () => setEnemyLightsEnabled(false),
        toggle: () => setEnemyLightsEnabled(!getEnemyLightsEnabled()),
        get enabled() {
          return getEnemyLightsEnabled();
        },
      },
    };
    return () => {
      delete (window as any).erebusDynamicLights;
    };
  }, []);

  return (
    <>
      <PooledLightSet
        pool={dynamicLightPool}
        size={DYNAMIC_LIGHT_POOL_SIZE}
        enabled={vfxEnabled}
      />
      <PooledLightSet
        pool={enemyLightPool}
        size={ENEMY_LIGHT_POOL_SIZE}
        enabled={enemyEnabled}
      />
      <PooledLightSet
        pool={effectLightPool}
        size={EFFECT_LIGHT_POOL_SIZE}
        enabled={vfxEnabled}
      />
    </>
  );
}

/**
 * Borrow a pooled point light for the lifetime of a component. Returns a ref to a
 * handle (null until mounted / if the pool is full or disabled). Drive it from your
 * own useFrame in WORLD space — pooled lights live at the scene root, not under your
 * group:
 *
 *   const light = useDynamicLight({ color: '#ff8800', distance: 12, priority: 1 });
 *   useFrame(() => {
 *     light.current?.setPosition(worldX, worldY, worldZ);
 *     light.current?.setIntensity(5 * fade);
 *   });
 */
export function useDynamicLight(opts?: AcquireOptions) {
  const handleRef = useRef<DynamicLightHandle | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    handleRef.current = acquireDynamicLight(optsRef.current ?? {});
    return () => {
      handleRef.current?.release();
      handleRef.current = null;
    };
    // Acquire once on mount; per-frame changes go through the handle setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return handleRef;
}

/** Reactive read of the enemy-lights flag; re-renders the component on toggle. */
export function useEnemyLightsEnabled(): boolean {
  return useSyncExternalStore(
    subscribeEnemyLights,
    getEnemyLightsEnabled,
    () => true,
  );
}

type PointLightProps = JSX.IntrinsicElements['pointLight'];

const _pooledLightWorld = new Vector3();

/**
 * Shared logic for the pooled-light wrappers below: acquire a pooled light (re-acquiring
 * when `enabled` toggles on), and each frame drive it at the marker's WORLD position with
 * the current props. Returns nothing; the caller renders the marker group.
 */
function usePooledMarkerLight(
  acquire: (opts?: AcquireOptions) => DynamicLightHandle,
  enabled: boolean,
  props: PointLightProps,
  markerRef: React.MutableRefObject<Group | null>,
) {
  const handleRef = useRef<DynamicLightHandle | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    if (!enabled) {
      handleRef.current?.release();
      handleRef.current = null;
      return;
    }
    const p = propsRef.current;
    handleRef.current = acquire({
      color: p.color as DynamicLightColor,
      distance: typeof p.distance === 'number' ? p.distance : undefined,
      decay: typeof p.decay === 'number' ? p.decay : undefined,
    });
    return () => {
      handleRef.current?.release();
      handleRef.current = null;
    };
  }, [enabled, acquire]);

  useFrame(() => {
    const h = handleRef.current;
    const m = markerRef.current;
    if (!h || !m) return;
    m.getWorldPosition(_pooledLightWorld);
    h.setPosition(_pooledLightWorld.x, _pooledLightWorld.y, _pooledLightWorld.z);
    const p = propsRef.current;
    h.setIntensity(typeof p.intensity === 'number' ? p.intensity : 1);
    if (p.color != null) h.setColor(p.color as DynamicLightColor);
    if (typeof p.distance === 'number') h.setDistance(p.distance);
  });
}

function assignRef(ref: React.ForwardedRef<Group>, el: Group | null) {
  if (typeof ref === 'function') ref(el);
  else if (ref) (ref as { current: Group | null }).current = el;
}

/**
 * Drop-in replacement for a per-enemy `<pointLight>`. Renders an invisible marker at the
 * light's local position and drives a light borrowed from the fixed-size ENEMY pool at
 * the marker's world position, so spawning/dying enemies never change the light count
 * (which would recompile every lit shader). Honors the enemy-lights flag.
 */
export const EnemyDynamicLight = forwardRef<Group, PointLightProps>(
  function EnemyDynamicLight(props, ref) {
    const enabled = useEnemyLightsEnabled();
    const markerRef = useRef<Group | null>(null);
    usePooledMarkerLight(acquireEnemyLight, enabled, props, markerRef);
    return (
      <group
        ref={(el) => {
          markerRef.current = el;
          assignRef(ref, el);
        }}
        position={props.position}
      />
    );
  },
);

/**
 * Drop-in replacement for a per-player / per-ability `<pointLight>` (dragon cosmetics,
 * weapon and ability glows). Same as EnemyDynamicLight but borrows from the EFFECT pool
 * and is gated by the main dynamic-lights flag instead of the enemy-lights flag — so an
 * ally dying (their dragon/ability lights unmounting) no longer shifts the light count.
 */
export const PooledEffectLight = forwardRef<Group, PointLightProps>(
  function PooledEffectLight(props, ref) {
    const markerRef = useRef<Group | null>(null);
    // The effect pool follows the main flag; acquire returns a no-op when disabled.
    usePooledMarkerLight(acquireEffectLight, true, props, markerRef);
    return (
      <group
        ref={(el) => {
          markerRef.current = el;
          assignRef(ref, el);
        }}
        position={props.position}
      />
    );
  },
);
