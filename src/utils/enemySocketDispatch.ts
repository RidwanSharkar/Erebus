/**
 * Generic id-routed socket dispatcher for per-enemy animation/telegraph handlers.
 * Register handlers per entity id; mount one socket listener set at the scene level.
 */

export function createIdRoutedSocketDispatcher<
  T extends Record<string, ((...args: never[]) => void) | undefined>,
>() {
  const registry = new Map<string, T>();

  function register(id: string, handlers: T): () => void {
    registry.set(id, handlers);
    return () => {
      if (registry.get(id) === handlers) {
        registry.delete(id);
      }
    };
  }

  function dispatch<K extends keyof T>(
    id: string | undefined,
    key: K,
    data: Parameters<NonNullable<T[K]>>[0],
  ): void {
    if (!id) return;
    const handler = registry.get(id)?.[key];
    if (handler) {
      (handler as (arg: typeof data) => void)(data);
    }
  }

  return { register, dispatch, registry };
}
