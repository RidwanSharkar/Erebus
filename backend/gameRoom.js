const { broadcastEnemySpawn } = require('./enemyHandler');
const EnemyAI = require('./enemyAI');

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.players = new Map();
    this.enemies = new Map();
    this.lastUpdate = Date.now();
    this.io = io; // Store io reference for broadcasting

    // Game state management
    this.gameStarted = false;
    this.killCount = 0; // Shared kill count for all players
    this.gameMode = 'coop'; // Default to co-op mode

    // Item drop system
    this.droppedItems = new Map(); // itemId -> { id, type, stat, label, position, droppedAt }

    // Status effect tracking for enemies
    this.enemyStatusEffects = new Map(); // enemyId -> { stun: expiration, freeze: expiration, slow: expiration }

    // Initialize enemy AI system but don't start it yet
    this.enemyAI = new EnemyAI(roomId, io);
    this.enemyAI.setRoom(this);

    // Timer references for cleanup
    this.bossSpawnTimer = null;

    // Track when game started for boss spawning
    this.gameStartTime = 0;
    this.bossSpawned = false;

    // Kill tracking toward boss trigger (15 knights must be killed)
    this.skeletonKillCount = 0;
  }

  // Fixed knight spawn positions — 5 groups of 3 spread across the map
  static get KNIGHT_POSITIONS() {
    return [
      // Group 1 — North Gate
      { x:  0,   y: 0, z: -14 },
      { x: -3,   y: 0, z: -11 },
      { x:  3,   y: 0, z: -11 },
      // Group 2 — Northeast Ruins
      { x: 13,   y: 0, z: -11 },
      { x: 16,   y: 0, z:  -8 },
      { x: 10,   y: 0, z:  -8 },
      // Group 3 — East Outpost
      { x: 20,   y: 0, z:   0 },
      { x: 20,   y: 0, z:   4 },
      { x: 17,   y: 0, z:   2 },
      // Group 4 — South Grove
      { x:  5,   y: 0, z:  16 },
      { x:  2,   y: 0, z:  13 },
      { x:  8,   y: 0, z:  13 },
      // Group 5 — West Crossing
      { x: -18,  y: 0, z:   0 },
      { x: -15,  y: 0, z:   4 },
      { x: -15,  y: 0, z:  -4 },
    ];
  }

  // Start the actual game
  startGame(initiatingPlayerId) {
    if (this.gameStarted) {
      return false;
    }

    this.gameStarted = true;
    this.gameStartTime = Date.now();
    this.bossSpawned = false;
    this.skeletonKillCount = 0;

    // Initialize enemies and AI for co-op mode
    if (this.gameMode === 'coop') {
      this.initializeEnemies();

      // Start enemy AI
      this.startEnemyAI();
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
  addPlayer(playerId, playerName, weapon = 'scythe', subclass, gameMode = 'coop') {
    // In co-op mode, health scales with kill count
    const baseHealth = 500;
    const maxHealth = baseHealth + this.killCount;

    // Create player object with default position
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      position: { x: 0, y: 1, z: 0 }, // Default spawn position
      rotation: { x: 0, y: 0, z: 0 },
      weapon: weapon,
      subclass: subclass,
      health: maxHealth, // Start with full health
      maxHealth: maxHealth,
      level: 1, // Start at level 1
      essence: 50, // Start with 50 essence
      movementDirection: { x: 0, y: 0, z: 0 },
      joinedAt: Date.now(),
      isStealthing: false, // Sabres stealth ability state
      isInvisible: false // Whether player is currently invisible
    });

    // Position players in a small cluster near the south edge for co-op mode
    if (gameMode === 'coop') {
      const playerIndex = this.players.size - 1; // Current player index (0-based, after adding)
      const totalPlayers = 3; // Max players for positioning

      // Spawn base is at the south edge of the playable area
      const spawnBaseX = 0;
      const spawnBaseZ = 28;

      // Arrange players in a tight arc around the base point, facing north (toward the action)
      const angleStep = (Math.PI * 2) / totalPlayers;
      const angle = playerIndex * angleStep;
      const spawnRadius = 2.5;

      const playerPosition = {
        x: spawnBaseX + Math.sin(angle) * spawnRadius,
        y: 1,
        z: spawnBaseZ + Math.cos(angle) * spawnRadius
      };
      const playerRotation = { x: 0, y: Math.PI, z: 0 }; // Face north toward the map center

      // Update player object with correct position and rotation
      const player = this.players.get(playerId);
      if (player) {
        player.position = playerPosition;
        player.rotation = playerRotation;
      }
    }
  }

  removePlayer(playerId) {
    this.players.delete(playerId);

    // Stop game if no players left
    if (this.players.size === 0 && this.gameStarted) {
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

  // Enemy management
  initializeEnemies() {
    if (!this.gameStarted) return;

    if (this.gameMode === 'coop') {
      this.initializeKnights();
    }
  }

  // Place all 15 knights at fixed map positions and broadcast them to clients
  initializeKnights() {
    const positions = GameRoom.KNIGHT_POSITIONS;
    const soulTypes = ['green', 'red', 'blue', 'purple'];

    positions.forEach((pos, index) => {
      const knightId = `knight-${index}-${Date.now()}`;

      const knight = {
        id: knightId,
        type: 'knight',
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: 0,
        health: 850,
        maxHealth: 850,
        isDying: false,
        damage: 25,
        bossId: null,
        soulType: soulTypes[Math.floor(Math.random() * soulTypes.length)]
      };

      this.enemies.set(knightId, knight);

      if (this.io) {
        this.io.to(this.roomId).emit('enemy-spawned', {
          enemy: knight,
          timestamp: Date.now()
        });
      }
    });

    console.log(`⚔️ Placed ${positions.length} knights at fixed positions — kill all to summon the boss`);
  }

  spawnEnemy(type) {
    // This function is deprecated - use spawnBoss() instead for co-op mode
    return null;
  }

  getEnemyMaxHealth(type) {
    // Co-op mode only supports boss enemies
    if (type === 'boss') {
      return 37500; // Boss has fixed 37,500 HP
    }
    
    return 37500; // Fallback to boss health
  }

  generateRandomPosition() {
    // Not used for boss (boss always spawns at center)
    // Kept for compatibility but returns center position
    return { x: 0, y: 0, z: 0 };
  }

  damageEnemy(enemyId, damage, fromPlayerId, player = null) {
    const enemy = this.enemies.get(enemyId);
    if (!enemy || enemy.isDying) {
      // Silently reject damage to dying/dead enemies (prevents spam)
      return null;
    }

    const previousHealth = enemy.health;
    enemy.health = Math.max(0, enemy.health - damage);

    console.log(`💥 Enemy ${enemyId} (${enemy.type}) damaged by ${damage} from player ${fromPlayerId}. Health: ${previousHealth} -> ${enemy.health}`);

    // Track damage for aggro system
    if (this.enemyAI && fromPlayerId) {
      if (enemy.type === 'boss') {
        this.enemyAI.trackBossDamage(enemyId, fromPlayerId, damage, player);
      } else {
        // Apply aggro for regular enemies too
        let aggroAmount = damage;
        if (player && player.isStealthing) {
          aggroAmount *= 10.0; // Same 10x multiplier as bosses
          console.log(`👤 Stealth aggro bonus: Player ${fromPlayerId} stealth attack on enemy ${enemyId} (${damage} -> ${aggroAmount} aggro)`);
        }
        this.enemyAI.updateAggro(enemyId, fromPlayerId, aggroAmount);
      }
    }

    const result = {
      enemyId,
      newHealth: enemy.health,
      maxHealth: enemy.maxHealth,
      damage,
      fromPlayerId,
      wasKilled: previousHealth > 0 && enemy.health <= 0
    };

    if (result.wasKilled) {
      console.log(`💀 Enemy ${enemyId} killed by player ${fromPlayerId}`);
      enemy.isDying = true;
      enemy.deathTime = Date.now();

      // Special rewards for boss kills
      if (enemy.type === 'boss') {
        // Award significant EXP to all players for defeating the boss
        if (this.io) {
          this.players.forEach((player, playerId) => {
            this.io.to(this.roomId).emit('player-experience-gained', {
              playerId: playerId,
              experienceGained: 1000, // 1000 EXP for boss kill
              source: 'boss_kill',
              enemyId: enemyId,
              timestamp: Date.now()
            });
          });

          // Broadcast special boss defeated message
          this.io.to(this.roomId).emit('boss-defeated', {
            bossId: enemyId,
            killedBy: fromPlayerId,
            timestamp: Date.now()
          });

          // Always drop 2 random unique boss reward items
          this.spawnBossItemDrops(enemy.position);
        }
        
        console.log(`🎉 BOSS DEFEATED by player ${fromPlayerId}!`);
      } else if (enemy.type === 'boss-skeleton') {
        // Handle boss skeleton death
        if (enemy.bossId && this.enemyAI) {
          this.enemyAI.removeBossSkeleton(enemy.bossId, enemyId);
        }

        // Award +50 EXP for boss skeleton kills to the killer
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 50,
            source: 'boss_skeleton_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        // Track boss-skeleton kills (boss-summoned only — won't trigger boss since bossSpawned is true)
        if (!this.bossSpawned) {
          this.skeletonKillCount++;
          console.log(`💀 Skeleton killed (${this.skeletonKillCount}/15)`);

          if (this.io) {
            this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
              skeletonKillCount: this.skeletonKillCount,
              required: 15,
              timestamp: Date.now()
            });
          }

          if (this.skeletonKillCount >= 15) {
            console.log('💀💀💀 15 enemies killed - Boss is appearing!');
            this.spawnBoss();
            this.bossSpawned = true;
          }
        }

        // 10% chance to drop an amulet on skeleton death
        if (Math.random() < 0.10) {
          this.spawnItemDrop(enemy.position);
        }

        // Remove skeleton immediately (no death animation delay)
        this.enemies.delete(enemyId);
        console.log(`🗑️ Boss skeleton ${enemyId} removed immediately from enemies map`);

        // Broadcast immediate removal to all clients
        if (this.io) {
          this.io.to(this.roomId).emit('enemy-removed', {
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        // Clean up aggro immediately
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        // Return early to skip the setTimeout cleanup below
        return result;

      } else if (enemy.type === 'knight') {
        // Award +65 EXP for knight kills (tougher than skeleton)
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 65,
            source: 'knight_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

        // Knights count toward the boss-trigger kill count (all 15 must die)
        if (!this.bossSpawned) {
          this.skeletonKillCount++;
          console.log(`⚔️ Knight killed (${this.skeletonKillCount}/15)`);

          if (this.io) {
            this.io.to(this.roomId).emit('skeleton-kill-count-updated', {
              skeletonKillCount: this.skeletonKillCount,
              required: 15,
              timestamp: Date.now()
            });
          }

          if (this.skeletonKillCount >= 15) {
            console.log('⚔️⚔️⚔️ All 15 knights killed - Boss is appearing!');
            this.spawnBoss();
            this.bossSpawned = true;
          }
        }

        // 15% chance to drop an amulet on knight death
        if (Math.random() < 0.15) {
          this.spawnItemDrop(enemy.position);
        }

        // Emit vortex death effect BEFORE removing so clients know the position
        if (this.io) {
          this.io.to(this.roomId).emit('knight-death-vortex', {
            enemyId: enemyId,
            position: { x: enemy.position.x, y: enemy.position.y, z: enemy.position.z },
            timestamp: Date.now()
          });
        }

        // Stop AI targeting this knight immediately, but delay removal so
        // clients have time to play the death animation + opacity fade
        // (death clip ~1.5s + FADE_DURATION 1.5s → 2500ms covers both).
        if (this.enemyAI) {
          this.enemyAI.removeEnemyAggro(enemyId);
        }

        setTimeout(() => {
          this.enemies.delete(enemyId);
          console.log(`🗑️ Knight ${enemyId} removed from enemies map after death animation`);

          if (this.io) {
            this.io.to(this.roomId).emit('enemy-removed', {
              enemyId: enemyId,
              timestamp: Date.now()
            });
          }
        }, 2500);

        return result;
      } else {
        // Normal enemy kill rewards
        // Increment shared kill count
        this.killCount++;

        // Award +10 EXP for enemy kills to the killer in co-op mode
        if (fromPlayerId && fromPlayerId !== 'unknown' && this.io) {
          // Broadcast enemy kill experience to the killer using the new event format
          this.io.to(this.roomId).emit('player-experience-gained', {
            playerId: fromPlayerId,
            experienceGained: 10,
            source: 'enemy_kill',
            enemyId: enemyId,
            timestamp: Date.now()
          });
        }

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

  // Add enemy to the game (used by boss summoning)
  addEnemy(enemyData) {
    this.enemies.set(enemyData.id, enemyData);
    console.log(`➕ Enemy ${enemyData.id} (${enemyData.type}) added to room ${this.roomId}`);
  }

  // Function to calculate level based on kill count (same as Scene.tsx)
  getLevel(kills) {
    if (kills < 10) return 1;
    if (kills < 25) return 2;
    if (kills < 45) return 3;
    if (kills < 70) return 4;
    return 5;                      // Level 5: 70+ kills
  }

  // Stop enemy spawning (no-op now that spawning is replaced by fixed placement)
  stopEnemySpawning() {
    if (this.bossSpawnTimer) {
      clearTimeout(this.bossSpawnTimer);
      this.bossSpawnTimer = null;
    }
  }

  // Spawn the boss enemy
  spawnBoss() {
    if (!this.gameStarted || this.bossSpawned) return null;

    const bossId = `boss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Spawn boss at center of arena
    const position = { x: 0, y: 0, z: 0 };

    const maxHealth = 10500;
    const bossData = {
      id: bossId,
      type: 'boss',
      position,
      initialPosition: { ...position },
      rotation: 0,
      health: maxHealth,
      maxHealth: maxHealth,
      spawnedAt: Date.now(),
      isDying: false
    };

    this.enemies.set(bossId, bossData);

    // Broadcast boss spawn to all players with special event
    if (this.io) {
      this.io.to(this.roomId).emit('boss-spawned', {
        boss: bossData,
        timestamp: Date.now()
      });
      
      // Also broadcast as regular enemy spawn for compatibility
      broadcastEnemySpawn(this.io, this.roomId, bossData);
    }

    console.log(`👹 Boss spawned with ${maxHealth} HP at center of arena!`);
    return bossData;
  }

  // Start enemy AI system
  startEnemyAI() {
    if (this.gameStarted && this.players.size > 0) {
      // Start enemy AI for co-op mode
      if (this.gameMode === 'coop') {
        this.enemyAI.startAI();
      }
    }
  }

  // Stop enemy AI system
  stopEnemyAI() {
    this.enemyAI.stopAI();
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

  // Spawn a random amulet item at the given position
  spawnItemDrop(position) {
    const itemTypes = [
      { type: 'AMULET_OF_STRENGTH', stat: 'strength', label: 'Amulet of Strength' },
      { type: 'AMULET_OF_STAMINA',  stat: 'stamina',  label: 'Amulet of Stamina'  },
      { type: 'AMULET_OF_AGILITY',  stat: 'agility',  label: 'Amulet of Agility'  },
      { type: 'AMULET_OF_INTELLECT',stat: 'intellect',label: 'Amulet of Intellect' },
    ];

    const chosen = itemTypes[Math.floor(Math.random() * itemTypes.length)];
    const itemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

    const item = {
      id: itemId,
      type: chosen.type,
      stat: chosen.stat,
      label: chosen.label,
      position: { x: position.x, y: 0.3, z: position.z },
      droppedAt: Date.now()
    };

    this.droppedItems.set(itemId, item);

    if (this.io) {
      this.io.to(this.roomId).emit('item-dropped', { item, timestamp: Date.now() });
    }

    // Auto-expire after 60 seconds
    setTimeout(() => {
      if (this.droppedItems.has(itemId)) {
        this.droppedItems.delete(itemId);
        if (this.io) {
          this.io.to(this.roomId).emit('item-expired', { itemId, timestamp: Date.now() });
        }
      }
    }, 60000);

    console.log(`💍 Item dropped: ${item.label} (${itemId}) at (${position.x.toFixed(1)}, ${position.z.toFixed(1)})`);
    return item;
  }

  // Always drop 2 unique random boss reward items when the boss is slain
  spawnBossItemDrops(position) {
    const bossItemPool = [
      { type: 'CLOAK_OF_SPEED',  label: 'Cloak of Speed',  category: 'boss_drop' },
      { type: 'WARDING_SHIELD',  label: 'Warding Shield',  category: 'boss_drop' },
      { type: 'HOLY_RELIC',      label: 'Holy Relic',      category: 'boss_drop' },
      { type: 'TITAN_HEART',     label: 'Titan Heart',     category: 'boss_drop' },
    ];

    // Shuffle and pick 2 distinct items
    const shuffled = [...bossItemPool].sort(() => Math.random() - 0.5);
    const chosen = shuffled.slice(0, 2);

    const offsets = [-2.0, 2.0];
    chosen.forEach((itemDef, index) => {
      const itemId = `boss-item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
      const item = {
        id: itemId,
        type: itemDef.type,
        label: itemDef.label,
        category: itemDef.category,
        position: { x: position.x + offsets[index], y: 0.3, z: position.z },
        droppedAt: Date.now(),
      };

      this.droppedItems.set(itemId, item);

      if (this.io) {
        this.io.to(this.roomId).emit('item-dropped', { item, timestamp: Date.now() });
      }

      // Boss items persist for 3 minutes
      setTimeout(() => {
        if (this.droppedItems.has(itemId)) {
          this.droppedItems.delete(itemId);
          if (this.io) {
            this.io.to(this.roomId).emit('item-expired', { itemId, timestamp: Date.now() });
          }
        }
      }, 180000);

      console.log(`👑 Boss drop: ${item.label} (${itemId}) at (${item.position.x.toFixed(1)}, ${item.position.z.toFixed(1)})`);
    });
  }

  // Handle a player picking up an item
  pickupItem(itemId, playerId) {
    const item = this.droppedItems.get(itemId);
    if (!item) {
      console.log(`⚠️ Pickup failed: item ${itemId} no longer exists`);
      return null;
    }

    this.droppedItems.delete(itemId);

    if (this.io) {
      this.io.to(this.roomId).emit('item-picked-up', {
        itemId,
        playerId,
        item,
        timestamp: Date.now()
      });
    }

    console.log(`🎁 Player ${playerId} picked up ${item.label}`);
    return item;
  }

  // Cleanup when room is destroyed
  destroy() {
    this.stopEnemySpawning();
    this.stopEnemyAI();

    this.players.clear();
    this.enemies.clear();
    this.enemyStatusEffects.clear();
    this.droppedItems.clear();
    this.gameStarted = false;
    this.killCount = 0;
    this.bossSpawned = false;
    this.skeletonKillCount = 0;
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

  updatePlayerShield(playerId, shield, maxShield) {
    const player = this.players.get(playerId);
    if (player) {
      player.shield = Math.max(0, Math.min(maxShield || player.maxShield || 100, shield));
      if (maxShield !== undefined) {
        player.maxShield = maxShield;
      }
    }
  }

  getKillCount() {
    return this.killCount;
  }

  getGameStarted() {
    return this.gameStarted;
  }
}

module.exports = GameRoom;

