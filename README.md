# 🌑  Erebus β

A cooperative 1-3 player 3D boss battle action game featuring fast-paced real-time combat with a unique weapon/class system and boss encounter mechanics, emphasizing tactical positioning, resource management and coordinated party strategies within a fantasy/sci-fi arena.

**Custom Sound Effects: https://www.youtube.com/watch?v=4zXGMIMsG2k** (GarageBand)

### v0.7 Boss Abilities
![Spear2](https://github.com/user-attachments/assets/31e24563-2d63-42c2-9645-3cc977889355)

### v0.6 Redesigned Spear 
![Spear1](https://github.com/user-attachments/assets/24227104-6208-4e3e-9487-fbd11a9f89ca) <br>

### v0.5 Scythe Rework
![Pulsar](https://github.com/user-attachments/assets/569b3535-ab96-4183-9a37-5ccfd4f0fc64)

### v0.4 Ally Healing
![bowheal](https://github.com/user-attachments/assets/e0c4c545-8e06-4961-bc23-700b85691959)

### v0.3 Co-op Aggro System
![AggroSystem](https://github.com/user-attachments/assets/70b0485a-b29b-47f9-a228-5e8627a2766d)

### v0.2 Initial Boss Model
![BossPreRelease](https://github.com/user-attachments/assets/32f96a9d-e66b-404a-a984-fd2dbd04b866)


### ⚙️ Technical Specs
- **Real-time Multiplayer**: Socket.io-powered networking with sub-60ms latency
- **ECS Architecture**: Entity-Component-System for optimal performance and modularity
- **Advanced 3D Rendering**: Three.js with WebGL, LOD management, and instanced rendering
- **Spatial Audio**: Howler.js-powered 3D positional audio with 30+ unique sound effects
- **Performance Optimizations**: Object pooling, state batching, and performance monitoring
- **Scalable Backend**: Node.js server with automatic scaling and health monitoring
- **In-Game Chat Functionality**: Real-time multiplayer text communication with player names

## 🎨 Custom Model Creation & Visual Effects

**No external 3D models/assets used** - All models built from scratch using Three.js primitives and mathematical shapes, maintaining a consistent 'bone' theme throughout.

### v0.5 Bone Wings Upgrade
![BoneWingsUpgrade](https://github.com/user-attachments/assets/46d1397f-b87d-4f49-89d4-f90a4aba4cbb)

### Model Construction Techniques
- **Primitive Geometry Assembly**: Weapons and units built by combining cylinders, spheres, boxes, and custom geometries
- **Mathematical Shape Generation**: Three.js `Shape` class used to create complex 2D profiles extruded into 3D forms
  - **Quadratic Curves**: `quadraticCurveTo()` method creates Bézier curves for smooth, organic weapon shapes

    ```typescript
    // Runeblade shape creation using quadratic curves
    shape.lineTo(0, 0.08);
    shape.lineTo(-0.2, 0.12);
    shape.quadraticCurveTo(0.8, -0.15, -0.15, 0.12);  // Subtle curve along back
    shape.quadraticCurveTo(1.8, -0, 1.75, 0.05);      // Gentle curve towards tip
    shape.quadraticCurveTo(2.15, 0.05, 2.35, 0.225);   // Sharp point

    // Lower edge with pronounced curves
    shape.quadraticCurveTo(2.125, -0.125, 2.0, -0.25);  // Start curve from tip
    shape.quadraticCurveTo(1.8, -0.45, 1.675, -0.55);   // Peak of the curve
    shape.quadraticCurveTo(0.9, -0.35, 0.125, -0.325);  // Curve back towards guard
    ```
- **Procedural Detailing**: Bones, spikes, and organic structures generated algorithmically for visual consistency

### Visual Effects System
- **Emissive Materials**: Glowing effects achieved through Three.js emissive material properties and dynamic point lights
- **Instanced Mesh Rendering**: High-performance particle systems for trails, auras, and environmental effects
- **Material Shaders**: Custom material configurations for metallic, crystalline, and ethereal appearances
  - **Projectile Trail Shaders**: 

    ```glsl
    // Entropic Bolt Fragment Shader
    void main() {
      float d = length(gl_PointCoord - vec2(0.5));
      float strength = smoothstep(0.5, 0.1, d);
      vec3 glowColor;
      float emissiveMultiplier = 0.5;
      if (uIsCryoflame) {
        glowColor = mix(uColor, vec3(0.2, 0.4, 0.8), 0.4); // Cryoflame: deep navy blue
        emissiveMultiplier = 2.0;
      } else {
        glowColor = mix(uColor, vec3(1.0, 0.6, 0.0), 0.4); // Normal: orange fire effect
        emissiveMultiplier = 1.0;
      }
      gl_FragColor = vec4(glowColor * emissiveMultiplier, vOpacity * strength);
    }
    ```

  - **Ground Shader**: Procedural texturing with normal mapping, ambient occlusion, and subtle animation

    ```glsl
    // Enhanced Ground Fragment Shader
    void main() {
      vec4 colorSample = texture2D(colorMap, vUv);
      vec3 normalSample = texture2D(normalMap, vUv).rgb * 2.0 - 1.0;

      float distanceFromCenter = length(vPosition.xz) / 29.0;
      float ao = 1.0 - smoothstep(0.0, 1.0, distanceFromCenter) * 0.2;

      float animation = sin(vPosition.x * 0.01 + time * 0.1) * sin(vPosition.z * 0.01 + time * 0.07) * 0.02 + 1.0;

      vec3 finalColor = colorSample.rgb * animation * ao;

      float rim = 1.0 - dot(vNormal, vec3(0.0, 1.0, 0.0));
      rim = pow(rim, 3.0) * 0.1;
      finalColor += accentColor * rim;

      gl_FragColor = vec4(finalColor, 1.0);
    }
    ```
- **Dynamic Lighting**: Real-time light positioning and intensity modulation for atmospheric effects

### ECS Integration
- **Component-Based Rendering**: Visual components (Renderer, HealthBar, Collider) integrated with ECS architecture
- **System-Driven Animation**: Animation states managed through ECS components with React Three Fiber integration

## 🛠️ Technical Architecture

### Frontend Stack
- **Framework**: Next.js 14 with React 18
- **3D Engine**: Three.js with React Three Fiber
- **Networking**: Socket.io client with automatic reconnection
- **Audio**: Howler.js with spatial audio processing
- **UI**: Tailwind CSS with custom components
- **State**: React Context with optimized updates

### Backend Stack
- **Runtime**: Node.js with Express
- **WebSocket**: Socket.io with CORS support
- **Deployment**: Fly.io with auto-scaling
- **Monitoring**: Health checks and performance metrics

### Performance Features
- **Entity Component System**: Modular game object management with 13 specialized components
- **Object Pooling**: Pre-allocated objects for projectiles and effects with automatic cleanup
- **State Batching**: Optimized network updates with frame-based batching
- **Level-of-Detail**: Distance-based rendering optimization
- **Instanced Rendering**: Efficient crowd rendering for enemies
- **Spatial Hashing**: Fast collision detection for hundreds of entities


## 🏗️ Entity Component System (ECS) Architecture

### Core ECS Classes

#### **Entity** (`Entity.ts`)
- **Unique Identification**: Each entity has a unique auto-incrementing ID
- **Component Container**: Map-based storage of components with type-safe access
- **Component Queries**: Efficient checking for required component combinations
- **Lifecycle Management**: Active/inactive states and cleanup callbacks
- **User Data**: Arbitrary data storage for game-specific information

```typescript
const player = world.createEntity();
player.addComponent(new Transform(new Vector3(0, 0, 0)));
player.addComponent(new Movement(3.75, 0.8)); // speed, friction
player.addComponent(new Health(500));
```

#### **Component** (`Component.ts`)
- **Abstract Base Class**: All components inherit from `Component`
- **Reset Method**: Required for object pooling cleanup
- **Enabled Flag**: Runtime component activation/deactivation
- **Explicit Type Identifiers**: String-based component identification for performance

#### **System** (`System.ts`)
- **Component Requirements**: Array of required component types for entity filtering
- **Priority System**: Lower numbers execute first (0-100 range)
- **Lifecycle Callbacks**: `onEntityAdded`, `onEntityRemoved`, `onEnable`, `onDisable`
- **Specialized Subclasses**: `RenderSystem`, `PhysicsSystem` for different update types

#### **World** (`World.ts`)
- **Entity Registry**: Central management of all entities
- **System Orchestration**: Priority-sorted system execution
- **Component Pooling**: Automatic object pooling for performance
- **Event System**: Inter-system communication
- **Query System**: Efficient entity filtering by component combinations

```typescript
const world = new World();

// Add systems in priority order
world.addSystem(new MovementSystem(inputManager)); // priority 10
world.addSystem(new CollisionSystem());           // priority 20
world.addSystem(new CombatSystem(world));         // priority 30

// Main game loop
world.update(deltaTime);
world.fixedUpdate(fixedDeltaTime);
world.render(deltaTime);
```

### Component Types

#### **Core Components**
- **Transform**: Position, rotation, scale with matrix caching and parent-child hierarchies
- **Movement**: Physics simulation with velocity, acceleration, friction, and movement flags
- **Health**: Damage/healing system with regeneration, invulnerability, and death states
- **Shield**: Damage absorption with regeneration mechanics

#### **Gameplay Components**
- **Enemy**: AI behavior, target tracking, and enemy-specific properties
- **Projectile**: Bullet/projectile simulation with lifetime and collision detection
- **Tower**: Defensive structures with health and ownership
- **Pillar**: Destructible map objectives with health tracking
- **SummonedUnit**: Temporary allied units with ownership and targeting

#### **Rendering Components**
- **Renderer**: Visual representation with material and geometry management
  - **Instanced Rendering**: High-performance crowd rendering with individual instance control

    ```typescript
    public setupInstancing(instancedMesh: InstancedMesh, instanceId: number): void {
      this.isInstanced = true;
      this.instancedMesh = instancedMesh;
      this.instanceId = instanceId;
    }

    public updateInstanceMatrix(matrix: Matrix4): void {
      if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
        this.instancedMesh.setMatrixAt(this.instanceId, matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }

    public setInstanceVisible(visible: boolean): void {
      if (this.isInstanced && this.instancedMesh && this.instanceId >= 0) {
        const matrix = new Matrix4();
        this.instancedMesh.getMatrixAt(this.instanceId, matrix);

        if (!visible) {
          matrix.scale(new Vector3(0, 0, 0)); // Hide by scaling to zero
        }

        this.instancedMesh.setMatrixAt(this.instanceId, matrix);
        this.instancedMesh.instanceMatrix.needsUpdate = true;
      }
    }
    ```

  - **Dynamic Mesh Updates**: Runtime property synchronization for shadows and materials

    ```typescript
    public updateMesh(): void {
      if (!this.mesh) return;

      // Handle shadow properties for both Mesh and Group hierarchies
      if (this.mesh instanceof Mesh) {
        this.mesh.castShadow = this.castShadow;
        this.mesh.receiveShadow = this.receiveShadow;
      } else if (this.mesh instanceof Group) {
        this.mesh.traverse((child) => {
          if (child instanceof Mesh) {
            child.castShadow = this.castShadow;
            child.receiveShadow = this.receiveShadow;
          }
        });
      }

      this.mesh.frustumCulled = this.frustumCulled;
      this.mesh.visible = this.visible;
      this.mesh.renderOrder = this.renderOrder;

      if (this.needsUpdate && this.geometry && this.material && this.mesh instanceof Mesh) {
        this.mesh.geometry = this.geometry;
        this.mesh.material = this.material;
        this.needsUpdate = false;
      }
    }
    ```
- **HealthBar**: UI health display with dynamic positioning
- **Collider**: Collision detection shapes and boundaries

### System Architecture

#### **Update Systems**
- **MovementSystem**: WASD input, physics simulation, dash mechanics
- **CombatSystem**: Damage calculation, healing, death handling
- **ControlSystem**: Player input, weapon switching, ability management
- **CollisionSystem**: Spatial hash collision detection
- **AudioSystem**: Spatial audio positioning and playback

#### **Render Systems**
- **RenderSystem**: Three.js rendering with LOD management
- **CameraSystem**: Dynamic camera positioning and smoothing
- **HealthBarSystem**: Health bar positioning and updates

#### **Physics Systems** (Fixed Timestep)
- **PhysicsSystem**: Fixed-timestep physics simulation for consistency

### Performance Optimizations

#### **Component Pooling**
```typescript
// World automatically pools components for reuse
const transform = world.createComponent(Transform); // Reused from pool
world.returnComponent(transform); // Returned to pool for next use
```

#### **Entity Queries**
```typescript
// Query entities with specific component combinations
const enemies = world.queryEntities([Transform, Movement, Enemy]);
const projectiles = world.queryEntities([Transform, Projectile]);
```

#### **System Matching**
```typescript
// Systems only process entities with required components
class MovementSystem extends System {
  readonly requiredComponents = [Transform, Movement];

  update(entities: Entity[], deltaTime: number) {
    // Only entities with Transform AND Movement components
    entities.forEach(entity => { /* process */ });
  }
}
```

#### **Event-Driven Communication**
```typescript
// Systems communicate through world events
world.emitEvent('player_damaged', { playerId, damage, source });
world.emitEvent('enemy_killed', { enemyId, killerId });

// Other systems can listen for these events
const events = world.getEvents('enemy_killed');
```

### Custom ECS Architecture

- **Modularity**: Components and systems are independent and reusable
- **Performance**: Only relevant systems process relevant entities
- **Scalability**: Easy to add new entity types and behaviors
- **Maintainability**: Clear separation of data and logic
- **Memory Efficiency**: Object pooling prevents garbage collection spikes
- **Type Safety**: Full TypeScript support with component type checking

## 🧠 Complex State Management Architecture

The game's architecture manages multiple interconnected state systems simultaneously to maintain smooth real-time gameplay across multiplayer environments. Here's how complex state synchronization keeps the game running:

### Multiplayer State Synchronization

#### **Client-Server State Reconciliation**
- **Network Batching**: State updates batched per frame to reduce network overhead while maintaining real-time feel
- **Authoritative Server**: Server maintains true game state, clients interpolate for smooth visuals
- **Conflict Resolution**: Server-authoritative decisions for critical gameplay elements (damage, positioning, ability activation)

```typescript
// State batching prevents network spam while maintaining responsiveness
private batchStateUpdate(updates: any[]): void {
  if (this.stateBatch.length === 0) {
    setTimeout(() => this.flushBatch(), 16); // ~60fps batching
  }
  this.stateBatch.push(...updates);
}
```

#### **Entity State Propagation**
- **Selective Broadcasting**: Only relevant state changes broadcast to reduce bandwidth (position updates every 50ms, health changes immediate)
- **Delta Compression**: Only changed values transmitted, not full state snapshots
- **Prediction & Reconciliation**: Client-side prediction with server reconciliation for responsive feel

### Combat State Management

#### **Damage Calculation Pipeline**
```typescript
// Damage flows through multiple systems with state validation
1. DamageCalculator.calculateDamage() → base damage with crits
2. CombatSystem.queueDamage() → validation and queuing
3. DamageNumberManager.addDamageNumber() → visual feedback
4. Network broadcast → synchronize across clients
```

#### **Ability State Coordination**
- **Cooldown Tracking**: Per-weapon ability states with network synchronization
- **Charge Management**: Real-time charge progress tracking across client/server
- **State Dependencies**: Abilities check multiple state conditions (mana, cooldowns, weapon type)

```typescript
// Complex state checks prevent invalid ability usage
private canActivateAbility(abilityType: string): boolean {
  return this.checkManaCost() &&
         this.checkCooldown(abilityType) &&
         this.checkWeaponCompatibility() &&
         this.checkPlayerState();
}
```

### Enemy AI State Management

#### **Aggro & Behavior States**
- **Dynamic Aggro System**: Players gain/lose aggro based on damage dealt and proximity
- **Taunt Effects**: Temporary state overrides with duration tracking
- **Movement States**: Patrolling → Chasing → Attacking state transitions

```typescript
// Enemy AI maintains  internal state
updateEnemyAI(enemy) {
  switch(enemy.state) {
    case 'patrol': this.handlePatrolLogic();
    case 'aggro': this.handleAggroLogic();
    case 'taunt': this.handleTauntLogic();
    case 'stunned': this.handleStunLogic();
  }
}
```

### Player State Management

#### **Health & Resource States**
- **Multi-layered Health**: Base health + shield + regeneration mechanics
- **Mana System**: Runeblade-specific resource with consumption/regeneration
- **Debuff State Tracking**: Multiple concurrent effects (frozen, slowed, stunned, burning) with durations

### Performance State Management

#### **Object Pooling State**
```typescript
// Pooled objects maintain internal state for reuse
class ProjectilePool {
  private activeProjectiles: Map<string, ProjectileState>;
  private availablePool: ProjectileState[];

  getProjectile(): ProjectileState {
    const projectile = this.availablePool.pop() || new ProjectileState();
    projectile.reset(); // Clean state for reuse
    return projectile;
  }
}
```

#### **LOD State Management**
- **Distance-Based State**: Entities transition between detail levels automatically
- **Culling States**: Frustum culling + occlusion culling state management
- **Render State Batching**: Instanced meshes maintain individual state within optimized batches

### Network State Reliability

#### **Connection State Management**
- **Automatic Reconnection**: Socket.io with exponential backoff reconnection
- **State Synchronization**: Full state resync on reconnection to prevent desynchronization
- **Latency Compensation**: Client-side prediction with server validation

#### **Error Recovery States**
- **Graceful Degradation**: System continues operating during network issues
- **State Validation**: Server-side validation prevents invalid state transitions
- **Rollback Mechanisms**: Critical state rollbacks when network conflicts detected

### State Debugging & Monitoring

#### **Performance State Tracking**
- **FPS Monitoring**: Real-time performance metrics with automatic optimization triggers
- **Memory State**: Object pool utilization tracking to prevent memory leaks
- **Network State**: Latency, packet loss, and state synchronization monitoring

```typescript
// Performance monitoring maintains system health
private monitorSystemHealth(): void {
  if (this.fps < 30) this.enableLowPowerMode();
  if (this.memoryUsage > 0.8) this.triggerGarbageCollection();
  if (this.networkLatency > 100) this.reduceUpdateFrequency();
}
```

This multi-layered state management ensures the game maintains consistent, responsive gameplay across varying network conditions while preventing common multiplayer issues like state desynchronization, input lag, and performance degradation.

