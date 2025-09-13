const { broadcastEnemySpawn } = require('./enemyHandler');
const EnemyAI = require('./enemyAI');

class GameRoom {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.players = new Map();
    this.enemies = new Map();
    this.towers = new Map(); // PVP towers
    this.summonedUnits = new Map(); // Server-authoritative summoned units
    this.lastUpdate = Date.now();
    this.io = io; // Store io reference for broadcasting
    
    // Game state management
    this.gameStarted = false;
    this.killCount = 0; // Shared kill count for all players
    this.gameMode = 'multiplayer'; // Default to multiplayer mode
    
    // Status effect tracking for enemies
    this.enemyStatusEffects = new Map(); // enemyId -> { stun: expiration, freeze: expiration, slow: expiration }
    
    // Summoned unit management
    this.lastGlobalSpawnTime = 0; // Global spawn time for all towers (synchronized)
    this.spawnInterval = 45; // 45 seconds between spawns
    this.currentWaveId = null;
    this.waveUnits = new Set(); // Unit IDs in current wave (legacy for multiplayer)
    this.playerWaves = new Map(); // PVP mode: playerId -> { waveId, units: Set<unitId>, startTime }
    this.waveStartTime = 0;
    this.lastWaveCompletionTime = 0;
    this.lastWaveDebugTime = 0;
    this.lastUpdateSkipLog = 0;
    this.summonedUnitUpdateTimer = null;
    
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
      console.log(`⚔️ PVP mode detected - starting summoned unit system in room ${this.roomId}`);
      console.log(`🏰 Current towers in room: ${this.towers.size}`);
      this.startSummonedUnitSystem();
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
      level: 1, // Start at level 1
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
    this.stopSummonedUnitSystem();
    
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
    // Only allow 2 towers maximum, even if more players join
    const towerCount = Array.from(this.towers.values()).length;
    if (towerCount >= 2) {
      console.log(`Tower limit reached (${towerCount}/2). Not creating tower for player ${playerId}`);
      return;
    }

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
      health: 11500,
      maxHealth: 11500,
      isDead: false,
      isActive: true,
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

  // ===== SUMMONED UNIT SYSTEM =====
  
  // Start the summoned unit system for PVP mode
  startSummonedUnitSystem() {
    if (this.gameMode !== 'pvp') {
      console.log(`🚫 Not starting summoned unit system - gameMode is ${this.gameMode}, not 'pvp'`);
      return;
    }
    
    console.log(`🤖 Starting summoned unit system for PVP room ${this.roomId}`);
    
    // Start the update loop for summoned units (60 FPS)
    this.summonedUnitUpdateTimer = setInterval(() => {
      this.updateSummonedUnits();
    }, 1000 / 60); // 60 FPS
    
    console.log(`🤖 Summoned unit system started for PVP room ${this.roomId} - update timer created`);
  }
  
  // Stop the summoned unit system
  stopSummonedUnitSystem() {
    if (this.summonedUnitUpdateTimer) {
      clearInterval(this.summonedUnitUpdateTimer);
      this.summonedUnitUpdateTimer = null;
    }
    
    // Clear all summoned units
    this.summonedUnits.clear();
    this.waveUnits.clear();
    this.lastGlobalSpawnTime = 0;
    this.currentWaveId = null;
    
    console.log(`🤖 Summoned unit system stopped for room ${this.roomId}`);
  }
  
  // Main update loop for summoned units
  updateSummonedUnits() {
    if (!this.gameStarted || this.gameMode !== 'pvp') {
      // Debug logging every 30 seconds to see why updates are skipped
      if (Math.floor(Date.now() / 1000) % 30 === 0 && Math.floor(Date.now() / 1000) !== this.lastUpdateSkipLog) {
        this.lastUpdateSkipLog = Math.floor(Date.now() / 1000);
        console.log(`🤖 Summoned unit update skipped: gameStarted=${this.gameStarted}, gameMode=${this.gameMode}, roomId=${this.roomId}`);
      }
      return;
    }
    
    const currentTime = Date.now() / 1000;
    const deltaTime = 1 / 60; // 60 FPS
    const unitsToDestroy = [];
    
    // Debug log every 5 seconds to avoid spam
    if (Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime * 10) % 10 === 0) {
      console.log(`🤖 Summoned unit update: ${this.summonedUnits.size} units, ${this.towers.size} towers`);
    }
    
    // Process existing units
    for (const [unitId, unit] of this.summonedUnits) {
      // Check if unit is expired
      if (this.isUnitExpired(unit, currentTime)) {
        this.removeUnitFromWave(unitId, unit.ownerId);
        unitsToDestroy.push(unitId);
        continue;
      }
      
      // Check if unit is dead
      if (unit.health <= 0 && !unit.isDead) {
        unit.isDead = true;
        unit.deathTime = currentTime;
        this.removeUnitFromWave(unitId, unit.ownerId);
        unitsToDestroy.push(unitId);
        continue;
      }
      
      // Check if unit is already dead (from damage) - add to cleanup
      if (unit.isDead || !unit.isActive) {
        console.log(`🧹 Adding dead/inactive unit ${unitId} to cleanup queue (isDead: ${unit.isDead}, isActive: ${unit.isActive})`);
        this.removeUnitFromWave(unitId, unit.ownerId);
        unitsToDestroy.push(unitId);
        continue;
      }
      
      // Update unit behavior
      this.updateUnitBehavior(unit, currentTime, deltaTime);
    }
    
    // Check for wave completion
    this.checkWaveCompletion(currentTime);
    
    // Handle spawning new units
    this.handleUnitSpawning(currentTime);
    
    // Destroy expired units
    for (const unitId of unitsToDestroy) {
      this.destroySummonedUnit(unitId);
    }
    
    // Broadcast unit updates to all clients (throttled to 20 FPS for network efficiency)
    if (Math.floor(currentTime * 20) !== Math.floor((currentTime - deltaTime) * 20)) {
      this.broadcastSummonedUnitUpdates();
    }
  }
  
  // Update individual unit behavior (AI logic)
  updateUnitBehavior(unit, currentTime, deltaTime) {
    // Search for targets periodically
    if (this.canUnitSearchForTargets(unit, currentTime)) {
      this.findTargetForUnit(unit);
      unit.lastTargetSearchTime = currentTime;
    }
    
    // Move towards target position if no specific target
    if (!unit.currentTarget && unit.targetPosition) {
      this.moveUnitTowardsPosition(unit, deltaTime);
    }
    
    // Handle combat with current target
    if (unit.currentTarget && this.canUnitAttack(unit, currentTime)) {
      this.handleUnitAttack(unit, currentTime);
    }
  }
  
  // Find target for unit (same logic as client-side)
  findTargetForUnit(unit) {
    // Priority 1: Find enemy units to attack
    const enemyUnits = this.findEnemyUnitsForUnit(unit);
    if (enemyUnits.length > 0) {
      const closestUnit = this.findClosestUnitToPosition(enemyUnits, unit.position);
      if (closestUnit) {
        unit.currentTarget = closestUnit.unitId;
        return;
      }
    }
    
    // Priority 2: If no enemy units, target enemy tower
    const enemyTower = this.findEnemyTowerForUnit(unit);
    if (enemyTower) {
      unit.currentTarget = `tower_${enemyTower.ownerId}`;
      return;
    }
    
    // No targets found, clear target
    unit.currentTarget = null;
  }
  
  // Find enemy units for a given unit
  findEnemyUnitsForUnit(unit) {
    const enemyUnits = [];
    
    for (const [unitId, otherUnit] of this.summonedUnits) {
      if (otherUnit.ownerId !== unit.ownerId && 
          otherUnit.isActive && 
          !otherUnit.isDead && 
          otherUnit.health > 0) {
        enemyUnits.push(otherUnit);
      }
    }
    
    return enemyUnits;
  }
  
  // Find enemy tower for a given unit
  findEnemyTowerForUnit(unit) {
    for (const [towerId, tower] of this.towers) {
      if (tower.ownerId !== unit.ownerId && 
          !tower.isDead && 
          tower.health > 0) {
        return tower;
      }
    }
    return null;
  }
  
  // Find closest unit to a position
  findClosestUnitToPosition(units, position) {
    let closestUnit = null;
    let closestDistance = Infinity;
    
    for (const unit of units) {
      const distance = this.calculateDistance(position, unit.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestUnit = unit;
      }
    }
    
    return closestUnit;
  }
  
  // Move unit towards target position
  moveUnitTowardsPosition(unit, deltaTime) {
    if (!unit.targetPosition) return;
    
    const direction = {
      x: unit.targetPosition.x - unit.position.x,
      y: unit.targetPosition.y - unit.position.y,
      z: unit.targetPosition.z - unit.position.z
    };
    
    const distance = Math.sqrt(direction.x * direction.x + direction.y * direction.y + direction.z * direction.z);
    
    // If close enough to target position, stop moving
    if (distance < 0.5) {
      unit.targetPosition = null;
      return;
    }
    
    // Normalize and move
    const normalizedDirection = {
      x: direction.x / distance,
      y: direction.y / distance,
      z: direction.z / distance
    };
    
    const moveDistance = unit.moveSpeed * deltaTime;
    
    if (moveDistance < distance) {
      // Move towards target
      unit.position.x += normalizedDirection.x * moveDistance;
      unit.position.y += normalizedDirection.y * moveDistance;
      unit.position.z += normalizedDirection.z * moveDistance;
    } else {
      // Arrived at target
      unit.position.x = unit.targetPosition.x;
      unit.position.y = unit.targetPosition.y;
      unit.position.z = unit.targetPosition.z;
      unit.targetPosition = null;
    }
  }
  
  // Handle unit attack
  handleUnitAttack(unit, currentTime) {
    if (!unit.currentTarget) return;
    
    let target = null;
    let targetPosition = null;
    
    // Check if target is a tower
    if (unit.currentTarget.startsWith('tower_')) {
      const towerId = unit.currentTarget;
      target = this.towers.get(towerId);
      if (target) {
        targetPosition = target.position;
      }
    } else {
      // Target is another summoned unit
      target = this.summonedUnits.get(unit.currentTarget);
      if (target) {
        targetPosition = target.position;
      }
    }
    
    if (!target || !targetPosition) {
      unit.currentTarget = null;
      return;
    }
    
    // Check if target is still in range
    const distance = this.calculateDistance(unit.position, targetPosition);
    if (distance > unit.attackRange) {
      unit.currentTarget = null;
      return;
    }
    
    // Check if target is still alive
    if (target.isDead || target.health <= 0) {
      unit.currentTarget = null;
      return;
    }
    
    // Perform attack
    if (unit.currentTarget.startsWith('tower_')) {
      // Attack tower
      this.damageTower(unit.currentTarget, unit.attackDamage);
    } else {
      // Attack summoned unit
      this.damageSummonedUnitDirect(unit.currentTarget, unit.attackDamage, unit.ownerId);
    }
    
    unit.lastAttackTime = currentTime;
  }
  
  // Manual wave completion trigger for testing (temporary)
  triggerTestWaveCompletion() {
    console.log(`🧪 TEST: Manually triggering wave completion for room ${this.roomId}`);
    
    // Broadcast wave completion
    if (this.io) {
      this.io.to(this.roomId).emit('wave-completed', {
        waveId: `test_wave_${Date.now()}`,
        timestamp: Date.now()
      });
    }
  }

  // Helper method to remove unit from appropriate wave tracking
  removeUnitFromWave(unitId, unitOwnerId) {
    if (this.gameMode === 'pvp') {
      // PVP mode: Remove from player's wave
      const playerWave = this.playerWaves.get(unitOwnerId);
      if (playerWave) {
        const hadUnit = playerWave.units.has(unitId);
        playerWave.units.delete(unitId);
        console.log(`🗑️ Removed unit ${unitId} from PVP wave for player ${unitOwnerId}. Had unit: ${hadUnit}, Remaining: ${playerWave.units.size}`);
        
        // DEBUG: Check if this triggers wave completion
        if (playerWave.units.size === 0) {
          console.log(`🎯 DEBUG: Player ${unitOwnerId}'s wave is now empty! This should trigger wave completion check.`);
        }
      } else {
        console.warn(`⚠️ Tried to remove unit ${unitId} from non-existent player wave for ${unitOwnerId}`);
      }
    } else {
      // Legacy multiplayer mode: Remove from global wave
      this.waveUnits.delete(unitId);
    }
  }

  // Check wave completion
  checkWaveCompletion(currentTime) {
    if (this.gameMode === 'pvp') {
      // PVP mode: Check each player's wave separately
      // DEBUG: Log current wave state every few seconds
      if (Math.floor(currentTime) % 5 === 0 && Math.floor(currentTime) !== this.lastWaveDebugTime) {
        this.lastWaveDebugTime = Math.floor(currentTime);
        console.log(`🌊 PVP Wave Debug: Total player waves: ${this.playerWaves.size}`);
        for (const [playerId, playerWave] of this.playerWaves) {
          console.log(`   Player ${playerId}: ${playerWave.units.size} units remaining in wave ${playerWave.waveId}`);
        }
      }
      
      for (const [playerId, playerWave] of this.playerWaves) {
        if (playerWave.units.size === 0) {
          // This player's wave is complete - award experience to the OPPOSING player
          const opposingPlayerId = this.getOpposingPlayerId(playerId);
          
          if (opposingPlayerId) {
            console.log(`🎯 PVP Wave completed! Player ${playerId}'s units were all killed. Awarding 10 EXP to opposing player ${opposingPlayerId}.`);
            
            // DEBUG: Log all players in the room
            console.log(`🔍 DEBUG: All players in room:`, Array.from(this.players.keys()));
            console.log(`🔍 DEBUG: Defeated player: ${playerId}, Winner: ${opposingPlayerId}`);
            
            // Broadcast wave completion with specific winner
            if (this.io) {
              const waveCompletionData = {
                waveId: playerWave.waveId,
                defeatedPlayerId: playerId, // The player whose units were killed
                winnerPlayerId: opposingPlayerId, // The player who should get experience
                timestamp: Date.now()
              };
              
              console.log(`📡 Broadcasting wave-completed event:`, waveCompletionData);
              this.io.to(this.roomId).emit('wave-completed', waveCompletionData);
            }
          } else {
            console.log(`🎯 PVP Wave completed for player ${playerId}, but no opposing player found.`);
            console.log(`🔍 DEBUG: Current players in room:`, Array.from(this.players.keys()));
          }
          
          // Remove the completed wave
          this.playerWaves.delete(playerId);
        }
      }
    } else {
      // Legacy multiplayer mode: Use global wave tracking
      // Debug logging every 10 seconds to track wave state
      if (Math.floor(currentTime) % 10 === 0 && Math.floor(currentTime) !== this.lastWaveDebugTime) {
        this.lastWaveDebugTime = Math.floor(currentTime);
        console.log(`🌊 Wave Debug: currentWaveId=${this.currentWaveId}, waveUnits.size=${this.waveUnits.size}, lastWaveCompletionTime=${this.lastWaveCompletionTime}, timeSinceLastCompletion=${currentTime - this.lastWaveCompletionTime}`);
        
        if (this.waveUnits.size > 0) {
          console.log(`🤖 Active wave units:`, Array.from(this.waveUnits));
        }
      }
      
      // Check if current wave is complete (all units dead or expired)
      if (this.currentWaveId && this.waveUnits.size === 0) {
        // Ensure we don't spam the callback (minimum 30 seconds between wave completions)
        if (currentTime - this.lastWaveCompletionTime >= 30) {
          console.log(`🎯 Wave ${this.currentWaveId} completed! Awarding experience to all players.`);
          
          // Broadcast wave completion
          if (this.io) {
            this.io.to(this.roomId).emit('wave-completed', {
              waveId: this.currentWaveId,
              timestamp: Date.now()
            });
          }
          
          this.lastWaveCompletionTime = currentTime;
          this.currentWaveId = null;
        } else {
          console.log(`🕐 Wave ${this.currentWaveId} complete but on cooldown. Time since last: ${currentTime - this.lastWaveCompletionTime}s (need 30s)`);
        }
      }
    }
  }

  // Helper method to get the opposing player ID in PVP
  getOpposingPlayerId(playerId) {
    for (const [otherPlayerId] of this.players) {
      if (otherPlayerId !== playerId) {
        return otherPlayerId;
      }
    }
    return null;
  }
  
  // Handle unit spawning
  handleUnitSpawning(currentTime) {
    // Check if we have at least 2 towers (both players joined)
    if (this.towers.size < 2) {
      // Don't start spawning until both players have joined
      return;
    }
    
    // Check if it's time for global spawn (synchronized for all towers)
    const timeSinceLastSpawn = currentTime - this.lastGlobalSpawnTime;
    
    // For the first spawn, start immediately when both players are present
    const shouldSpawn = this.lastGlobalSpawnTime === 0 || timeSinceLastSpawn >= this.spawnInterval;
    
    if (!shouldSpawn) {
      return;
    }
    
    console.log(`🌊 Global spawn time! Spawning units for all ${this.towers.size} towers`);
    
    // Spawn units for ALL active towers simultaneously
    let towersSpawned = 0;
    for (const [towerId, tower] of this.towers) {
      if (!tower.isActive || tower.isDead) {
        console.log(`🚫 Skipping tower ${towerId} - not active or dead`);
        continue;
      }
      
      console.log(`✅ Spawning units for tower ${towerId} (owner: ${tower.ownerId})`);
      this.spawnUnitsForTower(tower, currentTime);
      towersSpawned++;
    }
    
    if (towersSpawned > 0) {
      // Update global spawn time only if we actually spawned units
      this.lastGlobalSpawnTime = currentTime;
      console.log(`🕐 Next global spawn in ${this.spawnInterval} seconds`);
    }
  }
  
  // Spawn units for a tower
  spawnUnitsForTower(tower, currentTime) {
    console.log(`🏰 spawnUnitsForTower called for tower ${tower.id} (owner: ${tower.ownerId})`);
    
    if (this.gameMode === 'pvp') {
      // PVP mode: Track waves per player
      const playerId = tower.ownerId;
      const waveId = `wave_${playerId}_${currentTime}`;
      
      // Initialize player wave if not exists
      if (!this.playerWaves.has(playerId)) {
        this.playerWaves.set(playerId, {
          waveId: waveId,
          units: new Set(),
          startTime: currentTime
        });
        console.log(`🌊 Starting new PVP wave for player ${playerId}: ${waveId}`);
      }
      
      const playerWave = this.playerWaves.get(playerId);
      
      // Find the opposing tower position for targeting
      let opposingTowerPosition = this.findOpposingTowerPosition(tower.ownerId);
      console.log(`🎯 Opposing tower position for ${tower.ownerId}:`, opposingTowerPosition);
      
      // If no opposing tower found, use a default position in front of current tower
      if (!opposingTowerPosition) {
        opposingTowerPosition = {
          x: tower.position.x,
          y: tower.position.y,
          z: tower.position.z + 20
        };
        console.log(`🎯 Using default target position:`, opposingTowerPosition);
      }
      
      // Spawn 3 units and track them in the player's wave
      console.log(`🤖 Spawning 3 units for tower ${tower.id} (PVP mode)`);
      for (let i = 0; i < 3; i++) {
        const unitId = this.spawnSummonedUnit(tower.ownerId, tower.position, opposingTowerPosition, i, currentTime);
        if (unitId) {
          playerWave.units.add(unitId);
          console.log(`✅ Unit ${unitId} added to PVP wave ${waveId} for player ${playerId}`);
        } else {
          console.log(`❌ Failed to spawn unit ${i} for tower ${tower.id}`);
        }
      }
      console.log(`🌊 PVP wave ${waveId} now has ${playerWave.units.size} units`);
      
    } else {
      // Legacy multiplayer mode: Use global wave tracking
      // Start a new wave if this is the first tower spawning in this cycle
      if (!this.currentWaveId) {
        this.currentWaveId = `wave_${currentTime}`;
        this.waveStartTime = currentTime;
        this.waveUnits.clear();
        console.log(`🌊 Starting new wave: ${this.currentWaveId} at time ${currentTime}`);
      }
      
      // Find the opposing tower position for targeting
      let opposingTowerPosition = this.findOpposingTowerPosition(tower.ownerId);
      console.log(`🎯 Opposing tower position for ${tower.ownerId}:`, opposingTowerPosition);
      
      // If no opposing tower found, use a default position in front of current tower
      if (!opposingTowerPosition) {
        opposingTowerPosition = {
          x: tower.position.x,
          y: tower.position.y,
          z: tower.position.z + 20
        };
        console.log(`🎯 Using default target position:`, opposingTowerPosition);
      }
      
      // Spawn 3 units and track them in the wave
      console.log(`🤖 Spawning 3 units for tower ${tower.id}`);
      for (let i = 0; i < 3; i++) {
        const unitId = this.spawnSummonedUnit(tower.ownerId, tower.position, opposingTowerPosition, i, currentTime);
        if (unitId) {
          this.waveUnits.add(unitId);
          console.log(`✅ Unit ${unitId} added to wave ${this.currentWaveId}`);
        } else {
          console.log(`❌ Failed to spawn unit ${i} for tower ${tower.id}`);
        }
      }
      console.log(`🌊 Wave ${this.currentWaveId} now has ${this.waveUnits.size} units`);
    }
  }
  
  // Find opposing tower position
  findOpposingTowerPosition(ownerId) {
    for (const [towerId, tower] of this.towers) {
      if (tower.ownerId !== ownerId) {
        return tower.position;
      }
    }
    return null;
  }
  
  // Spawn a summoned unit
  spawnSummonedUnit(ownerId, spawnPosition, targetPosition, unitIndex, currentTime) {
    const unitId = `${ownerId}_unit_${currentTime}_${unitIndex}`;
    
    // Add offset to spawn position to avoid stacking
    const offset = {
      x: (unitIndex - 1) * 2, // Spread units left/right
      y: 0,
      z: 0
    };
    
    const actualSpawnPosition = {
      x: spawnPosition.x + offset.x,
      y: spawnPosition.y + offset.y,
      z: spawnPosition.z + offset.z
    };
    
    const unit = {
      unitId: unitId,
      ownerId: ownerId,
      position: actualSpawnPosition,
      targetPosition: targetPosition,
      health: 1000, // Max health
      maxHealth: 1000,
      attackRange: 4,
      attackDamage: 60,
      attackCooldown: 2.0,
      lastAttackTime: 0,
      moveSpeed: 2.25,
      currentTarget: null,
      lastTargetSearchTime: 0,
      targetSearchCooldown: 0.5,
      isActive: true,
      isDead: false,
      deathTime: 0,
      summonTime: currentTime,
      lifetime: 120 // 2 minutes
    };
    
    this.summonedUnits.set(unitId, unit);
    
    console.log(`🤖 Spawned summoned unit ${unitId} for player ${ownerId} at position [${actualSpawnPosition.x.toFixed(2)}, ${actualSpawnPosition.y.toFixed(2)}, ${actualSpawnPosition.z.toFixed(2)}]`);
    console.log(`📊 Total summoned units in room: ${this.summonedUnits.size}`);
    
    return unitId;
  }
  
  // Damage a summoned unit directly (server-side)
  damageSummonedUnitDirect(unitId, damage, sourceOwnerId) {
    const unit = this.summonedUnits.get(unitId);
    if (!unit) {
      console.log(`⚠️ Attempted to damage non-existent unit ${unitId} - unit was already destroyed`);
      return false;
    }
    if (unit.isDead) {
      console.log(`⚠️ Attempted to damage dead unit ${unitId} - ignoring damage`);
      return false;
    }
    
    const previousHealth = unit.health;
    unit.health = Math.max(0, unit.health - damage);
    const wasKilled = previousHealth > 0 && unit.health <= 0;
    
    if (wasKilled) {
      unit.isDead = true;
      unit.isActive = false;
      unit.deathTime = Date.now() / 1000;
      
      // FIXED: Use proper wave removal method that handles both PVP and multiplayer modes
      this.removeUnitFromWave(unitId, unit.ownerId);
      
      if (this.gameMode === 'pvp') {
        const playerWave = this.playerWaves.get(unit.ownerId);
        const remainingUnits = playerWave ? playerWave.units.size : 0;
        console.log(`💀 PVP Unit ${unitId} (owned by ${unit.ownerId}) killed by ${sourceOwnerId}! Player wave units remaining: ${remainingUnits}`);
      } else {
        console.log(`💀 Unit ${unitId} killed! Removed from wave. Wave units remaining: ${this.waveUnits.size}`);
      }
    }
    
    console.log(`🤖 Summoned unit ${unitId} took ${damage} damage from ${sourceOwnerId}. Health: ${unit.health}/${unit.maxHealth}${wasKilled ? ' (KILLED)' : ''}`);
    
    return true;
  }
  
  // Destroy a summoned unit
  destroySummonedUnit(unitId) {
    const unit = this.summonedUnits.get(unitId);
    if (unit) {
      this.summonedUnits.delete(unitId);
      this.waveUnits.delete(unitId);
      console.log(`🗑️ Destroyed summoned unit ${unitId} (was dead: ${unit.isDead}, was active: ${unit.isActive}). Remaining units: ${this.summonedUnits.size}`);
    } else {
      console.warn(`⚠️ Attempted to destroy non-existent unit ${unitId}`);
    }
  }
  
  // Broadcast summoned unit updates to all clients
  broadcastSummonedUnitUpdates() {
    const unitUpdates = [];
    
    // Only broadcast active, living units - dead units should be cleaned up by the main loop
    for (const [unitId, unit] of this.summonedUnits) {
      // Skip dead or inactive units - they should be cleaned up
      if (unit.isDead || !unit.isActive) {
        console.log(`📡 Skipping broadcast of dead/inactive unit ${unitId} (isDead: ${unit.isDead}, isActive: ${unit.isActive})`);
        continue;
      }
      
      unitUpdates.push({
        unitId: unit.unitId,
        ownerId: unit.ownerId,
        position: unit.position,
        health: unit.health,
        maxHealth: unit.maxHealth,
        isDead: unit.isDead,
        isActive: unit.isActive,
        currentTarget: unit.currentTarget,
        targetPosition: unit.targetPosition
      });
    }
    
    if (this.io && unitUpdates.length > 0) {
      this.io.to(this.roomId).emit('summoned-units-updated', {
        units: unitUpdates,
        timestamp: Date.now()
      });
    }
  }
  
  // Get summoned units
  getSummonedUnits() {
    return Array.from(this.summonedUnits.values());
  }
  
  // Utility functions
  isUnitExpired(unit, currentTime) {
    return unit.isDead || (currentTime - unit.summonTime) >= unit.lifetime;
  }
  
  canUnitSearchForTargets(unit, currentTime) {
    return (currentTime - unit.lastTargetSearchTime) >= unit.targetSearchCooldown;
  }
  
  canUnitAttack(unit, currentTime) {
    if (!unit.isActive || unit.isDead || !unit.currentTarget) {
      return false;
    }
    return (currentTime - unit.lastAttackTime) >= unit.attackCooldown;
  }
  
  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
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
    this.stopSummonedUnitSystem();
    
    this.players.clear();
    this.enemies.clear();
    this.towers.clear();
    this.summonedUnits.clear();
    this.enemyStatusEffects.clear();
    this.lastGlobalSpawnTime = 0;
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
