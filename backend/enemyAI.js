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

    // Boss DeathGrasp cooldown tracking
    this.bossDeathGraspCooldown = new Map(); // enemyId -> lastDeathGraspTime

    // Boss teleport cooldown tracking
    this.bossTeleportCooldown = new Map(); // enemyId -> lastTeleportTime

    // Boss skeleton summoning tracking
    this.bossSkeletonSummonCooldown = new Map(); // enemyId -> lastSummonTime
    this.bossSummonedSkeletons = new Map(); // enemyId -> Set of skeleton IDs

    // Boss spawn time tracking (for initial meteor delay)
    this.bossSpawnTime = new Map(); // enemyId -> spawnTimestamp

    // Debug logging throttle for meteor blocking
    this._lastMeteorDebugLog = new Map(); // debugKey -> lastLogTime

    // Enemy taunt tracking (for Wraithblade ability)
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
    this.bossSpawnTime.clear();
    this.bossMeteorCooldown.clear();
    this.bossDeathGraspCooldown.clear();
    this.bossSkeletonSummonCooldown.clear();
    this.bossSummonedSkeletons.clear();
    this._lastMeteorDebugLog.clear();
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
    // Note: Taunt now works by giving aggro priority instead of overriding AI completely

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
    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    
    // If target is dead or doesn't exist, find a new target
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(enemy, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        // No valid targets available
        return;
      }
    }

    // Move enemy towards target
    this.moveEnemyTowardsTarget(enemy, targetPlayer);
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
    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    
    // If target is dead or doesn't exist, find a new target
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(skeleton, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        // No valid targets available
        return;
      }
    }

    // Check if skeleton can attack target (within range)
    const distance = this.calculateDistance(skeleton.position, targetPlayer.position);
    const attackRange = 2.4;
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
    const damage = skeleton.damage || 29; // Default 29 damage

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
    // Note: Taunt now works by giving aggro priority instead of overriding AI completely

    // console.log(`🤖 Updating Boss AI for ${boss.id}, current target: ${boss.currentTarget || 'none'}`);

    // Initialize damage tracking for this boss if not exists
    if (!this.bossDamageTracking.has(boss.id)) {
      this.bossDamageTracking.set(boss.id, new Map());
    }

    const damageMap = this.bossDamageTracking.get(boss.id);

    // Determine target based on damage dealt (with taunt priority)
    let targetPlayer = null;
    let maxDamage = 0;
    let topDamagePlayerId = null;

    // Check if boss is currently taunted
    const isTaunted = this.isEnemyTaunted(boss.id);
    const tauntTargetId = isTaunted ? this.getEnemyTauntTarget(boss.id) : null;

    // console.log(`📊 Boss ${boss.id} damage tracking:`, Array.from(damageMap.entries()));

    // Find player who dealt most damage (taunted player gets massive priority bonus)
    damageMap.forEach((damage, playerId) => {
      const player = players.find(p => p.id === playerId);
      
      // Skip dead players
      if (!player || player.health <= 0) {
        return;
      }

      let effectiveDamage = damage;

      // If this player is the taunt target, give them massive damage bonus for targeting
      if (isTaunted && playerId === tauntTargetId) {
        effectiveDamage += 10000; // Massive bonus to ensure taunt priority
        console.log(`🎯 Boss ${boss.id} prioritizing taunted player ${playerId} (${damage} + 10000 bonus)`);
      }

      if (effectiveDamage > maxDamage) {
        maxDamage = effectiveDamage;
        topDamagePlayerId = playerId;
        targetPlayer = player;
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
    const attackRange = 2.9; // Boss attack range
    const attackCooldown = 875; // 2 seconds between attacks

    // ALWAYS update rotation to face target, even when standing still
    this.updateBossRotation(boss, targetPlayer);

    // Track boss spawn time if not already tracked
    if (!this.bossSpawnTime.has(boss.id)) {
      // Use boss.spawnedAt from boss data, or current time as fallback
      const spawnTime = boss.spawnedAt || Date.now();
      this.bossSpawnTime.set(boss.id, spawnTime);
      console.log(`🕐 Boss ${boss.id} spawn time tracked: ${new Date(spawnTime).toISOString()} (using ${boss.spawnedAt ? 'boss.spawnedAt' : 'current time as fallback'})`);
      
      // Verify the spawn time is reasonable (not in the future, not too far in the past)
      const now = Date.now();
      if (spawnTime > now) {
        console.warn(`⚠️ Boss ${boss.id} has spawn time in the future! Correcting to current time.`);
        this.bossSpawnTime.set(boss.id, now);
      } else if (now - spawnTime > 3600000) { // More than 1 hour ago
        console.warn(`⚠️ Boss ${boss.id} has spawn time more than 1 hour in the past (${((now - spawnTime) / 60000).toFixed(1)} minutes ago). This might be from an old session.`);
      }
    }

    // Check meteor cooldown (20 seconds) and initial 60 second delay
    const meteorCooldown = 20000;
    const initialMeteorDelay = 60000; // 60 seconds before first meteor
    const lastMeteorTime = this.bossMeteorCooldown.get(boss.id) || 0;
    const bossSpawnTime = this.bossSpawnTime.get(boss.id);
    const now = Date.now();
    const timeSinceSpawn = now - bossSpawnTime;

    // Only allow meteor if:
    // 1. At least 60 seconds have passed since boss spawned
    // 2. Normal cooldown has passed since last meteor
    if (timeSinceSpawn >= initialMeteorDelay && now - lastMeteorTime >= meteorCooldown) {
      // Cast meteor ability at all player positions
      console.log(`☄️ Boss ${boss.id} casting meteor (${(timeSinceSpawn / 1000).toFixed(1)}s since spawn, ${((now - lastMeteorTime) / 1000).toFixed(1)}s since last meteor)`);
      this.bossCastMeteor(boss, players);
      this.bossMeteorCooldown.set(boss.id, now);
    } else {
      // Debug: Log why meteor was blocked (only log every 5 seconds to avoid spam)
      const debugKey = `${boss.id}-meteor-debug`;
      const lastDebugLog = this._lastMeteorDebugLog.get(debugKey) || 0;
      if (now - lastDebugLog >= 5000) { // Log every 5 seconds
        const timeUntilMeteor = Math.max(0, initialMeteorDelay - timeSinceSpawn);
        const reason = timeSinceSpawn < initialMeteorDelay 
          ? `Initial 60s delay (${(timeUntilMeteor / 1000).toFixed(1)}s remaining)`
          : `Normal cooldown (${((meteorCooldown - (now - lastMeteorTime)) / 1000).toFixed(1)}s remaining)`;
        console.log(`⏳ Boss ${boss.id} meteor blocked: ${reason} [${(timeSinceSpawn / 1000).toFixed(1)}s since spawn]`);
        this._lastMeteorDebugLog.set(debugKey, now);
      }
    }

    // Check skeleton summoning cooldown (17.5 seconds)
    const skeletonSummonCooldown = 22500;
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

    // Check DeathGrasp cooldown (10 seconds)
    const deathGraspCooldown = 10000;
    const lastDeathGraspTime = this.bossDeathGraspCooldown.get(boss.id) || 0;

    if (now - lastDeathGraspTime >= deathGraspCooldown) {
      // Cast DeathGrasp at a random player
      this.bossCastDeathGrasp(boss, players);
      this.bossDeathGraspCooldown.set(boss.id, now);
    }

    // Check Teleport cooldown (10 seconds) with initial 15 second delay
    const teleportCooldown = 10000;
    const initialTeleportDelay = 15000; // 15 seconds before first teleport
    const lastTeleportTime = this.bossTeleportCooldown.get(boss.id) || 0;

    // Only allow teleport if:
    // 1. At least 15 seconds have passed since boss spawned
    // 2. Normal cooldown has passed since last teleport
    // 3. Target player exists
    if (timeSinceSpawn >= initialTeleportDelay && now - lastTeleportTime >= teleportCooldown && targetPlayer) {
      // Teleport behind the target player
      console.log(`✨ Boss ${boss.id} initiating teleport to player ${targetPlayer.name || targetPlayer.id} (${(timeSinceSpawn / 1000).toFixed(1)}s since spawn, ${((now - lastTeleportTime) / 1000).toFixed(1)}s since last teleport)`);
      this.bossCastTeleport(boss, targetPlayer);
      this.bossTeleportCooldown.set(boss.id, now);
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

    const damage = 41; // Boss deals 43 damage per hit (updated from 37)

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

    if (targetPositions.length === 0) {
      console.log(`⚠️ Boss ${boss.id} tried to cast meteor but no players found`);
      return;
    }

    const meteorId = `meteor-${boss.id}-${Date.now()}`;
    const spawnTime = this.bossSpawnTime.get(boss.id);
    const timeSinceSpawn = spawnTime ? ((Date.now() - spawnTime) / 1000).toFixed(1) : 'unknown';

    // Broadcast meteor cast to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-meteor-cast', {
        bossId: boss.id,
        meteorId: meteorId,
        targetPositions: targetPositions,
        timestamp: Date.now()
      });
    }

    console.log(`☄️☄️☄️ METEOR CAST: Boss ${boss.id} cast meteor at ${targetPositions.length} player positions! (${timeSinceSpawn}s since spawn)`);
  }

  bossCastDeathGrasp(boss, players) {
    // Select a random player to target
    if (players.length === 0) {
      console.log(`⚠️ Boss ${boss.id} tried to cast DeathGrasp but no players found`);
      return;
    }

    const randomPlayer = players[Math.floor(Math.random() * players.length)];
    const deathGraspId = `deathgrasp-${boss.id}-${Date.now()}`;

    // Calculate direction from boss to target player
    const dx = randomPlayer.position.x - boss.position.x;
    const dz = randomPlayer.position.z - boss.position.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const direction = {
      x: length > 0 ? dx / length : 0,
      y: 0,
      z: length > 0 ? dz / length : 0
    };

    // Broadcast DeathGrasp cast to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-deathgrasp-cast', {
        bossId: boss.id,
        deathGraspId: deathGraspId,
        startPosition: boss.position,
        direction: direction,
        targetPlayerId: randomPlayer.id,
        timestamp: Date.now()
      });
    }

    console.log(`💀 Boss ${boss.id} casting DeathGrasp at player ${randomPlayer.name || randomPlayer.id}!`);
  }

  bossCastTeleport(boss, targetPlayer) {
    if (!targetPlayer) {
      console.log(`⚠️ Boss ${boss.id} tried to teleport but no target player found`);
      return;
    }

    // Store the starting position for the teleport effect
    const startPosition = {
      x: boss.position.x,
      y: boss.position.y,
      z: boss.position.z
    };

    // Calculate position behind the target player
    // Get the player's Y rotation (horizontal facing direction) in radians
    const playerRotation = targetPlayer.rotation?.y || 0;
    
    // Calculate position 2.5 units behind the player based on their facing direction
    // Player rotation.y is in radians, where 0 points along +Z axis
    const teleportDistance = 2.5;
    
    // Calculate the direction the player is facing
    const facingX = Math.sin(playerRotation);
    const facingZ = Math.cos(playerRotation);
    
    // Position boss behind the player (opposite to facing direction)
    const endPosition = {
      x: targetPlayer.position.x - facingX * teleportDistance,
      y: targetPlayer.position.y,
      z: targetPlayer.position.z - facingZ * teleportDistance
    };
    
    console.log(`📍 Teleport calculation: Player at (${targetPlayer.position.x.toFixed(2)}, ${targetPlayer.position.z.toFixed(2)}) rotation: ${playerRotation.toFixed(2)}, Boss teleporting to (${endPosition.x.toFixed(2)}, ${endPosition.z.toFixed(2)})`);


    // Update boss position immediately
    boss.position.x = endPosition.x;
    boss.position.y = endPosition.y;
    boss.position.z = endPosition.z;

    // Calculate rotation to face the player after teleporting
    const rotDx = targetPlayer.position.x - endPosition.x;
    const rotDz = targetPlayer.position.z - endPosition.z;
    boss.rotation = Math.atan2(rotDx, rotDz);

    // Broadcast teleport event to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-teleport', {
        bossId: boss.id,
        startPosition: startPosition,
        endPosition: endPosition,
        rotation: boss.rotation,
        targetPlayerId: targetPlayer.id,
        timestamp: Date.now()
      });
    }

    console.log(`✨✨✨ TELEPORT SUCCESS: Boss ${boss.id} teleported behind player ${targetPlayer.name || targetPlayer.id} from (${startPosition.x.toFixed(2)}, ${startPosition.z.toFixed(2)}) to (${endPosition.x.toFixed(2)}, ${endPosition.z.toFixed(2)})!`);
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
      health: 666,
      maxHealth: 666,
      isDying: false,
      damage: 29,
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
  trackBossDamage(bossId, playerId, damage, player = null) {
    if (!this.bossDamageTracking.has(bossId)) {
      this.bossDamageTracking.set(bossId, new Map());
    }

    const damageMap = this.bossDamageTracking.get(bossId);
    let effectiveDamage = damage;

    // Apply massive aggro multiplier for Sabres stealth attacks (similar to WraithStrike taunt)
    if (player && player.isStealthing) {
      const stealthMultiplier = 10.0; // 10x aggro generation while stealthing
      effectiveDamage *= stealthMultiplier;
      console.log(`👤 Stealth aggro bonus: Player ${playerId} stealth attack (${damage} damage) -> ${effectiveDamage} effective aggro`);
    }

    const currentDamage = damageMap.get(playerId) || 0;
    damageMap.set(playerId, currentDamage + effectiveDamage);

    console.log(`📊 Boss aggro - Player ${playerId} has dealt ${currentDamage + effectiveDamage} total damage to boss ${bossId}${player?.isStealthing ? ' (STEALTH BONUS)' : ''}`);
  }

  findClosestPlayer(enemy, players) {
    let closestPlayer = null;
    let closestDistance = Infinity;

    players.forEach(player => {
      // Skip dead players (health <= 0)
      if (player.health <= 0) {
        return;
      }

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

    // Check for stun effect - sets speed to 0
    if (this.room.isEnemyAffectedBy(enemyId, 'stun')) {
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
      case 'boss': return 1.25; // Boss moves at moderate speed
      case 'boss-skeleton': return 1.75; // Boss-summoned skeletons move at normal skeleton speed
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
    this.bossSpawnTime.delete(enemyId);
    this.bossMeteorCooldown.delete(enemyId);
    this.bossSkeletonSummonCooldown.delete(enemyId);
    this.bossSummonedSkeletons.delete(enemyId);
  }

  // Apply taunt effect to enemy (Wraithblade ability)
  tauntEnemy(enemyId, taunterPlayerId, duration = 10000) { // Default 10 seconds
    const tauntEndTime = Date.now() + duration;
    this.enemyTaunts.set(enemyId, {
      taunterPlayerId,
      tauntEndTime
    });

    // For bosses, add taunt bonus to damage tracking
    // For regular enemies, use regular aggro system
    const enemy = this.room?.enemies.get(enemyId);
    if (enemy && enemy.type === 'boss') {
      // Initialize damage tracking if not exists
      if (!this.bossDamageTracking.has(enemyId)) {
        this.bossDamageTracking.set(enemyId, new Map());
      }
      const damageMap = this.bossDamageTracking.get(enemyId);
      const currentDamage = damageMap.get(taunterPlayerId) || 0;
      damageMap.set(taunterPlayerId, currentDamage + 1000); // Large damage bonus for taunt
      console.log(`🎯 Boss ${enemyId} taunted by player ${taunterPlayerId} for ${duration/1000} seconds (damage bonus: +1000)`);
    } else {
      // For regular enemies, use regular aggro system
      this.updateAggro(enemyId, taunterPlayerId, 1000); // Large aggro bonus
      console.log(`🎯 Enemy ${enemyId} taunted by player ${taunterPlayerId} for ${duration/1000} seconds (aggro priority)`);
    }
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

  // Remove player from all aggro charts when they die
  removePlayerFromAllAggro(deadPlayerId) {
    console.log(`💀 Removing dead player ${deadPlayerId} from all aggro charts`);

    // Remove from all boss damage tracking
    this.bossDamageTracking.forEach((damageMap, bossId) => {
      if (damageMap.has(deadPlayerId)) {
        damageMap.delete(deadPlayerId);
        console.log(`  - Removed ${deadPlayerId} from boss ${bossId} damage tracking`);
      }
    });

    // Remove from all enemy aggro (regular enemies, skeletons, etc.)
    this.enemyAggro.forEach((aggroData, enemyId) => {
      if (aggroData.targetPlayerId === deadPlayerId) {
        // Clear the target for this enemy - it will find a new target on next update
        aggroData.targetPlayerId = null;
        aggroData.aggro = 0;
        console.log(`  - Cleared ${deadPlayerId} as target for enemy ${enemyId}`);
      }
    });
  }
}

module.exports = EnemyAI;