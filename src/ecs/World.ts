// Entity Component System - World Management
import { Entity, EntityId, Component } from './Entity';
import { System, RenderSystem, PhysicsSystem } from './System';
import { ObjectPool } from '@/utils/ObjectPool';

export class World {
  private entities = new Map<EntityId, Entity>();
  private systems: System[] = [];
  private renderSystems: RenderSystem[] = [];
  private physicsSystems: PhysicsSystem[] = [];
  private componentPools = new Map<string, ObjectPool<any>>();
  private entitiesToDestroy: EntityId[] = [];
  private events = new Map<string, any[]>();
  /** Component-type → entity ids for fast query intersection. */
  private entitiesByComponent = new Map<string, Set<EntityId>>();
  /** Reusable query result buffer per component signature. */
  private queryResultCache = new Map<string, Entity[]>();

  private getComponentTypeName(componentType: new () => Component): string {
    return (componentType as { componentType?: string }).componentType || componentType.name;
  }

  private getComponentKey(componentTypes: (new () => Component)[]): string {
    return componentTypes.map((t) => this.getComponentTypeName(t)).sort().join('|');
  }

  private indexEntity(entity: Entity): void {
    for (const component of entity.getAllComponents()) {
      const name = (component as { componentType?: string }).componentType || component.constructor.name;
      let bucket = this.entitiesByComponent.get(name);
      if (!bucket) {
        bucket = new Set();
        this.entitiesByComponent.set(name, bucket);
      }
      bucket.add(entity.id);
    }
  }

  private unindexEntity(entity: Entity): void {
    for (const component of entity.getAllComponents()) {
      const name = (component as { componentType?: string }).componentType || component.constructor.name;
      this.entitiesByComponent.get(name)?.delete(entity.id);
    }
  }

  private invalidateQueryCaches(): void {
    this.queryResultCache.clear();
  }

  // Entity management
  public createEntity(): Entity {
    const entity = new Entity();
    this.entities.set(entity.id, entity);
    return entity;
  }

  public destroyEntity(entityId: EntityId): void {
    this.entitiesToDestroy.push(entityId);
  }

  // Notify systems that an entity has been fully configured and is ready
  public notifyEntityAdded(entity: Entity): void {
    this.indexEntity(entity);
    this.invalidateQueryCaches();
    for (const system of this.systems) {
      if (system.onEntityAdded && system.matchesEntity(entity)) {
        system.onEntityAdded(entity);
      }
    }
  }

  public getEntity(entityId: EntityId): Entity | undefined {
    return this.entities.get(entityId);
  }

  public getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  // System management
  public addSystem(system: System): void {
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);

    if (system instanceof RenderSystem) {
      this.renderSystems.push(system);
    }
    if (system instanceof PhysicsSystem) {
      this.physicsSystems.push(system);
    }

    system.onEnable?.();
  }

  public getSystem<T extends System>(systemClass: new (...args: any[]) => T): T | undefined {
    return this.systems.find(system => system instanceof systemClass) as T | undefined;
  }

  public removeSystem(systemType: new () => System): void {
    const index = this.systems.findIndex(s => s instanceof systemType);
    if (index !== -1) {
      const system = this.systems[index];
      system.onDisable?.();
      this.systems.splice(index, 1);

      // Remove from specialized arrays
      const renderIndex = this.renderSystems.findIndex(s => s === system);
      if (renderIndex !== -1) this.renderSystems.splice(renderIndex, 1);

      const physicsIndex = this.physicsSystems.findIndex(s => s === system);
      if (physicsIndex !== -1) this.physicsSystems.splice(physicsIndex, 1);
    }
  }

  // Component pooling for performance
  public createComponent<T extends Component>(componentType: new () => T): T {
    // Use explicit componentType if available, fallback to constructor name
    const typeName = (componentType as any).componentType || componentType.name;
    
    // Disable pooling for components that have prototype method issues in production
    const problematicComponents = ['Health', 'HealthBar', 'Transform', 'Movement', 'Collider', 'Renderer', 'Enemy', 'Projectile', 'Animation'];
    if (problematicComponents.includes(typeName)) {
      return new componentType();
    }
    
    let pool = this.componentPools.get(typeName);
    
    if (!pool) {
      pool = new ObjectPool<T>(() => new componentType(), (obj) => obj.reset(), 100);
      this.componentPools.set(typeName, pool);
    }
    
    return pool.acquire();
  }

  public returnComponent<T extends Component>(component: T): void {
    const pool = this.componentPools.get(component.constructor.name);
    if (pool) {
      pool.release(component);
    }
  }

  // Main update loop
  public update(deltaTime: number): void {
    // Clean up destroyed entities
    this.cleanupDestroyedEntities();

    // Update all systems
    for (const system of this.systems) {
      if (!system.enabled) continue;

      const matchingEntities = this.getEntitiesForSystem(system);
      system.update(matchingEntities, deltaTime);
    }
  }

  // Fixed timestep physics update
  public fixedUpdate(fixedDeltaTime: number): void {
    for (const system of this.physicsSystems) {
      if (!system.enabled) continue;

      const matchingEntities = this.getEntitiesForSystem(system);
      system.fixedUpdate(matchingEntities, fixedDeltaTime);
    }
  }

  // Render update
  public render(deltaTime: number): void {
    for (const system of this.renderSystems) {
      if (!system.enabled) continue;

      const matchingEntities = this.getEntitiesForSystem(system);
      system.render(matchingEntities, deltaTime);
    }
  }

  // Get entities that match a system's requirements
  private getEntitiesForSystem(system: System): Entity[] {
    if (system.requiredComponents.length === 0) {
      const out: Entity[] = [];
      for (const entity of Array.from(this.entities.values())) {
        if (system.matchesEntity(entity)) out.push(entity);
      }
      return out;
    }
    return this.queryEntities(system.requiredComponents);
  }

  // Clean up destroyed entities
  private cleanupDestroyedEntities(): void {
    for (const entityId of this.entitiesToDestroy) {
      const entity = this.entities.get(entityId);
      if (entity) {
        // Notify systems about entity removal
        for (const system of this.systems) {
          if (system.onEntityRemoved && system.matchesEntity(entity)) {
            system.onEntityRemoved(entity);
          }
        }
        
        // Return components to pools
        for (const component of entity.getAllComponents()) {
          this.returnComponent(component);
        }
        
        this.unindexEntity(entity);
        entity.destroy();
        this.entities.delete(entityId);
      }
    }
    this.entitiesToDestroy.length = 0;
    this.invalidateQueryCaches();
  }

  // Query entities by components — uses component index (smallest-set first).
  public queryEntities(componentTypes: (new () => Component)[]): Entity[] {
    if (componentTypes.length === 0) {
      return Array.from(this.entities.values()).filter((e) => e.isActive());
    }

    const key = this.getComponentKey(componentTypes);
    const cached = this.queryResultCache.get(key);
    if (cached) return cached;

    const buckets = componentTypes.map((t) => this.entitiesByComponent.get(this.getComponentTypeName(t)));
    if (buckets.some((b) => !b || b.size === 0)) {
      const empty: Entity[] = [];
      this.queryResultCache.set(key, empty);
      return empty;
    }

    const sorted = [...buckets].sort((a, b) => a!.size - b!.size);
    const result: Entity[] = [];
    for (const id of Array.from(sorted[0]!)) {
      const entity = this.entities.get(id);
      if (entity?.isActive() && entity.hasComponents(componentTypes)) {
        result.push(entity);
      }
    }
    this.queryResultCache.set(key, result);
    return result;
  }

  // Event system
  public emitEvent(eventType: string, eventData: any): void {
    if (!this.events.has(eventType)) {
      this.events.set(eventType, []);
    }
    this.events.get(eventType)!.push(eventData);
  }

  public getEvents(eventType: string): any[] {
    return this.events.get(eventType) || [];
  }

  public clearEvents(eventType: string): void {
    this.events.set(eventType, []);
  }

  public destroy(): void {
    // Clean up all entities
    for (const entity of Array.from(this.entities.values())) {
      entity.destroy();
    }
    this.entities.clear();

    // Clean up systems
    for (const system of this.systems) {
      system.onDisable?.();
    }
    this.systems.length = 0;
    this.renderSystems.length = 0;
    this.physicsSystems.length = 0;

    // Clear component pools
    this.componentPools.clear();
    
    // Clear events
    this.events.clear();
  }
}
