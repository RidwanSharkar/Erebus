// Tower factory for creating and managing PVP tower entities
import { Vector3, Color, Mesh, BoxGeometry, CylinderGeometry, MeshStandardMaterial, Group } from '@/utils/three-exports';
import { Entity } from '@/ecs/Entity';
import { World } from '@/ecs/World';
import { Transform } from '@/ecs/components/Transform';
import { Health } from '@/ecs/components/Health';
import { Tower } from '@/ecs/components/Tower';
import { Collider, CollisionLayer, ColliderType } from '@/ecs/components/Collider';
import { Renderer } from '@/ecs/components/Renderer';

export interface TowerSpawnConfig {
  ownerId: string;
  towerIndex: number;
  position: Vector3;
  health?: number;
  scale?: number;
  color?: Color;
}

export class TowerFactory {
  private world: World;
  private mapRadius: number;
  
  // Tower visual configuration
  private towerHeight = 4;
  private towerBaseRadius = 1.5;
  private towerTopRadius = 1;
  
  constructor(world: World, mapRadius: number = 29) {
    this.world = world;
    this.mapRadius = mapRadius;
  }
  
  /**
   * Calculate tower position based on player join order
   * Players are positioned around the map edge in a circular pattern
   */
  public calculateTowerPosition(playerIndex: number, totalPlayers: number = 5): Vector3 {
    // Position towers around the edge of the map
    // Use a slightly smaller radius to keep towers inside the map boundary
    const towerRadius = this.mapRadius - 3; // 3 units inside the map edge
    
    // Calculate angle for this player's position
    // Start at 0 degrees (positive Z axis) and distribute evenly
    const angleStep = (Math.PI * 2) / Math.max(totalPlayers, 2); // Ensure at least 2 positions
    const angle = playerIndex * angleStep;
    
    // Calculate position
    const x = Math.sin(angle) * towerRadius;
    const z = Math.cos(angle) * towerRadius;
    const y = 0; // Ground level
    
    return new Vector3(x, y, z);
  }
  
  /**
   * Create a tower for a specific player
   */
  public createTower(config: TowerSpawnConfig): Entity {
    const entity = this.world.createEntity();
    const scale = config.scale || 1;
    
    // Add Transform component
    const transform = this.world.createComponent(Transform);
    transform.position.copy(config.position);
    transform.setScale(scale, scale, scale);
    entity.addComponent(transform);
    
    // Add Tower component
    const tower = this.world.createComponent(Tower);
    tower.ownerId = config.ownerId;
    tower.towerIndex = config.towerIndex;
    entity.addComponent(tower);
    
    // Add Health component - 500 HP as specified
    const health = new Health(config.health || 500);
    health.currentHealth = health.maxHealth;
    // No regeneration for towers - they're meant to be destructible
    entity.addComponent(health);
    
    // Add Collider component
    const collider = this.world.createComponent(Collider);
    collider.type = ColliderType.CYLINDER;
    collider.radius = this.towerBaseRadius * scale;
    collider.height = this.towerHeight * scale;
    collider.layer = CollisionLayer.ENEMY; // Use enemy layer so projectiles can hit towers
    collider.setMask(CollisionLayer.ENVIRONMENT | CollisionLayer.PLAYER); // Collide with environment and players
    collider.setOffset(0, (this.towerHeight * scale) * 0.5, 0); // Center vertically
    entity.addComponent(collider);
    
    // Add Renderer component
    const renderer = this.world.createComponent(Renderer);
    const towerMesh = this.createTowerMesh(config.color, scale);
    renderer.mesh = towerMesh; // Directly assign the mesh
    entity.addComponent(renderer);
    
    // Notify systems that the entity is ready
    this.world.notifyEntityAdded(entity);
    
    console.log(`🏰 Created tower for player ${config.ownerId} at position [${config.position.x.toFixed(2)}, ${config.position.y.toFixed(2)}, ${config.position.z.toFixed(2)}]`);
    
    return entity;
  }
  
  /**
   * Create tower mesh for visual representation
   */
  private createTowerMesh(color?: Color, scale: number = 1): Group {
    const towerGroup = new Group();
    
    // Default colors for different players
    const defaultColors = [
      new Color(0x4A90E2), // Blue
      new Color(0xFF6B35), // Orange
      new Color(0x50C878), // Green
      new Color(0x9B59B6), // Purple
      new Color(0xF39C12)  // Yellow
    ];
    
    const towerColor = color || defaultColors[0];
    
    // Create tower base (cylinder)
    const baseGeometry = new CylinderGeometry(
      this.towerTopRadius * scale,
      this.towerBaseRadius * scale,
      this.towerHeight * scale,
      8
    );
    const baseMaterial = new MeshStandardMaterial({
      color: towerColor,
      metalness: 0.3,
      roughness: 0.7
    });
    const baseMesh = new Mesh(baseGeometry, baseMaterial);
    baseMesh.position.y = (this.towerHeight * scale) * 0.5;
    baseMesh.castShadow = true;
    baseMesh.receiveShadow = true;
    towerGroup.add(baseMesh);
    
    // Create tower top (smaller cylinder for the turret)
    const topGeometry = new CylinderGeometry(
      this.towerTopRadius * 0.8 * scale,
      this.towerTopRadius * 0.8 * scale,
      0.5 * scale,
      8
    );
    const topMaterial = new MeshStandardMaterial({
      color: towerColor.clone().multiplyScalar(1.2), // Slightly brighter
      metalness: 0.5,
      roughness: 0.5
    });
    const topMesh = new Mesh(topGeometry, topMaterial);
    topMesh.position.y = this.towerHeight * scale + 0.25 * scale;
    topMesh.castShadow = true;
    topMesh.receiveShadow = true;
    towerGroup.add(topMesh);
    
    // Create cannon barrel (small cylinder)
    const barrelGeometry = new CylinderGeometry(
      0.1 * scale,
      0.1 * scale,
      1 * scale,
      6
    );
    const barrelMaterial = new MeshStandardMaterial({
      color: 0x2C3E50, // Dark gray
      metalness: 0.8,
      roughness: 0.2
    });
    const barrelMesh = new Mesh(barrelGeometry, barrelMaterial);
    barrelMesh.rotation.z = Math.PI / 2; // Rotate to horizontal
    barrelMesh.position.set(0.5 * scale, this.towerHeight * scale + 0.25 * scale, 0);
    barrelMesh.castShadow = true;
    towerGroup.add(barrelMesh);
    
    // Add some detail blocks
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const detailGeometry = new BoxGeometry(0.2 * scale, 0.3 * scale, 0.2 * scale);
      const detailMaterial = new MeshStandardMaterial({
        color: towerColor.clone().multiplyScalar(0.8), // Darker
        metalness: 0.4,
        roughness: 0.8
      });
      const detailMesh = new Mesh(detailGeometry, detailMaterial);
      detailMesh.position.set(
        Math.cos(angle) * this.towerBaseRadius * 0.9 * scale,
        this.towerHeight * 0.3 * scale,
        Math.sin(angle) * this.towerBaseRadius * 0.9 * scale
      );
      detailMesh.castShadow = true;
      detailMesh.receiveShadow = true;
      towerGroup.add(detailMesh);
    }
    
    // Mark as tower mesh for identification
    towerGroup.userData.isTower = true;
    towerGroup.userData.towerColor = towerColor;
    
    return towerGroup;
  }
  
  /**
   * Create towers for all players in a PVP match
   */
  public createTowersForPlayers(playerIds: string[]): Entity[] {
    const towers: Entity[] = [];
    const totalPlayers = Math.max(playerIds.length, 2); // Ensure at least 2 positions
    
    // Default colors for different players
    const playerColors = [
      new Color(0x4A90E2), // Blue
      new Color(0xFF6B35), // Orange  
      new Color(0x50C878), // Green
      new Color(0x9B59B6), // Purple
      new Color(0xF39C12)  // Yellow
    ];
    
    playerIds.forEach((playerId, index) => {
      const position = this.calculateTowerPosition(index, totalPlayers);
      const color = playerColors[index % playerColors.length];
      
      const tower = this.createTower({
        ownerId: playerId,
        towerIndex: index,
        position: position,
        health: 500,
        scale: 1,
        color: color
      });
      
      towers.push(tower);
    });
    
    console.log(`🏰 Created ${towers.length} towers for PVP match with ${playerIds.length} players`);
    return towers;
  }
  
  /**
   * Get the color assigned to a specific player index
   */
  public getPlayerColor(playerIndex: number): Color {
    const playerColors = [
      new Color(0x4A90E2), // Blue
      new Color(0xFF6B35), // Orange  
      new Color(0x50C878), // Green
      new Color(0x9B59B6), // Purple
      new Color(0xF39C12)  // Yellow
    ];
    
    return playerColors[playerIndex % playerColors.length];
  }
  
  /**
   * Remove all towers owned by a specific player
   */
  public removeTowersForPlayer(ownerId: string): void {
    const allTowers = this.world.queryEntities([Transform, Tower, Health]);
    const playerTowers = allTowers.filter(entity => {
      const tower = entity.getComponent(Tower);
      return tower && tower.ownerId === ownerId;
    });
    
    playerTowers.forEach(entity => {
      // Mark tower as dead instead of removing immediately
      const health = entity.getComponent(Health);
      const tower = entity.getComponent(Tower);
      if (health && tower) {
        health.currentHealth = 0;
        health.isDead = true;
        tower.die(Date.now() / 1000);
      }
    });
    
    console.log(`🏰 Removed ${playerTowers.length} towers for player ${ownerId}`);
  }
}
