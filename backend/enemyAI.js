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

    // Blade-enhanced state after blink (next attack deals double damage for 1.5s)
    this.bossBladeEnhanced = new Map(); // enemyId -> expiryTimestamp

    // Boss skeleton summoning tracking
    this.bossSkeletonSummonCooldown = new Map(); // enemyId -> lastSummonTime
    this.bossSummonedSkeletons = new Map(); // enemyId -> Set of skeleton IDs

    // Boss spawn time tracking (for initial meteor delay)
    this.bossSpawnTime = new Map(); // enemyId -> spawnTimestamp

    // Debug logging throttle for meteor blocking
    this._lastMeteorDebugLog = new Map(); // debugKey -> lastLogTime

    // Enemy taunt tracking (for Wraithblade ability)
    this.enemyTaunts = new Map(); // enemyId -> { taunterPlayerId, tauntEndTime }

    // Warlock ability cooldown tracking
    this.warlockBlinkCooldown  = new Map(); // enemyId -> lastBlinkTime
    this.warlockLaunchCooldown = new Map(); // enemyId -> lastLaunchTime

    // Shade blink+attack cooldown tracking (4-second cooldown)
    this.shadeBlinkCooldown = new Map(); // enemyId -> lastBlinkTime

    // Viper arrow shot cooldown tracking (2-second cooldown)
    this.viperAttackCooldown = new Map(); // enemyId -> lastAttackTime

    // Weaver ability cooldown tracking
    this.weaverHealCooldown   = new Map(); // enemyId -> lastHealTime
    this.weaverSummonCooldown = new Map(); // enemyId -> lastSummonTime

    // Weaver summoned ghoul tracking (1 ghoul per weaver at a time)
    this.weaverSummonedGhouls = new Map(); // weaverId -> ghoulId | null

    // Ghoul attack cooldown tracking
    this.ghoulAttackCooldown = new Map(); // enemyId -> lastAttackTime
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
    this.bossBladeEnhanced.clear();
    this.warlockBlinkCooldown.clear();
    this.warlockLaunchCooldown.clear();
    this.shadeBlinkCooldown.clear();
    this.viperAttackCooldown.clear();
    this.weaverHealCooldown.clear();
    this.weaverSummonCooldown.clear();
    this.weaverSummonedGhouls.clear();
    this.ghoulAttackCooldown.clear();
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

    // Special handling for knights
    if (enemy.type === 'knight') {
      this.updateKnightAI(enemy, players);
      return;
    }

    // Special handling for shades
    if (enemy.type === 'shade') {
      this.updateShadeAI(enemy, players);
      return;
    }

    // Special handling for warlocks
    if (enemy.type === 'warlock') {
      this.updateWarlockAI(enemy, players);
      return;
    }

    // Special handling for vipers
    if (enemy.type === 'viper') {
      this.updateViperAI(enemy, players);
      return;
    }

    // Special handling for templars
    if (enemy.type === 'templar') {
      this.updateTemplarAI(enemy, players);
      return;
    }

    // Special handling for weavers
    if (enemy.type === 'weaver') {
      this.updateWeaverAI(enemy, players);
      return;
    }

    // Special handling for ghouls (weaver summons)
    if (enemy.type === 'ghoul') {
      this.updateGhoulAI(enemy, players);
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
        // Lock cooldown immediately so the telegraph doesn't re-trigger
        this.bossAttackCooldown.set(skeleton.id, now);

        // Telegraph the attack (starts animation on clients)
        this.telegraphSkeletonAttack(skeleton, targetPlayer);

        // After 1 second, confirm damage only if the player is still in range
        const telegraphDelay = 1000;
        setTimeout(() => {
          // Abort if skeleton died or room ended during the telegraph
          if (skeleton.isDying || !this.room?.getGameStarted()) return;

          const currentPlayers = this.room?.getPlayers();
          if (!currentPlayers) return;

          const currentTarget = currentPlayers.find(p => p.id === targetPlayer.id);
          if (!currentTarget || currentTarget.health <= 0) return;

          // Only deal damage if player is still within attack range
          const currentDistance = this.calculateDistance(skeleton.position, currentTarget.position);
          if (currentDistance <= attackRange) {
            this.bossSkeletonAttackPlayer(skeleton, currentTarget);
          } else {
            console.log(`💀 Skeleton ${skeleton.id} attack missed - player ${currentTarget.id} dodged out of range!`);
          }
        }, telegraphDelay);
      }
    } else {
      // Outside attack range - move towards target
      this.moveEnemyTowardsTarget(skeleton, targetPlayer);
    }
  }

  telegraphSkeletonAttack(skeleton, player) {
    // Broadcast the telegraph to all players so the attack animation starts
    if (this.io) {
      this.io.to(this.roomId).emit('boss-skeleton-attack-telegraph', {
        skeletonId: skeleton.id,
        targetPlayerId: player.id,
        position: skeleton.position,
        timestamp: Date.now()
      });
    }

    console.log(`💀 Boss skeleton ${skeleton.id} telegraphing attack at player ${player.id}!`);
  }

  bossSkeletonAttackPlayer(skeleton, player) {
    const damage = skeleton.damage || 17;

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

  // ─── Knight AI ───────────────────────────────────────────────────────────────

  updateKnightAI(knight, players) {
    let aggroData = this.enemyAggro.get(knight.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(knight, players);
      if (!closestPlayer) return;
      aggroData = { targetPlayerId: closestPlayer.id, lastUpdate: Date.now(), aggro: 100 };
      this.enemyAggro.set(knight.id, aggroData);
    }

    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(knight, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return;
      }
    }

    const distance = this.calculateDistance(knight.position, targetPlayer.position);
    const attackRange = 2.6; // Slightly longer reach than skeleton (shield bash + sword)
    const attackCooldown = knight.attackCooldown ?? 2500; // Soul-type override, default 2.5s
    const aggroRadius = 5;   // Knight idles until a player steps within this range

    // Once aggroed, stay aggroed until the player gets very far (leash at 3× aggro radius)
    const leashRadius = aggroRadius * 3;
    if (!aggroData.isAggroed && distance <= aggroRadius) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
    }

    if (!aggroData.isAggroed) {
      // Player is out of aggro range — stand still, client shows Idle automatically
      return;
    }

    if (distance <= attackRange) {
      if (!this.bossAttackCooldown.has(knight.id)) {
        this.bossAttackCooldown.set(knight.id, 0);
      }

      const lastAttackTime = this.bossAttackCooldown.get(knight.id);
      const now = Date.now();

      if (now - lastAttackTime >= attackCooldown) {
        this.bossAttackCooldown.set(knight.id, now);
        this.telegraphKnightAttack(knight, targetPlayer);

        setTimeout(() => {
          if (knight.isDying || !this.room?.getGameStarted()) return;

          const currentPlayers = this.room?.getPlayers();
          if (!currentPlayers) return;

          const currentTarget = currentPlayers.find(p => p.id === targetPlayer.id);
          if (!currentTarget || currentTarget.health <= 0) return;

          const currentDistance = this.calculateDistance(knight.position, currentTarget.position);
          if (currentDistance <= attackRange) {
            this.knightAttackPlayer(knight, currentTarget);
          } else {
            console.log(`⚔️ Knight ${knight.id} swing missed - player dodged!`);
          }
        }, 1000);
      }
    } else {
      this.moveEnemyTowardsTarget(knight, targetPlayer);
    }
  }

  telegraphKnightAttack(knight, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('knight-attack-telegraph', {
        knightId: knight.id,
        targetPlayerId: player.id,
        position: knight.position,
        timestamp: Date.now()
      });
    }
    console.log(`⚔️ Knight ${knight.id} telegraphing attack at player ${player.id}!`);
  }

  knightAttackPlayer(knight, player) {
    const damage = knight.damage || 25;

    if (this.io) {
      this.io.to(this.roomId).emit('knight-attack', {
        knightId: knight.id,
        targetPlayerId: player.id,
        damage: damage,
        position: knight.position,
        timestamp: Date.now()
      });
    }

    console.log(`⚔️ Knight ${knight.id} attacked player ${player.id} for ${damage} damage!`);
  }

  // ─── Shade AI ────────────────────────────────────────────────────────────────

  updateShadeAI(shade, players) {
    let aggroData = this.enemyAggro.get(shade.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(shade, players);
      if (!closestPlayer) return;
      aggroData = { targetPlayerId: closestPlayer.id, lastUpdate: Date.now(), aggro: 100 };
      this.enemyAggro.set(shade.id, aggroData);
    }

    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(shade, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return;
      }
    }

    const distance = this.calculateDistance(shade.position, targetPlayer.position);
    const attackRange = 11.0;  // ranged throw
    const aggroRadius = 7;
    const leashRadius = aggroRadius * 3;

    if (!aggroData.isAggroed && distance <= aggroRadius) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
    }

    if (!aggroData.isAggroed) return;

    if (distance <= attackRange) {
      // Face the target even while standing still
      const dx = targetPlayer.position.x - shade.position.x;
      const dz = targetPlayer.position.z - shade.position.z;
      shade.rotation = Math.atan2(dx, dz);
      if (this.io) {
        this.io.to(this.roomId).emit('enemy-moved', {
          enemyId: shade.id,
          position: shade.position,
          rotation: shade.rotation,
          timestamp: Date.now()
        });
      }

      // Blink perpendicular then attack (4-second cooldown)
      const blinkCooldown = 4000;
      const lastBlinkTime = this.shadeBlinkCooldown.get(shade.id) || 0;
      const now = Date.now();

      if (now - lastBlinkTime >= blinkCooldown) {
        this.shadeBlinkCooldown.set(shade.id, now);
        this.shadeCastBlinkAndAttack(shade, targetPlayer);
      }
    } else {
      this.moveEnemyTowardsTarget(shade, targetPlayer);
    }
  }

  shadeCastBlinkAndAttack(shade, targetPlayer) {
    const startPosition = { ...shade.position };

    // Direction from shade toward target
    const dx  = targetPlayer.position.x - shade.position.x;
    const dz  = targetPlayer.position.z - shade.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) return;

    // Forward and left unit vectors
    const fwdX  =  dx / len;
    const fwdZ  =  dz / len;
    const leftX = -dz / len; // 90° CCW of forward
    const leftZ  =  dx / len;

    // Pick one of four angles relative to forward: ±45° (diagonal) or ±90° (perpendicular).
    // Straight forward (0°) and backward angles are intentionally excluded.
    const ANGLES = [-Math.PI / 2, -Math.PI / 4, Math.PI / 4, Math.PI / 2];
    const theta  = ANGLES[Math.floor(Math.random() * ANGLES.length)];

    // Rotate forward vector by theta: dir = cos(θ)·fwd + sin(θ)·left
    const blinkX = Math.cos(theta) * fwdX + Math.sin(theta) * leftX;
    const blinkZ = Math.cos(theta) * fwdZ + Math.sin(theta) * leftZ;

    const blinkDist = 4;
    const endPosition = {
      x: shade.position.x + blinkX * blinkDist,
      y: shade.position.y,
      z: shade.position.z + blinkZ * blinkDist,
    };

    // Update server position immediately
    shade.position.x = endPosition.x;
    shade.position.y = endPosition.y;
    shade.position.z = endPosition.z;

    // Face the target from the new position
    const rotDx = targetPlayer.position.x - endPosition.x;
    const rotDz = targetPlayer.position.z - endPosition.z;
    shade.rotation = Math.atan2(rotDx, rotDz);

    if (this.io) {
      this.io.to(this.roomId).emit('shade-blink-telegraph', {
        shadeId: shade.id,
        startPosition,
        endPosition,
        rotation: shade.rotation,
        timestamp: Date.now()
      });
    }

    const dirLabel = theta > 0 ? (Math.abs(theta) < Math.PI / 2 ? 'diagonal-fwd-left' : 'left') : (Math.abs(theta) < Math.PI / 2 ? 'diagonal-fwd-right' : 'right');
    console.log(`👻 Shade ${shade.id} blinked 4 units ${dirLabel} of target (θ=${(theta * 180 / Math.PI).toFixed(0)}°)`);

    // After the blink completes, fire daggers at the target's location
    const BLINK_DURATION = 600; // ms — client position snap delay
    setTimeout(() => {
      if (shade.isDying || !this.room?.getGameStarted()) return;

      const currentPlayers = this.room?.getPlayers();
      if (!currentPlayers) return;

      const currentTarget = currentPlayers.find(p => p.id === targetPlayer.id);
      if (!currentTarget || currentTarget.health <= 0) return;

      this.telegraphShadeAttack(shade, currentTarget);
    }, BLINK_DURATION);
  }

  telegraphShadeAttack(shade, targetPlayer) {
    if (this.io) {
      this.io.to(this.roomId).emit('shade-attack-telegraph', {
        shadeId: shade.id,
        targetPlayerId: targetPlayer.id,
        // Offset positions upward so daggers fly at torso/chest height
        // (shade model is ~2× taller than knight after the scale adjustment)
        startPosition: {
          x: shade.position.x,
          y: shade.position.y + 2.0,
          z: shade.position.z
        },
        targetPosition: {
          x: targetPlayer.position.x,
          y: targetPlayer.position.y + 1.0,
          z: targetPlayer.position.z
        },
        damage: 25,
        timestamp: Date.now()
      });
    }
    console.log(`👻 Shade ${shade.id} throwing daggers at player ${targetPlayer.id}!`);
  }

  // ─── Warlock AI ──────────────────────────────────────────────────────────────

  updateWarlockAI(warlock, players) {
    let aggroData = this.enemyAggro.get(warlock.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(warlock, players);
      if (!closestPlayer) return;
      aggroData = { targetPlayerId: closestPlayer.id, lastUpdate: Date.now(), aggro: 100 };
      this.enemyAggro.set(warlock.id, aggroData);
    }

    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(warlock, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return;
      }
    }

    const distance    = this.calculateDistance(warlock.position, targetPlayer.position);
    const aggroRadius = 8; // Slightly larger than knight/shade (5)
    const leashRadius = aggroRadius * 3;

    if (!aggroData.isAggroed && distance <= aggroRadius) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
    }

    if (!aggroData.isAggroed) return;

    // Always face the target (even while idle)
    const dx = targetPlayer.position.x - warlock.position.x;
    const dz = targetPlayer.position.z - warlock.position.z;
    warlock.rotation = Math.atan2(dx, dz);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId: warlock.id,
        position: warlock.position,
        rotation: warlock.rotation,
        timestamp: Date.now()
      });
    }

    const now = Date.now();

    // ── Blink (5-second cooldown) ─────────────────────────────────────────────
    // Teleports 5 units closer to the target; plays blink animation on clients.
    const blinkCooldown = 8000;
    const lastBlinkTime = this.warlockBlinkCooldown.get(warlock.id) || 0;

    if (now - lastBlinkTime >= blinkCooldown && distance > 3) {
      this.warlockBlinkCooldown.set(warlock.id, now);
      this.warlockCastBlink(warlock, targetPlayer);
    }

    // ── Launch (6-second cooldown) ───────────────────────────────────────────
    // Fires a large chaotic projectile at the target's current position.
    const launchRange    = 14.0; // Slightly more than shade attack range (9.0)
    const launchCooldown = 6000;
    const lastLaunchTime = this.warlockLaunchCooldown.get(warlock.id) || 0;

    if (distance <= launchRange && now - lastLaunchTime >= launchCooldown) {
      this.warlockLaunchCooldown.set(warlock.id, now);
      this.warlockCastLaunch(warlock, targetPlayer);
    }
  }

  warlockCastBlink(warlock, targetPlayer) {
    const startPosition = { ...warlock.position };

    // Direction from warlock toward target
    const dx  = targetPlayer.position.x - warlock.position.x;
    const dz  = targetPlayer.position.z - warlock.position.z;
    const len = Math.sqrt(dx * dx + dz * dz);
    if (len === 0) return;

    const blinkDist = 7; // Teleport 5 units closer
    const endPosition = {
      x: warlock.position.x + (dx / len) * blinkDist,
      y: warlock.position.y,
      z: warlock.position.z + (dz / len) * blinkDist,
    };

    // Update server position immediately
    warlock.position.x = endPosition.x;
    warlock.position.y = endPosition.y;
    warlock.position.z = endPosition.z;

    // Rotation to face target from new position
    const rotDx = targetPlayer.position.x - endPosition.x;
    const rotDz = targetPlayer.position.z - endPosition.z;
    warlock.rotation = Math.atan2(rotDx, rotDz);

    if (this.io) {
      this.io.to(this.roomId).emit('warlock-blink-telegraph', {
        warlockId: warlock.id,
        startPosition,
        endPosition,
        rotation: warlock.rotation,
        timestamp: Date.now()
      });

      // Flame strike erupts at the blink destination — clients delay rendering
      // until the blink animation completes (800 ms, matches WarlockRenderer.tsx).
      this.io.to(this.roomId).emit('warlock-flame-strike', {
        warlockId: warlock.id,
        position:  endPosition,
        damage:    50,
        radius:    3.0,
        timestamp: Date.now()
      });
    }

    console.log(`🔮 Warlock ${warlock.id} blinked 5 units closer to player ${targetPlayer.id}`);
  }

  warlockCastLaunch(warlock, targetPlayer) {
    if (this.io) {
      this.io.to(this.roomId).emit('warlock-attack-telegraph', {
        warlockId: warlock.id,
        startPosition: {
          x: warlock.position.x,
          y: warlock.position.y + 2.0,
          z: warlock.position.z,
        },
        targetPosition: {
          x: targetPlayer.position.x,
          y: targetPlayer.position.y + 1.0,
          z: targetPlayer.position.z,
        },
        damage: 60,
        timestamp: Date.now()
      });
    }

    console.log(`🔮 Warlock ${warlock.id} launching chaotic orb at player ${targetPlayer.id}!`);
  }

  // ─── Templar AI ──────────────────────────────────────────────────────────────

  updateTemplarAI(templar, players) {
    let aggroData = this.enemyAggro.get(templar.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(templar, players);
      if (!closestPlayer) return;
      aggroData = { targetPlayerId: closestPlayer.id, lastUpdate: Date.now(), aggro: 100 };
      this.enemyAggro.set(templar.id, aggroData);
    }

    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(templar, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return;
      }
    }

    const distance      = this.calculateDistance(templar.position, targetPlayer.position);
    const attackRange   = 2.6;
    const attackCooldown = templar.attackCooldown ?? 2000; // Slightly faster than knight (2500 ms)
    const aggroRadius   = 6;
    const leashRadius   = aggroRadius * 3;

    if (!aggroData.isAggroed && distance <= aggroRadius) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
    }

    if (!aggroData.isAggroed) return;

    if (distance <= attackRange) {
      if (!this.bossAttackCooldown.has(templar.id)) {
        this.bossAttackCooldown.set(templar.id, 0);
      }

      const lastAttackTime = this.bossAttackCooldown.get(templar.id);
      const now = Date.now();

      if (now - lastAttackTime >= attackCooldown) {
        this.bossAttackCooldown.set(templar.id, now);
        this.telegraphTemplarAttack(templar, targetPlayer);

        setTimeout(() => {
          if (templar.isDying || !this.room?.getGameStarted()) return;

          const currentPlayers = this.room?.getPlayers();
          if (!currentPlayers) return;

          const currentTarget = currentPlayers.find(p => p.id === targetPlayer.id);
          if (!currentTarget || currentTarget.health <= 0) return;

          const currentDistance = this.calculateDistance(templar.position, currentTarget.position);
          if (currentDistance <= attackRange) {
            this.templarAttackPlayer(templar, currentTarget);
          } else {
            console.log(`🛡️ Templar ${templar.id} swing missed — player dodged!`);
          }
        }, 1000);
      }
    } else {
      this.moveEnemyTowardsTarget(templar, targetPlayer);
    }
  }

  telegraphTemplarAttack(templar, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('templar-attack-telegraph', {
        templarId: templar.id,
        targetPlayerId: player.id,
        position: templar.position,
        timestamp: Date.now()
      });
    }
    console.log(`🛡️ Templar ${templar.id} telegraphing attack at player ${player.id}!`);
  }

  templarAttackPlayer(templar, player) {
    const damage = templar.damage || 60;

    if (this.io) {
      this.io.to(this.roomId).emit('templar-attack', {
        templarId: templar.id,
        targetPlayerId: player.id,
        damage: damage,
        position: templar.position,
        timestamp: Date.now()
      });
    }

    console.log(`🛡️ Templar ${templar.id} attacked player ${player.id} for ${damage} damage!`);
  }

  // ─── Viper AI ────────────────────────────────────────────────────────────────

  updateViperAI(viper, players) {
    let aggroData = this.enemyAggro.get(viper.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(viper, players);
      if (!closestPlayer) return;
      aggroData = { targetPlayerId: closestPlayer.id, lastUpdate: Date.now(), aggro: 100 };
      this.enemyAggro.set(viper.id, aggroData);
    }

    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(viper, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return;
      }
    }

    const distance    = this.calculateDistance(viper.position, targetPlayer.position);
    const attackRange = 13.0; // Long-range archer
    const aggroRadius = 9;
    const leashRadius = aggroRadius * 3;

    if (!aggroData.isAggroed && distance <= aggroRadius) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
    }

    if (!aggroData.isAggroed) return;

    // Always face the target while aggroed.
    const dx = targetPlayer.position.x - viper.position.x;
    const dz = targetPlayer.position.z - viper.position.z;
    viper.rotation = Math.atan2(dx, dz);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId:   viper.id,
        position:  viper.position,
        rotation:  viper.rotation,
        timestamp: Date.now()
      });
    }

    if (distance <= attackRange) {
      // In range — check the 2-second attack cooldown.
      const attackCooldown = viper.attackCooldown ?? 5000;
      const lastAttackTime = this.viperAttackCooldown.get(viper.id) || 0;
      const now = Date.now();

      if (now - lastAttackTime >= attackCooldown) {
        this.viperAttackCooldown.set(viper.id, now);
        this.telegraphViperAttack(viper, targetPlayer);
      }
    } else {
      // Out of range — close the distance.
      this.moveEnemyTowardsTarget(viper, targetPlayer);
    }
  }

  telegraphViperAttack(viper, targetPlayer) {
    if (this.io) {
      this.io.to(this.roomId).emit('viper-attack-telegraph', {
        viperId:  viper.id,
        targetPlayerId: targetPlayer.id,
        // Launch arrow from chest height of the viper model.
        startPosition: {
          x: viper.position.x,
          y: viper.position.y + 1.5,
          z: viper.position.z
        },
        targetPosition: {
          x: targetPlayer.position.x,
          y: targetPlayer.position.y + 1.0,
          z: targetPlayer.position.z
        },
        damage:    70,
        timestamp: Date.now()
      });
    }
    console.log(`🐍 Viper ${viper.id} drawing bow at player ${targetPlayer.id}!`);
  }

  // ─── Weaver AI ───────────────────────────────────────────────────────────────

  updateWeaverAI(weaver, players) {
    let aggroData = this.enemyAggro.get(weaver.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(weaver, players);
      if (!closestPlayer) return;
      aggroData = { targetPlayerId: closestPlayer.id, lastUpdate: Date.now(), aggro: 100 };
      this.enemyAggro.set(weaver.id, aggroData);
    }

    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(weaver, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return;
      }
    }

    const distance    = this.calculateDistance(weaver.position, targetPlayer.position);
    const aggroRadius = 9;
    const leashRadius = aggroRadius * 3;

    if (!aggroData.isAggroed && distance <= aggroRadius) {
      aggroData.isAggroed = true;
    } else if (aggroData.isAggroed && distance > leashRadius) {
      aggroData.isAggroed = false;
    }

    if (!aggroData.isAggroed) return;

    // Always face the nearest player while aggroed.
    const dx = targetPlayer.position.x - weaver.position.x;
    const dz = targetPlayer.position.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);
    if (this.io) {
      this.io.to(this.roomId).emit('enemy-moved', {
        enemyId:   weaver.id,
        position:  weaver.position,
        rotation:  weaver.rotation,
        timestamp: Date.now()
      });
    }

    const now = Date.now();

    // ── Summon Ghoul (30-second cooldown; max 1 active ghoul) ────────────────
    const summonCooldown = 30000;
    const lastSummonTime = this.weaverSummonCooldown.get(weaver.id) || 0;
    const activeGhoulId  = this.weaverSummonedGhouls.get(weaver.id);
    const ghoulAlive     = activeGhoulId && this.room?.enemies.has(activeGhoulId) &&
                           !this.room?.enemies.get(activeGhoulId)?.isDying;

    if (!ghoulAlive && now - lastSummonTime >= summonCooldown) {
      this.weaverSummonCooldown.set(weaver.id, now);
      this.weaverCastSummon(weaver);
    }

    // ── Heal (5-second cooldown) ─────────────────────────────────────────────
    const healCooldown   = 5000;
    const healRange      = 10.0;
    const lastHealTime   = this.weaverHealCooldown.get(weaver.id) || 0;

    if (now - lastHealTime >= healCooldown) {
      const healTarget = this.findLowestHpPercentEnemy(weaver, healRange);
      if (healTarget) {
        this.weaverHealCooldown.set(weaver.id, now);
        this.weaverCastHeal(weaver, healTarget);
      }
    }

    // Move toward target player (stay at moderate range)
    const preferredRange = 8.0; // Weaver keeps distance
    if (distance > preferredRange) {
      this.moveEnemyTowardsTarget(weaver, targetPlayer);
    }
  }

  // Find the allied enemy (not a player) within healRange of the weaver that has
  // the lowest current HP percentage, skipping dying/dead enemies and the weaver itself.
  findLowestHpPercentEnemy(weaver, range) {
    if (!this.room) return null;

    let lowestPct  = Infinity;
    let bestTarget = null;

    this.room.getEnemies().forEach(enemy => {
      if (enemy.id === weaver.id) return;
      if (enemy.isDying || enemy.health <= 0) return;
      if (enemy.health >= enemy.maxHealth) return; // Already full — no point healing

      const dist = this.calculateDistance(weaver.position, enemy.position);
      if (dist > range) return;

      const pct = enemy.health / enemy.maxHealth;
      if (pct < lowestPct) {
        lowestPct  = pct;
        bestTarget = enemy;
      }
    });

    return bestTarget;
  }

  weaverCastHeal(weaver, targetEnemy) {
    // Face the heal target
    const dx = targetEnemy.position.x - weaver.position.x;
    const dz = targetEnemy.position.z - weaver.position.z;
    weaver.rotation = Math.atan2(dx, dz);

    if (this.io) {
      this.io.to(this.roomId).emit('weaver-heal-telegraph', {
        weaverId:       weaver.id,
        targetEnemyId:  targetEnemy.id,
        targetPosition: { ...targetEnemy.position },
        timestamp:      Date.now()
      });
    }
    console.log(`🧵 Weaver ${weaver.id} casting Heal on ${targetEnemy.id} (HP: ${targetEnemy.health}/${targetEnemy.maxHealth})`);

    // After cast animation (~1.8s) apply the actual heal.
    setTimeout(() => {
      if (weaver.isDying || !this.room?.getGameStarted()) return;

      const liveEnemy = this.room?.getEnemy(targetEnemy.id);
      if (!liveEnemy || liveEnemy.isDying || liveEnemy.health <= 0) return;

      const healAmount    = 150;
      const previousHp    = liveEnemy.health;
      liveEnemy.health    = Math.min(liveEnemy.maxHealth, liveEnemy.health + healAmount);
      const actualHeal    = liveEnemy.health - previousHp;

      if (this.io) {
        this.io.to(this.roomId).emit('enemy-healed', {
          enemyId:    liveEnemy.id,
          healAmount: actualHeal,
          newHealth:  liveEnemy.health,
          maxHealth:  liveEnemy.maxHealth,
          timestamp:  Date.now()
        });
      }
      console.log(`🧵 Weaver ${weaver.id} healed ${liveEnemy.id} for ${actualHeal} HP (${previousHp} -> ${liveEnemy.health})`);
    }, 1800);
  }

  weaverCastSummon(weaver) {
    if (!this.room) return;

    // Ritual circle spawns 2–3 units in front/side of weaver
    const angle    = weaver.rotation + (Math.random() - 0.5) * (Math.PI / 3);
    const distance = 2.5 + Math.random() * 1.5;

    const ritualPosition = {
      x: weaver.position.x + Math.sin(angle) * distance,
      y: 0,
      z: weaver.position.z + Math.cos(angle) * distance,
    };

    // Broadcast summon animation telegraph — include ritual position so the
    // client can place the ritual circle immediately at cast start.
    if (this.io) {
      this.io.to(this.roomId).emit('weaver-summon-telegraph', {
        weaverId:       weaver.id,
        ritualPosition: { ...ritualPosition },
        timestamp:      Date.now()
      });
    }
    console.log(`🧵 Weaver ${weaver.id} beginning summon ritual…`);

    // After the cast animation (~3s), spawn the ghoul
    setTimeout(() => {
      if (weaver.isDying || !this.room?.getGameStarted()) return;

      const ghoulId = `ghoul-${weaver.id}-${Date.now()}`;

      const ghoul = {
        id:        ghoulId,
        type:      'ghoul',
        position:  { ...ritualPosition },
        rotation:  weaver.rotation,
        health:    500,
        maxHealth: 500,
        isDying:   false,
        damage:    30,
        attackCooldown: 2000,
        moveSpeed: 2.5,
        summonerId: weaver.id,
      };

      this.weaverSummonedGhouls.set(weaver.id, ghoulId);
      this.room.addEnemy(ghoul);

      if (this.io) {
        this.io.to(this.roomId).emit('weaver-ghoul-summoned', {
          weaverId:       weaver.id,
          ghoul,
          ritualPosition: { ...ritualPosition },
          timestamp:      Date.now()
        });
      }
      console.log(`🧵 Weaver ${weaver.id} summoned ghoul ${ghoulId} at ritual circle!`);
    }, 3000);
  }

  // ─── Ghoul AI ────────────────────────────────────────────────────────────────

  updateGhoulAI(ghoul, players) {
    let aggroData = this.enemyAggro.get(ghoul.id);
    if (!aggroData) {
      const closestPlayer = this.findClosestPlayer(ghoul, players);
      if (!closestPlayer) return;
      aggroData = { targetPlayerId: closestPlayer.id, lastUpdate: Date.now(), aggro: 100, isAggroed: true };
      this.enemyAggro.set(ghoul.id, aggroData);
    }

    let targetPlayer = players.find(p => p.id === aggroData.targetPlayerId);
    if (!targetPlayer || targetPlayer.health <= 0) {
      const newTarget = this.findClosestPlayer(ghoul, players);
      if (newTarget) {
        aggroData.targetPlayerId = newTarget.id;
        targetPlayer = newTarget;
      } else {
        return;
      }
    }

    const distance      = this.calculateDistance(ghoul.position, targetPlayer.position);
    const attackRange   = 2.4;
    const attackCooldown = ghoul.attackCooldown ?? 2000;

    if (distance <= attackRange) {
      if (!this.ghoulAttackCooldown.has(ghoul.id)) {
        this.ghoulAttackCooldown.set(ghoul.id, 0);
      }

      const lastAttackTime = this.ghoulAttackCooldown.get(ghoul.id);
      const now = Date.now();

      if (now - lastAttackTime >= attackCooldown) {
        this.ghoulAttackCooldown.set(ghoul.id, now);
        this.telegraphGhoulAttack(ghoul, targetPlayer);

        setTimeout(() => {
          if (ghoul.isDying || !this.room?.getGameStarted()) return;

          const currentPlayers = this.room?.getPlayers();
          if (!currentPlayers) return;

          const currentTarget = currentPlayers.find(p => p.id === targetPlayer.id);
          if (!currentTarget || currentTarget.health <= 0) return;

          const currentDistance = this.calculateDistance(ghoul.position, currentTarget.position);
          if (currentDistance <= attackRange) {
            this.ghoulAttackPlayer(ghoul, currentTarget);
          }
        }, 900);
      }
    } else {
      this.moveEnemyTowardsTarget(ghoul, targetPlayer);
    }
  }

  telegraphGhoulAttack(ghoul, player) {
    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-attack-telegraph', {
        ghoulId:       ghoul.id,
        targetPlayerId: player.id,
        position:       ghoul.position,
        timestamp:      Date.now()
      });
    }
    console.log(`💀 Ghoul ${ghoul.id} telegraphing attack at player ${player.id}!`);
  }

  ghoulAttackPlayer(ghoul, player) {
    const damage = ghoul.damage || 30;

    if (this.io) {
      this.io.to(this.roomId).emit('ghoul-attack', {
        ghoulId:       ghoul.id,
        targetPlayerId: player.id,
        damage,
        position: ghoul.position,
        timestamp: Date.now()
      });
    }
    console.log(`💀 Ghoul ${ghoul.id} attacked player ${player.id} for ${damage} damage!`);
  }

  // ─────────────────────────────────────────────────────────────────────────────

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
    const attackRange = 3.0; // Boss attack range
    const attackCooldown = 800; // 2 seconds between attacks

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

    const baseDamage = 47; // Boss deals 47 damage per hit

    // Check if the blade-enhanced buff is still active (from blink)
    const enhancedExpiry = this.bossBladeEnhanced.get(boss.id) || 0;
    const isEnhanced = Date.now() < enhancedExpiry;
    const damage = isEnhanced ? baseDamage * 2 : baseDamage;

    // Consume the buff on first attack (whether or not it was still active)
    if (this.bossBladeEnhanced.has(boss.id)) {
      this.bossBladeEnhanced.delete(boss.id);
    }

    // Broadcast boss attack to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-attack', {
        bossId: boss.id,
        targetPlayerId: player.id,
        damage: damage,
        position: boss.position,
        bladeEnhancedConsumed: true, // Signal clients to clear the glow
        timestamp: Date.now()
      });
    }

    if (isEnhanced) {
      console.log(`🔴🔥 Boss ${boss.id} EMPOWERED STRIKE! Attacked player ${player.id} for ${damage} damage (2x)!`);
    } else {
      console.log(`🔥 Boss ${boss.id} attacked player ${player.id} for ${damage} damage!`);
    }
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

    // Activate blade-enhanced state: next attack within 2.5s deals double damage
    const bladeEnhancedDuration = 2500;
    const blinkTime = Date.now();
    this.bossBladeEnhanced.set(boss.id, blinkTime + bladeEnhancedDuration);

    // Delay the boss's next attack by 1 second so players have time to react.
    // We do this by moving the last-attack timestamp forward by (1000 - attackCooldown),
    // which makes the cooldown check pass exactly 1000ms after the blink.
    const attackCooldown = 800;
    const telegraphDelay = 1000;
    this.bossAttackCooldown.set(boss.id, blinkTime + (telegraphDelay - attackCooldown));

    console.log(`🔴 Boss ${boss.id} blades enhanced after blink! Next attack deals double damage (${bladeEnhancedDuration}ms window, ${telegraphDelay}ms telegraph)`);

    // Broadcast teleport event to all players
    if (this.io) {
      this.io.to(this.roomId).emit('boss-teleport', {
        bossId: boss.id,
        startPosition: startPosition,
        endPosition: endPosition,
        rotation: boss.rotation,
        targetPlayerId: targetPlayer.id,
        bladesEnhanced: true,
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
      damage: 17,
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
    const baseSpeed = enemy.moveSpeed ?? this.getEnemyMoveSpeed(enemy.type);
    
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
      case 'elite': return 0.0;   // Stationary training dummies
      case 'boss': return 1.25;
      case 'boss-skeleton': return 1.75;
      case 'shade':   return 2.0;
      case 'warlock': return 0.0; // Stationary — moves only via blink
      case 'viper':   return 2.0;
      case 'templar': return 3.5;
      case 'weaver':  return 2.0;
      case 'ghoul':   return 2.5;
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
    this.bossBladeEnhanced.delete(enemyId);
    this.warlockBlinkCooldown.delete(enemyId);
    this.warlockLaunchCooldown.delete(enemyId);
    this.shadeBlinkCooldown.delete(enemyId);
    this.viperAttackCooldown.delete(enemyId);
    this.weaverHealCooldown.delete(enemyId);
    this.weaverSummonCooldown.delete(enemyId);
    this.weaverSummonedGhouls.delete(enemyId);
    this.ghoulAttackCooldown.delete(enemyId);

    // If a ghoul dies, clear it from its summoner's slot so the weaver can resummon
    this.weaverSummonedGhouls.forEach((ghoulId, weaverId) => {
      if (ghoulId === enemyId) {
        this.weaverSummonedGhouls.set(weaverId, null);
        console.log(`🧵 Weaver ${weaverId} ghoul ${enemyId} died — resummon available`);
      }
    });
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