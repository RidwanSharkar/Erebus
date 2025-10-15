class EnemyAI {
  constructor(roomId, io) {
    this.roomId = roomId;
    this.io = io;
    this.room = null; // Will be set by GameRoom
    this.aiTimer = null;
    this.updateInterval = 33; // Update AI every 33ms (30fps for smooth movement)
    
    // Enemy aggro tracking
    this.enemyAggro = new Map(); // enemyId -> { targetPlayerId, lastUpdate, aggro }
    
    // Boss damage tracking per player
    this.bossDamageTracking = new Map(); // enemyId -> Map(playerId -> totalDamage)
    
    // Boss attack cooldown tracking
    this.bossAttackCooldown = new Map(); // enemyId -> lastAttackTime

    // Boss meteor cooldown tracking
    this.bossMeteorCooldown = new Map(); // enemyId -> lastMeteorTime

    // Boss skeleton summoning tracking
    this.bossSkeletonSummonCooldown = new Map(); // enemyId -> lastSummonTime
    this.bossSummonedSkeletons = new Map(); // enemyId -> Set of skeleton IDs

    // Enemy taunt tracking (for Deathgrasp ability)
    this.enemyTaunts = new Map(); // enemyId -> { taunterPlayerId, tauntEndTime }
  }

  setRoom(room) {
    this.room = room;
  }

  startAI() {
    if (this.aiTimer) return; // Already running
    
    this.aiTimer = setInterval(() => {
      this.updateAI();
    }, this.updateInterval);
    
  }

  stopAI() {
    if (this.aiTimer) {
      clearInterval(this.aiTimer);
      this.aiTimer = null;
    }
    
    this.enemyAggro.clear();
    this.bossDamageTracking.clear();
    this.bossAttackCooldown.clear();
    this.enemyTaunts.clear();
  }

  updateAI() {
    if (!this.room || !this.room.getGameStarted()) return;
    
    const enemies = this.room.getEnemies();
    const players = this.room.getPlayers();
    
    if (enemies.length === 0 || players.length === 0) return;
    
    // Update each enemy's AI
    enemies.forEach(enemy => {
      if (enemy.isDying) return;
      
      this.updateEnemyAI(enemy, players);
    });
  }

  updateEnemyAI(enemy, players) {
    // Check if enemy is taunted (Deathgrasp effect)
    if (this.isEnemyTaunted(enemy.id)) {
      const tauntTargetId = this.getEnemyTauntTarget(enemy.id);
      const tauntTarget = players.find(p => p.id === tauntTargetId);
      if (tauntTarget) {
        // Move enemy towards taunt target, ignoring normal aggro
        this.moveEnemyTowardsTarget(enemy, tauntTarget);
        return;
      }
    }

    // Special handling for boss enemies
    if (enemy.type === 'boss') {
      this.updateBossAI(enemy, players);
      return;
    }

    // Special handling for boss-summoned skeletons
    if (enemy.type === 'boss-skeleton') {
      this.updateBossSkeletonAI(enemy, players);
      return;
    }

    // Get or create aggro data for this enemy
    let aggroData = this.enemyAggro.get(enemy.id);
    if (!aggroData) {
      // Find closest player as initial target
      const closestPlayer = this.findClosestPlayer(enemy, players);
      if (!closestPlayer) return;

      aggroData = {
        targetPlayerId: closestPlayer.id,
        lastUpdate: Date.now(),
        aggro: 100
      };
      this.enemyAggro.set(enemy.id, aggroData);
    }

    // Find current target player
    const targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer) {
      // Target player left, find new target
      const newTarget = this.findClosestPlayer(enemy, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
      } else {
        return;
      }
    }

    // Move enemy towards target
    this.moveEnemyTowardsTarget(enemy, targetPlayer || players.find(p => p.id === aggroData.targetPlayerId));
  }

  updateBossSkeletonAI(skeleton, players) {
    // Get or create aggro data for this skeleton
    let aggroData = this.enemyAggro.get(skeleton.id);
    if (!aggroData) {
      // Find closest player as initial target
      const closestPlayer = this.findClosestPlayer(skeleton, players);
      if (!closestPlayer) return;

      aggroData = {
        targetPlayerId: closestPlayer.id,
        lastUpdate: Date.now(),
        aggro: 100
      };
      this.enemyAggro.set(skeleton.id, aggroData);
    }

    // Find current target player
    const targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer) {
      // Target player left, find new target
      const newTarget = this.findClosestPlayer(skeleton, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
      } else {
        return;
      }
    }

    // Check if skeleton can attack target (within range)
    const distance = this.calculateDistance(skeleton.position, targetPlayer.position);
    const attackRange = 2.65;
    const attackCooldown = 2000; // 2 seconds between attacks

    if (distance <= attackRange) {
      // Within attack range - check attack cooldown
      if (!this.bossAttackCooldown.has(skeleton.id)) {
        this.bossAttackCooldown.set(skeleton.id, 0);
      }

      const lastAttackTime = this.bossAttackCooldown.get(skeleton.id);
      const now = Date.now();

      if (now - lastAttackTime >= attackCooldown) {
        // Attack the player
        this.bossSkeletonAttackPlayer(skeleton, targetPlayer);
        this.bossAttackCooldown.set(skeleton.id, now);
      }
    } else {
      // Outside attack range - move towards target
      this.moveEnemyTowardsTarget(skeleton, targetPlayer);
    }
  }

  bossSkeletonAttackPlayer(skeleton, player) {
    const damage = skeleton.damage || 10; // Default 10 damage

    // Broadcast skeleton attack to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-skeleton-attack', {
        skeletonId: skeleton.id,
        targetPlayerId: player.id,
        damage: damage,
        position: skeleton.position,
        timestamp: Date.now()
      });
    }

    console.log(`💀 Boss skeleton ${skeleton.id} attacked player ${player.id} for ${damage} damage!`);
  }

  updateBossAI(boss, players) {
    // Check if boss is taunted (Deathgrasp effect) - taunts override all aggro
    if (this.isEnemyTaunted(boss.id)) {
      const tauntTargetId = this.getEnemyTauntTarget(boss.id);
      const tauntTarget = players.find(p => p.id === tauntTargetId);
      if (tauntTarget) {
        console.log(`🎯 Boss ${boss.id} is taunted by ${tauntTarget.name} - ignoring normal aggro`);
        // Move boss towards taunt target, ignoring normal aggro
        this.moveEnemyTowardsTarget(boss, tauntTarget);
        return;
      }
    }

    // console.log(`🤖 Updating Boss AI for ${boss.id}, current target: ${boss.currentTarget || 'none'}`);

    // Initialize damage tracking for this boss if not exists
    if (!this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.set(boss.id, new Map());
    }

    const damageMap = this.bossDamageTracking.get(boss.id);

    // Determine target based on damage dealt
    let targetPlayer = null;
    let maxDamage = 0;
    let topDamagePlayerId = null;

    // console.log(`📊 Boss ${boss.id} damage tracking:`, Array.from(damageMap.entries()));

    // Find player who dealt most damage
    damageMap.forEach((damage, playerId) => {
      if (damage > maxDamage) {
        maxDamage = damage;
        topDamagePlayerId = playerId;
        const player = players.find(p => p.id === playerId);
        if (player) {
          targetPlayer = player;
        }
      }
    });

    // If no damage dealt yet, target closest player
    if (!targetPlayer || maxDamage === 0) {
      targetPlayer = this.findClosestPlayer(boss, players);
      if (targetPlayer) {
        console.log(`🎯 Boss targeting closest player: ${targetPlayer.name} (no damage dealt yet)`);
      }
    } else if (targetPlayer) {
      // Log target switch (only when it changes)
      if (!boss.currentTarget || boss.currentTarget !== topDamagePlayerId) {
        console.log(`🎯 Boss switching target to ${targetPlayer.name} (${maxDamage} total damage)`);
        boss.currentTarget = topDamagePlayerId;
      }
    }

    if (!targetPlayer) return;

    // Check if boss can attack target (within range)
    const distance = this.calculateDistance(boss.position, targetPlayer.position);
    const attackRange = 3.0; // Boss attack range
    const attackCooldown = 750; // 2 seconds between attacks

    // ALWAYS update rotation to face target, even when standing still
    this.updateBossRotation(boss, targetPlayer);

    // Check meteor cooldown (10 seconds)
    const meteorCooldown = 10000;
    const lastMeteorTime = this.bossMeteorCooldown.get(boss.id) || 0;
    const now = Date.now();

    if (now - lastMeteorTime >= meteorCooldown) {
      // Cast meteor ability at all player positions
      this.bossCastMeteor(boss, players);
      this.bossMeteorCooldown.set(boss.id, now);
    }

    // Check skeleton summoning cooldown (10 seconds)
    const skeletonSummonCooldown = 10000;
    const lastSkeletonSummonTime = this.bossSkeletonSummonCooldown.get(boss.id) || 0;

    if (now - lastSkeletonSummonTime >= skeletonSummonCooldown) {
      // Check current skeleton count
      const currentSkeletons = this.bossSummonedSkeletons.get(boss.id) || new Set();
      
      // Only summon if less than 2 skeletons
      if (currentSkeletons.size < 2) {
        this.bossSummonSkeleton(boss);
        this.bossSkeletonSummonCooldown.set(boss.id, now);
      }
    }

    if (distance <= attackRange) {
      // Within attack range - stop moving but keep rotating
      // Check attack cooldown
      const lastAttackTime = this.bossAttackCooldown.get(boss.id) || 0;

      if (now - lastAttackTime >= attackCooldown) {
        // Attack the player
        this.bossAttackPlayer(boss, targetPlayer);
        this.bossAttackCooldown.set(boss.id, now);
      }
    } else {
      // Outside attack range - move towards target
      this.moveEnemyTowardsTarget(boss, targetPlayer);
    }
  }

  bossAttackPlayer(boss, player) {
    // Check if boss is facing the player before allowing attack
    const isFacingTarget = this.isBossFacingTarget(boss, player);
    if (!isFacingTarget) {
      return;
    }

    const damage = 35; // Boss deals 10 damage per hit

    // Broadcast boss attack to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-attack', {
        bossId: boss.id,
        targetPlayerId: player.id,
        damage: damage,
        position: boss.position,
        timestamp: Date.now()
      });
    }

    console.log(`🔥 Boss ${boss.id} attacked player ${player.id} for ${damage} damage!`);
  }

  bossCastMeteor(boss, players) {
    // Get positions of all players in the game
    const targetPositions = players.map(player => ({
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    }));

    if (targetPositions.length === 0) return;

    const meteorId = `meteor-${boss.id}-${Date.now()}`;

    // Broadcast meteor cast to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-meteor-cast', {
        bossId: boss.id,
        meteorId: meteorId,
        targetPositions: targetPositions,
        timestamp: Date.now()
      });
    }

    console.log(`☄️ Boss ${boss.id} cast meteor at ${targetPositions.length} player positions!`);
  }

  bossSummonSkeleton(boss) {
    if (!this.room) return;

    // Generate unique skeleton ID
    const skeletonId = `skeleton-${boss.id}-${Date.now()}`;

    // Position skeleton near boss (random offset)
    const angle = Math.random() * Math.PI * 2;
    const distance = 3 + Math.random() * 2; // 3-5 units away

    const skeletonPosition = {
      x: boss.position.x + Math.cos(angle) * distance,
      y: 0,
      z: boss.position.z + Math.sin(angle) * distance
    };

    // Create skeleton enemy object
    const skeleton = {
      id: skeletonId,
      type: 'boss-skeleton',
      position: skeletonPosition,
      rotation: 0,
      health: 500,
      maxHealth: 500,
      isDying: false,
      damage: 10,
      bossId: boss.id // Track which boss summoned this skeleton
    };

    // Add to boss's summoned skeletons set
    if (!this.bossSummonedSkeletons.has(boss.id)) {
      this.bossSummonedSkeletons.set(boss.id, new Set());
    }
    this.bossSummonedSkeletons.get(boss.id).add(skeletonId);

    // Add skeleton to room enemies through the game room
    this.room.addEnemy(skeleton);

    // Broadcast skeleton summon to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-skeleton-summoned', {
        bossId: boss.id,
        skeleton: skeleton,
        timestamp: Date.now()
      });
    }

    console.log(`💀 Boss ${boss.id} summoned skeleton ${skeletonId} at position (${skeletonPosition.x.toFixed(2)}, ${skeletonPosition.z.toFixed(2)})`);
  }

  // Track when a boss skeleton is killed
  removeBossSkeleton(bossId, skeletonId) {
    const skeletons = this.bossSummonedSkeletons.get(bossId);
    if (skeletons) {
      skeletons.delete(skeletonId);
      console.log(`💀 Skeleton ${skeletonId} removed from boss ${bossId}'s summons (${skeletons.size}/2 remaining)`);
    }
  }

  // Track damage dealt to boss by each player
  trackBossDamage(bossId, playerId, damage) {
    if (!this.bossDamageTracking.has(bossId)) {
      this.bossDamageTracking.set(bossId, new Map());
    }

    const damageMap = this.bossDamageTracking.get(bossId);
    const currentDamage = damageMap.get(playerId) || 0;
    damageMap.set(playerId, currentDamage + damage);

    console.log(`📊 Boss aggro - Player ${playerId} has dealt ${currentDamage + damage} total damage to boss ${bossId}`);
  }

  findClosestPlayer(enemy, players) {
    let closestPlayer = null;
    let closestDistance = Infinity;
    
    players.forEach(player => {
      const distance = this.calculateDistance(enemy.position, player.position);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPlayer = player;
      }
    });
    
    return closestPlayer;
  }

  // Update boss rotation to face target (called even when stationary)
  updateBossRotation(boss, targetPlayer) {
    if (!targetPlayer) return;
    
    // Calculate direction vector
    const direction = {
      x: targetPlayer.position.x - boss.position.x,
      y: 0, // Keep enemies on ground
      z: targetPlayer.position.z - boss.position.z
    };
    
    // Normalize direction
    const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (magnitude === 0) return;
    
    direction.x /= magnitude;
    direction.z /= magnitude;
    
    // Calculate target rotation to face target
    const targetRotation = Math.atan2(direction.x, direction.z);
    
    // Get current rotation (initialize if needed)
    const currentRotation = boss.rotation || 0;
    
    // Calculate rotation difference and normalize to [-PI, PI]
    let rotationDiff = targetRotation - currentRotation;
    while (rotationDiff > Math.PI) rotationDiff -= Math.PI * 2;
    while (rotationDiff < -Math.PI) rotationDiff += Math.PI * 2;
    
    // Smooth rotation interpolation (4.0 rotation speed like Ascendant)
    const deltaTime = this.updateInterval / 1000; // Convert to seconds
    const rotationSpeed = 4.0; // Radians per second
    const rotationStep = rotationDiff * Math.min(1, rotationSpeed * deltaTime);
    
    // Apply smooth rotation
    boss.rotation = currentRotation + rotationStep;
    
    // Normalize final rotation to [-PI, PI]
    while (boss.rotation > Math.PI) boss.rotation -= Math.PI * 2;
    while (boss.rotation < -Math.PI) boss.rotation += Math.PI * 2;
    
    // Broadcast rotation update to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: boss.id,
        position: boss.position,
        rotation: boss.rotation,
        timestamp: Date.now()
      });
    }
  }

  moveEnemyTowardsTarget(enemy, targetPlayer) {
    if (!targetPlayer) return;
    
    const distance = this.calculateDistance(enemy.position, targetPlayer.position);
    const baseSpeed = this.getEnemyMoveSpeed(enemy.type);
    
    // Apply status effect modifiers to movement speed
    const moveSpeed = this.getModifiedMovementSpeed(enemy.id, baseSpeed);
    
    // Don't move if too close (avoid jittering) or if frozen/stopped
    if (distance < 2.0 || moveSpeed === 0) return;
    
    // Calculate direction vector
    const direction = {
      x: targetPlayer.position.x - enemy.position.x,
      y: 0, // Keep enemies on ground
      z: targetPlayer.position.z - enemy.position.z
    };
    
    // Normalize direction
    const magnitude = Math.sqrt(direction.x * direction.x + direction.z * direction.z);
    if (magnitude === 0) return;
    
    direction.x /= magnitude;
    direction.z /= magnitude;
    
    // Apply movement
    const deltaTime = this.updateInterval / 1000; // Convert to seconds
    const moveDistance = moveSpeed * deltaTime;
    
    enemy.position.x += direction.x * moveDistance;
    enemy.position.z += direction.z * moveDistance;
    
    // Calculate rotation to face target
    enemy.rotation = Math.atan2(direction.x, direction.z);
    
    // Broadcast position update to all players
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: enemy.id,
        position: enemy.position,
        rotation: enemy.rotation,
        timestamp: Date.now()
      });
    }
  }

  // Get movement speed modified by status effects
  getModifiedMovementSpeed(enemyId, baseSpeed) {
    if (!this.room) return baseSpeed;
    
    let modifiedSpeed = baseSpeed;
    
    // Check for freeze effect - sets speed to 0
    if (this.room.isEnemyAffectedBy(enemyId, 'freeze')) {
      return 0;
    }
    
    // Check for slow effect - reduces speed by 50%
    if (this.room.isEnemyAffectedBy(enemyId, 'slow')) {
      modifiedSpeed *= 0.5; // 50% speed
    }
    
    // Check for corrupted effect - gradually increasing slow
    if (this.room.isEnemyAffectedBy(enemyId, 'corrupted')) {
      const corruptedMultiplier = this.getCorruptedSlowMultiplier(enemyId);
      modifiedSpeed *= (1 - corruptedMultiplier);
    }
    
    return Math.max(0, modifiedSpeed);
  }

  // Calculate corrupted debuff slow multiplier with gradual recovery
  getCorruptedSlowMultiplier(enemyId) {
    if (!this.room) return 0;
    
    const effects = this.room.getEnemyStatusEffects(enemyId);
    if (!effects.corrupted) return 0;
    
    // Get the status effect from room
    const corruptedExpiration = this.room.enemyStatusEffects.get(enemyId)?.corrupted;
    if (!corruptedExpiration) return 0;
    
    const now = Date.now();
    const totalDuration = 8000; // 8 seconds total duration
    const elapsed = totalDuration - (corruptedExpiration - now);
    
    // Initial: 90% slow, recovers 10% per second
    const initialSlowPercent = 0.9;
    const recoveryRate = 0.1; // 10% per second
    const elapsedSeconds = elapsed / 1000;
    
    const currentSlowPercent = Math.max(0, initialSlowPercent - (elapsedSeconds * recoveryRate));
    
    return currentSlowPercent;
  }

  getEnemyMoveSpeed(enemyType) {
    // Different enemy types have different movement speeds
    switch (enemyType) {
      case 'elite': return 0.0; // Elite enemies are stationary like training dummies
      case 'boss': return 2; // Boss moves at moderate speed
      case 'boss-skeleton': return 2.5; // Boss-summoned skeletons move at normal skeleton speed
      case 'skeleton': return 2.0;
      case 'mage': return 1.5;
      case 'reaper': return 2.5;
      case 'abomination': return 1.0;
      case 'death-knight': return 1.8;
      case 'ascendant': return 2.2;
      case 'fallen-titan': return 0.8;
      default: return 2.0;
    }
  }

  calculateDistance(pos1, pos2) {
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = pos1.z - pos2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  // Check if boss is facing the target within a reasonable angle tolerance
  isBossFacingTarget(boss, player) {
    // Calculate the angle from boss to player
    const direction = {
      x: player.position.x - boss.position.x,
      z: player.position.z - boss.position.z
    };

    // Calculate target angle (same logic as moveEnemyTowardsTarget)
    const targetAngle = Math.atan2(direction.x, direction.z);

    // Get the boss's current facing angle
    const bossAngle = boss.rotation || 0;

    // Calculate the angle difference
    let angleDiff = targetAngle - bossAngle;

    // Normalize angle difference to [-π, π]
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

    // Get absolute angle difference
    const absAngleDiff = Math.abs(angleDiff);

    // Boss can attack if within 45 degrees (π/4 radians) of facing the target
    const facingTolerance = Math.PI / 4; // 45 degrees (90 degree cone total)

    const isFacing = absAngleDiff <= facingTolerance;
    
    // Debug log when boss tries to attack but isn't facing target
    if (!isFacing) {
      const angleDegrees = (absAngleDiff * 180 / Math.PI).toFixed(1);
      console.log(`🔄 Boss ${boss.id} rotating to face target (${angleDegrees}° off)`);
    }

    return isFacing;
  }

  // Remove enemy from aggro tracking when it dies
  removeEnemyAggro(enemyId) {
    this.enemyAggro.delete(enemyId);
    this.bossDamageTracking.delete(enemyId);
    this.bossAttackCooldown.delete(enemyId);
  }

  // Apply taunt effect to enemy (Deathgrasp ability)
  tauntEnemy(enemyId, taunterPlayerId, duration = 10000) { // Default 10 seconds
    const tauntEndTime = Date.now() + duration;
    this.enemyTaunts.set(enemyId, {
      taunterPlayerId,
      tauntEndTime
    });

    console.log(`🎯 Enemy ${enemyId} taunted by player ${taunterPlayerId} for ${duration/1000} seconds`);
  }

  // Check if enemy is currently taunted
  isEnemyTaunted(enemyId) {
    const tauntData = this.enemyTaunts.get(enemyId);
    if (!tauntData) return false;

    // Check if taunt has expired
    if (Date.now() > tauntData.tauntEndTime) {
      console.log(`⏰ Taunt expired for enemy ${enemyId}`);
      this.enemyTaunts.delete(enemyId);
      return false;
    }

    return true;
  }

  // Get taunt target for enemy
  getEnemyTauntTarget(enemyId) {
    const tauntData = this.enemyTaunts.get(enemyId);
    return tauntData ? tauntData.taunterPlayerId : null;
  }

  // Update aggro when player damages enemy
  updateAggro(enemyId, playerId, aggroAmount = 50) {
    const aggroData = this.enemyAggro.get(enemyId);
    if (aggroData) {
      // Switch target to the player who damaged the enemy
      aggroData.targetPlayerId = playerId;
      aggroData.aggro += aggroAmount;
      aggroData.lastUpdate = Date.now();
    }
  }
}

module.exports = EnemyAI;
