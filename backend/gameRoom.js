const { broadcastEnemySpawn } = require('./enemyHandler');
const EnemyAI = require('./enemyAI');

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.players = new Map();
    this.enemies = new Map();
    this.towers = new Map(); // PVP towers
    this.lastUpdate = Date.now();
    this.io = io; // Store io reference for broadcasting
    
    // Game state management
    this.gameStarted = false;
    this.killCount = 0; // Shared kill count for all players
    this.gameMode = 'multiplayer'; // Default to multiplayer mode
    
    // Status effect tracking for enemies
    this.enemyStatusEffects = new Map(); // enemyId -> { stun: expiration, freeze: expiration, slow: expiration }
    
    // Initialize enemy AI system but don't start it yet
    this.enemyAI = new EnemyAI(roomId, io);
    this.enemyAI.setRoom(this);
    
    // Timer references for cleanup
    this.skeletonTimer = null;
    this.mageTimer = null;
    this.abominationTimer = null;
    this.reaperTimer = null;
    this.deathKnightTimer = null;
    this.ascendantTimer = null;
    this.fallenTitanTimer = null;
    
    console.log(`🎮 Game room ${roomId} created. Waiting for start game command...`);
  }

  // Start the actual game
  startGame(initiatingPlayerId) {
    if (this.gameStarted) {
      console.log(`🎮 Game already started in room ${this.roomId}`);
      return false;
    }
    
    console.log(`🎮 Starting game in room ${this.roomId}, initiated by player ${initiatingPlayerId}, mode: ${this.gameMode}`);
    this.gameStarted = true;
    
    // Only initialize enemies and AI for multiplayer mode, not PVP
    if (this.gameMode === 'multiplayer') {
      // Initialize with some basic enemies like the single-player version
      this.initializeEnemies();
      
      // Start enemy spawning timers
      this.startEnemySpawning();
      
      // Start enemy AI
      this.startEnemyAI();
      
      console.log(`🎯 Enemy systems started for multiplayer room ${this.roomId}`);
    } else if (this.gameMode === 'pvp') {
      console.log(`⚔️ PVP mode - no enemies will be spawned in room ${this.roomId}`);
    }
    
    // Broadcast game start to all players
    if (this.io) {
      this.io.to(this.roomId).emit('game-started', {
        roomId: this.roomId,
        initiatingPlayerId,
        killCount: this.killCount,
        timestamp: Date.now()
      });
    }
    
    return true;
  }

  // Player management
  addPlayer(playerId, playerName, weapon = 'scythe', subclass, gameMode = 'multiplayer') {
    // In PVP mode, players start with fixed health. In multiplayer, health scales with kill count
    const baseHealth = 200;
    const maxHealth = gameMode === 'pvp' ? baseHealth : baseHealth + this.killCount;
    
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      weapon: weapon,
      subclass: subclass,
      health: maxHealth, // Start with full health
      maxHealth: maxHealth,
      movementDirection: { x: 0, y: 0, z: 0 },
      joinedAt: Date.now()
    });
    
    // Create tower for PVP mode
    if (gameMode === 'pvp') {
      this.createTowerForPlayer(playerId, playerName);
    }
    
    console.log(`Player ${playerId} (${playerName}) joined room ${this.roomId} with ${weapon}${subclass ? ` (${subclass})` : ''}. Current kill count: ${this.killCount}`);
  }

  removePlayer(playerId) {
    this.players.delete(playerId);
    
    // Remove player's tower in PVP mode
    if (this.gameMode === 'pvp') {
      this.removeTowerForPlayer(playerId);
    }
    
    // Stop game if no players left
    if (this.players.size === 0 && this.gameStarted) {
      console.log(`🎮 No players left in room ${this.roomId}, stopping game`);
      this.stopGame();
    }
  }

  // Stop the game
  stopGame() {
    this.gameStarted = false;
    this.stopEnemySpawning();
    this.stopEnemyAI();
    
    // Clear all enemies
    this.enemies.clear();
    
    console.log(`🎮 Game stopped in room ${this.roomId}`);
  }

  getPlayer(playerId) {
    return this.players.get(playerId);
  }

  getPlayers() {
    return Array.from(this.players.values());
  }

  getPlayerCount() {
    return this.players.size;
  }

  // Tower management for PVP mode
  createTowerForPlayer(playerId, playerName) {
    const playerIndex = this.players.size - 1; // Current player index (0-based)
    const totalPlayers = 2; // Max players for positioning
    const mapRadius = 29;
    const towerRadius = mapRadius * 0.6; // Position towers more centrally (about 11.6 units from center)

    // Calculate angle for this player's position
    const angleStep = (Math.PI * 2) / Math.max(totalPlayers, 2);
    const angle = playerIndex * angleStep;

    // Calculate position
    const x = Math.sin(angle) * towerRadius;
    const z = Math.cos(angle) * towerRadius;
    const y = 0; // Ground level
    
    const towerId = `tower_${playerId}`;
    const tower = {
      id: towerId,
      ownerId: playerId,
      ownerName: playerName,
      towerIndex: playerIndex,
      position: { x, y, z },
      health: 111500,
      maxHealth: 500,
      isDead: false,
      createdAt: Date.now()
    };
    
    this.towers.set(towerId, tower);
    
    // Broadcast tower spawn to all players in the room
    if (this.io) {
      this.io.to(this.roomId).emit('tower-spawned', {
        roomId: this.roomId,
        tower: tower
      });
    }
    
    console.log(`🏰 Created tower ${towerId} for player ${playerId} (${playerName}) at position [${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)}] with 10-unit attack range`);
    return tower;
  }

  removeTowerForPlayer(playerId) {
    const towerId = `tower_${playerId}`;
    const tower = this.towers.get(towerId);
    
    if (tower) {
      // Mark tower as destroyed
      tower.isDead = true;
      tower.health = 0;
      
      // Broadcast tower destruction
      if (this.io) {
        this.io.to(this.roomId).emit('tower-destroyed', {
          roomId: this.roomId,
          towerId: towerId,
          ownerId: playerId
        });
      }
      
      // Remove from map after a delay to allow clients to process
      setTimeout(() => {
        this.towers.delete(towerId);
      }, 1000);
      
      console.log(`🏰 Removed tower ${towerId} for player ${playerId}`);
    }
  }

  damageTower(towerId, damage) {
    const tower = this.towers.get(towerId);
    if (!tower || tower.isDead) {
      return false;
    }
    
    const oldHealth = tower.health;
    tower.health = Math.max(0, tower.health - damage);
    const wasDestroyed = tower.health <= 0 && oldHealth > 0;
    
    if (wasDestroyed) {
      tower.isDead = true;
    }
    
    // Broadcast tower damage
    if (this.io) {
      this.io.to(this.roomId).emit('tower-damaged', {
        roomId: this.roomId,
        towerId: towerId,
        damage: damage,
        newHealth: tower.health,
        wasDestroyed: wasDestroyed
      });
      
      if (wasDestroyed) {
        this.io.to(this.roomId).emit('tower-destroyed', {
          roomId: this.roomId,
          towerId: towerId,
          ownerId: tower.ownerId
        });
      }
    }
    
    console.log(`🏰 Tower ${towerId} took ${damage} damage. Health: ${tower.health}/${tower.maxHealth}${wasDestroyed ? ' (DESTROYED)' : ''}`);
    return true;
  }

  getTowers() {
    return Array.from(this.towers.values());
  }

  getTower(towerId) {
    return this.towers.get(towerId);
  }

  getKillCount() {
    return this.killCount;
  }

  getGameStarted() {
    return this.gameStarted;
  }

  updatePlayerPosition(playerId, position, rotation, movementDirection) {
    const player = this.players.get(playerId);
    if (player) {
      player.position = position;
      player.rotation = rotation;
      if (movementDirection) {
        player.movementDirection = movementDirection;
      }
      player.lastUpdate = Date.now();
    }
  }

  updatePlayerWeapon(playerId, weapon, subclass) {
    const player = this.players.get(playerId);
    if (player) {
      player.weapon = weapon;
      player.subclass = subclass;
    }
  }

  updatePlayerHealth(playerId, health) {
    const player = this.players.get(playerId);
    if (player) {
      player.health = Math.max(0, Math.min(player.maxHealth, health));
    }
  }

  // Enemy management
  initializeEnemies() {
    if (!this.gameStarted) return;
    
    // Don't initialize enemies in PVP mode
    if (this.gameMode === 'pvp') {
      console.log(`🚫 Skipping enemy initialization in PVP mode for room ${this.roomId}`);
      return;
    }
    
    // Create initial enemies similar to single-player
    // Spawn 2 elite enemies to match the original local spawning
    this.spawnEnemy('elite');
    this.spawnEnemy('elite');
  }

  spawnEnemy(type) {
    if (!this.gameStarted) return null;
    
    // Don't spawn enemies in PVP mode
    if (this.gameMode === 'pvp') {
      console.log(`🚫 Attempted to spawn ${type} in PVP mode - ignoring`);
      return null;
    }
    
    const enemyId = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate random spawn position (same logic as single-player)
    const position = this.generateRandomPosition();
    
    const maxHealth = this.getEnemyMaxHealth(type);
    const enemyData = {
      id: enemyId,
      type,
      position,
      initialPosition: { ...position },
      rotation: 0,
      health: maxHealth,
      maxHealth: maxHealth,
      spawnedAt: Date.now(),
      isDying: false
    };
    
    console.log(`🎯 [Server] Spawning ${type} ${enemyId} with health: ${maxHealth}/${maxHealth} (level: ${this.getLevel(this.killCount)})`);

    this.enemies.set(enemyId, enemyData);
    
    // Broadcast enemy spawn to all players in the room
    if (this.io) {
      console.log(`🎯 Broadcasting enemy spawn: ${type} ${enemyId} to room ${this.roomId}`);
      broadcastEnemySpawn(this.io, this.roomId, enemyData);
    }
    
    return enemyData;
  }

  getEnemyMaxHealth(type) {
    // Use level-based health calculation like single player
    const currentLevel = this.getLevel(this.killCount);
    console.log(`🎯 [Server] Getting health for ${type} at level ${currentLevel} (killCount: ${this.killCount})`);
    
    switch (type) {
      case 'elite':
        // Elite enemies have base health of 1000, multiplied by level (like single player EnemyFactory)
        // Base health is 1000, level 2 = 2000 HP
        return 1000 * currentLevel;
      case 'skeleton':
        switch (currentLevel) {
          case 1: return 725;
          case 2: return 1084;
          case 3: return 1241;
          case 4: return 1361;
          case 5: return 1424;
          default: return 925;
        }
      case 'mage':
        switch (currentLevel) {
          case 1: return 684;
          case 2: return 829;
          case 3: return 925;
          case 4: return 1029;
          case 5: return 1141;
          default: return 684;
        }
      case 'reaper':
        switch (currentLevel) {
          case 2: return 1084;
          case 3: return 1241;
          case 4: return 1361;
          case 5: return 1424;
          default: return 1084;
        }
      case 'abomination':
        switch (currentLevel) {
          case 3: return 2304;
          case 4: return 2500;
          case 5: return 2704;
          default: return 2304;
        }
      case 'ascendant':
        switch (currentLevel) {
          case 4: return 2081;
          case 5: return 2249;
          default: return 2081;
        }
      case 'death-knight':
        switch (currentLevel) {
          case 3: return 1681;
          case 4: return 1849;
          case 5: return 2081;
          default: return 1681;
        }
      case 'fallen-titan':
        return 9704; // Fixed health for fallen titans
      default:
        return 9704; // Fallback health
    }
  }

  generateRandomPosition() {
    const angle = Math.random() * Math.PI * 2;
    const distance = 5 + Math.random() * 15; // Spawn 15-40 units away
    return {
      x: Math.cos(angle) * distance,
      y: 0,
      z: Math.sin(angle) * distance
    };
  }

  damageEnemy(enemyId, damage, fromPlayerId) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying) {
      return null;
    }

    const previousHealth = enemy.health;
    enemy.health = Math.max(0, enemy.health - damage);
    
    const result = {
      enemyId,
      newHealth: enemy.health,
      maxHealth: enemy.maxHealth,
      damage,
      fromPlayerId,
      wasKilled: previousHealth > 0 && enemy.health <= 0
    };

    if (result.wasKilled) {
      enemy.isDying = true;
      enemy.deathTime = Date.now();
      
      // Increment shared kill count
      this.killCount++;
      console.log(`💀 Enemy ${enemyId} killed by player ${fromPlayerId}. Room kill count: ${this.killCount}`);
      
      // Update all players' max health and heal them by 1
      this.players.forEach((player, playerId) => {
        const newMaxHealth = 200 + this.killCount;
        const newHealth = Math.min(newMaxHealth, player.health + 1);
        player.maxHealth = newMaxHealth;
        player.health = newHealth;
      });
      
      // Broadcast kill count update to all players
      if (this.io) {
        this.io.to(this.roomId).emit('kill-count-updated', {
          killCount: this.killCount,
          killedBy: fromPlayerId,
          enemyType: enemy.type,
          timestamp: Date.now()
        });
        
        // Also broadcast player health updates
        this.players.forEach((player, playerId) => {
          this.io.to(this.roomId).emit('player-health-updated', {
            playerId: playerId,
            health: player.health,
            maxHealth: player.maxHealth
          });
        });
      }
      
      // Clean up aggro when enemy dies
      if (this.enemyAI) {
        this.enemyAI.removeEnemyAggro(enemyId);
      }
      
      // Schedule enemy removal after death animation
      setTimeout(() => {
        this.enemies.delete(enemyId);
      }, 1500); // Match death animation duration
    }

    return result;
  }

  getEnemies() {
    return Array.from(this.enemies.values());
  }

  getEnemy(enemyId) {
    return this.enemies.get(enemyId);
  }

  // Function to calculate level based on kill count (same as Scene.tsx)
  getLevel(kills) {
    if (kills < 10) return 1;    
    if (kills < 25) return 2;     
    if (kills < 45) return 3;    
    if (kills < 70) return 4;   
    return 5;                      // Level 5: 70+ kills
  }

  // Enemy spawning system with level restrictions
  startEnemySpawning() {
    if (!this.gameStarted) return;
    
    // Don't start enemy spawning in PVP mode
    if (this.gameMode === 'pvp') {
      console.log(`🚫 Skipping enemy spawning timers in PVP mode for room ${this.roomId}`);
      return;
    }
    
    const MAX_ENEMIES = 5; // Match single player cap

    // Timer for regular skeletons: 2 every 13.5 seconds (matches Scene.tsx timing)
    this.skeletonTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Regular skeletons only spawn at levels 1-5 (no upper limit like single player had)
      
      const currentEnemyCount = this.enemies.size;
      if (currentEnemyCount >= MAX_ENEMIES) return;

      // Spawn up to 2 skeletons or fill remaining slots
      const spawnCount = Math.min(2, MAX_ENEMIES - currentEnemyCount);
      for (let i = 0; i < spawnCount; i++) {
        this.spawnEnemy('skeleton');
      }
    }, 13500); // Match Scene.tsx timing

    // Timer for skeletal mages: 1 every 20.5 seconds (matches Scene.tsx timing)
    this.mageTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Skeletal mages spawn at all levels (1-5)
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      // Check if there are already 2 skeletal mages on the map (maximum allowed)
      const existingMages = Array.from(this.enemies.values()).filter(enemy => enemy.type === 'mage' && !enemy.isDying);
      if (existingMages.length >= 2) return; // Don't spawn if 2 already exist
      
      this.spawnEnemy('mage');
    }, 20500); // Match Scene.tsx timing

    // Timer for abominations: 1 every 45 seconds (matches Scene.tsx timing)
    this.abominationTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Abominations only spawn at levels 3-5
      if (currentLevel < 3) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('abomination');
    }, 45000); // Match Scene.tsx timing

    // Timer for reapers: 1 every 22.5 seconds (matches Scene.tsx timing)
    this.reaperTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Reapers only spawn at levels 2-5
      if (currentLevel < 2) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('reaper');
    }, 22500); // Match Scene.tsx timing

    // Timer for death knights: 1 every 17.5 seconds (matches Scene.tsx timing)
    this.deathKnightTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Death Knights only spawn at levels 3-5
      if (currentLevel < 3) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('death-knight');
    }, 17500); // Match Scene.tsx timing

    // Timer for ascendants: 1 every 35 seconds (matches Scene.tsx timing)
    this.ascendantTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Ascendants only spawn at levels 4-5
      if (currentLevel < 4) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      this.spawnEnemy('ascendant');
    }, 35000); // Match Scene.tsx timing

    // Timer for fallen titans: 1 every 60 seconds (matches Scene.tsx timing)
    this.fallenTitanTimer = setInterval(() => {
      if (!this.gameStarted) return;
      
      const currentLevel = this.getLevel(this.killCount);
      // Level-based spawning constraint: Fallen Titans only spawn at level 5
      if (currentLevel < 5) return;
      
      if (this.enemies.size >= MAX_ENEMIES) return;
      
      // Check if there's already a Fallen Titan on the map (only one allowed)
      const existingFallenTitan = Array.from(this.enemies.values()).find(enemy => enemy.type === 'fallen-titan' && !enemy.isDying);
      if (existingFallenTitan) return; // Don't spawn if one already exists
      
      this.spawnEnemy('fallen-titan');
    }, 60000); // Match Scene.tsx timing
    
    console.log(`🎯 Enemy spawning started for room ${this.roomId}`);
  }

  // Stop enemy spawning
  stopEnemySpawning() {
    if (this.skeletonTimer) {
      clearInterval(this.skeletonTimer);
      this.skeletonTimer = null;
    }
    if (this.mageTimer) {
      clearInterval(this.mageTimer);
      this.mageTimer = null;
    }
    if (this.abominationTimer) {
      clearInterval(this.abominationTimer);
      this.abominationTimer = null;
    }
    if (this.reaperTimer) {
      clearInterval(this.reaperTimer);
      this.reaperTimer = null;
    }
    if (this.deathKnightTimer) {
      clearInterval(this.deathKnightTimer);
      this.deathKnightTimer = null;
    }
    if (this.ascendantTimer) {
      clearInterval(this.ascendantTimer);
      this.ascendantTimer = null;
    }
    if (this.fallenTitanTimer) {
      clearInterval(this.fallenTitanTimer);
      this.fallenTitanTimer = null;
    }
    console.log(`🎯 Enemy spawning stopped for room ${this.roomId}`);
  }

  // Start enemy AI system
  startEnemyAI() {
    if (this.gameStarted && this.players.size > 0) {
      // Don't start enemy AI in PVP mode
      if (this.gameMode === 'pvp') {
        console.log(`🚫 Skipping enemy AI in PVP mode for room ${this.roomId}`);
        return;
      }
      
      this.enemyAI.startAI();
      console.log(`🧠 Enemy AI started for room ${this.roomId}`);
    }
  }

  // Stop enemy AI system
  stopEnemyAI() {
    this.enemyAI.stopAI();
    console.log(`🧠 Enemy AI stopped for room ${this.roomId}`);
  }

  // Status effect management methods
  applyStatusEffect(enemyId, effectType, duration) {
    if (!this.enemies.has(enemyId)) return false;
    
    if (!this.enemyStatusEffects.has(enemyId)) {
      this.enemyStatusEffects.set(enemyId, {});
    }
    
    const effects = this.enemyStatusEffects.get(enemyId);
    effects[effectType] = Date.now() + duration;
    
    // Broadcast status effect to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-status-effect', {
        enemyId,
        effectType,
        duration,
        timestamp: Date.now()
      });
    }
    
    console.log(`🎯 Applied ${effectType} to enemy ${enemyId} for ${duration}ms`);
    return true;
  }

  isEnemyAffectedBy(enemyId, effectType) {
    const effects = this.enemyStatusEffects.get(enemyId);
    if (!effects || !effects[effectType]) return false;
    
    const now = Date.now();
    if (now > effects[effectType]) {
      // Effect expired, clean it up
      delete effects[effectType];
      return false;
    }
    
    return true;
  }

  getEnemyStatusEffects(enemyId) {
    const effects = this.enemyStatusEffects.get(enemyId);
    if (!effects) return {};
    
    const now = Date.now();
    const activeEffects = {};
    
    // Check each effect and remove expired ones
    Object.keys(effects).forEach(effectType => {
      if (now <= effects[effectType]) {
        activeEffects[effectType] = effects[effectType] - now; // Remaining duration
      } else {
        delete effects[effectType]; // Clean up expired effect
      }
    });
    
    return activeEffects;
  }

  // Cleanup when room is destroyed
  destroy() {
    console.log(`🗑️ Destroying room ${this.roomId}`);
    this.stopEnemySpawning();
    this.stopEnemyAI();
    
    this.players.clear();
    this.enemies.clear();
    this.enemyStatusEffects.clear();
    this.gameStarted = false;
    this.killCount = 0;
  }

  // Get room summary for debugging
  getSummary() {
    return {
      roomId: this.roomId,
      playerCount: this.players.size,
      enemyCount: this.enemies.size,
      gameStarted: this.gameStarted,
      killCount: this.killCount,
      lastUpdate: this.lastUpdate
    };
  }
}

module.exports = GameRoom;
