function handlePlayerEvents(socket, gameRooms) {
  // Handle player position and rotation updates
  socket.on('player-update', (data) => {
    const { roomId, position, rotation, weapon, health, movementDirection } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const playerId = socket.id;
    
    // Update player state
    if (position && rotation) {
      room.updatePlayerPosition(playerId, position, rotation, movementDirection);
    }
    
    if (weapon) {
      room.updatePlayerWeapon(playerId, weapon);
    }
    
    if (typeof health === 'number') {
      room.updatePlayerHealth(playerId, health);
    }
    
    // Broadcast updated position to other players in the room
    socket.to(roomId).emit('player-moved', {
      playerId,
      position,
      rotation,
      weapon,
      health,
      movementDirection
    });
  });

  // Handle weapon selection changes
  socket.on('weapon-changed', (data) => {
    const { roomId, weapon, subclass } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    room.updatePlayerWeapon(socket.id, weapon, subclass);
    
    // Broadcast weapon change to other players
    socket.to(roomId).emit('player-weapon-changed', {
      playerId: socket.id,
      weapon,
      subclass
    });
  });

  // Handle attack animations (visual only)
  socket.on('player-attack', (data) => {
    const { roomId, attackType, position, direction, animationData } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(socket.id);

    // Broadcast attack animation to other players with weapon info
    socket.to(roomId).emit('player-attacked', {
      playerId: socket.id,
      attackType,
      position,
      direction,
      weapon: player ? player.weapon : undefined,
      subclass: player ? player.subclass : undefined,
      animationData, // Include animation data (like projectile config with Cryoflame state)
      timestamp: Date.now()
    });
  });

  // Handle ability usage animations
  socket.on('player-ability', (data) => {
    const { roomId, abilityType, position, direction, target } = data;

    if (!gameRooms.has(roomId)) return;

    const gameRoom = gameRooms.get(roomId);

    // Special handling for Deathgrasp ability - apply taunt effect to nearby enemies
    if (abilityType === 'deathgrasp') {
      // Find enemies within range of the deathgrasp position
      const tauntRange = 15; // Range to taunt enemies
      const tauntDuration = 10000; // 10 seconds

      for (const [enemyId, enemy] of gameRoom.enemies) {
        // Only taunt boss enemies for now
        if (enemy.type === 'boss') {
          const distance = Math.sqrt(
            Math.pow(enemy.position.x - position.x, 2) +
            Math.pow(enemy.position.z - position.z, 2)
          );

          if (distance <= tauntRange) {
            // Apply taunt effect to this enemy
            gameRoom.enemyAI.tauntEnemy(enemyId, socket.id, tauntDuration);
            console.log(`🎯 Deathgrasp: Player ${socket.id} taunted boss ${enemyId} for ${tauntDuration/1000} seconds`);
          }
        }
      }
    }

    // Special handling for Wraith Strike ability - apply taunt effect to enemies hit
    if (abilityType === 'wraith_strike') {
      // Find enemies within melee range of the wraith strike position
      const tauntRange = 4.5; // Wraith strike melee range
      const tauntDuration = 10000; // 10 seconds

      for (const [enemyId, enemy] of gameRoom.enemies) {
        // Taunt ALL enemy types hit by Wraith Strike (boss, elite, normal)
        const distance = Math.sqrt(
          Math.pow(enemy.position.x - position.x, 2) +
          Math.pow(enemy.position.z - position.z, 2)
        );

        if (distance <= tauntRange) {
          // Apply taunt effect to this enemy
          gameRoom.enemyAI.tauntEnemy(enemyId, socket.id, tauntDuration);
          console.log(`👻 Wraith Strike: Player ${socket.id} taunted enemy ${enemyId} (${enemy.type}) for ${tauntDuration/1000} seconds`);
        }
      }
    }

    // Broadcast ability usage to other players
    socket.to(roomId).emit('player-used-ability', {
      playerId: socket.id,
      abilityType,
      position,
      direction,
      target,
      timestamp: Date.now()
    });
  });

  // Handle player animation state updates (for backstab, charging, swinging, etc.)
  socket.on('player-animation-state', (data) => {
    const { roomId, animationState } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    
    // Broadcast animation state to other players in the room
    socket.to(roomId).emit('player-animation-state', {
      playerId: socket.id,
      animationState,
      timestamp: Date.now()
    });
  });

  // Handle visual effect synchronization (new)
  socket.on('player-effect', (data) => {
    const { roomId, effect } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    // Broadcast effect to other players in the room
    socket.to(roomId).emit('player-effect', {
      playerId: socket.id,
      effect,
      timestamp: Date.now()
    });
  });

  // Handle player debuff synchronization (freeze, slow, etc.)
  socket.on('player-debuff', (data) => {
    const { roomId, targetPlayerId, debuffType, duration, effectData } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    // Broadcast debuff to all players in the room (including the target)
    const debuffData = {
      sourcePlayerId: socket.id,
      targetPlayerId,
      debuffType,
      duration,
      effectData,
      timestamp: Date.now()
    };

    // Send to all other clients in the room
    socket.to(roomId).emit('player-debuff', debuffData);
  });

  // Handle player stealth state changes
  socket.on('player-stealth', (data) => {
    const { roomId, playerId, isInvisible, isStealthing } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    const room = gameRooms.get(roomId);
    const player = room.players.get(socket.id);

    if (player) {
      // Update player's stealth state on server
      player.isInvisible = isInvisible;
      player.isStealthing = isStealthing || false;

      console.log(`👤 Player ${socket.id} stealth state: invisible=${isInvisible}, stealthing=${player.isStealthing}`);
    }

    // Broadcast stealth state to all other players in the room (including the sender for consistency)
    room.io.to(roomId).emit('player-stealth', {
      playerId: socket.id,
      isInvisible,
      isStealthing: player?.isStealthing || false,
      timestamp: Date.now()
    });
  });

  socket.on('player-knockback', (data) => {
    const { roomId, playerId, targetPlayerId, direction, distance, duration } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    const room = gameRooms.get(roomId);

    // Broadcast knockback to all other players in the room (including the sender for consistency)
    room.io.to(roomId).emit('player-knockback', {
      playerId: socket.id,
      targetPlayerId,
      direction,
      distance,
      duration,
      timestamp: Date.now()
    });
  });

  // Handle player tornado effect (WindShear ability)
  socket.on('player-tornado-effect', (data) => {
    const { roomId, playerId, position, duration } = data;

    if (!gameRooms.has(roomId)) {
      return;
    }

    const room = gameRooms.get(roomId);

    // Broadcast tornado effect to all other players in the room (including the sender for consistency)
    room.io.to(roomId).emit('player-tornado-effect', {
      playerId: socket.id,
      position,
      duration,
      timestamp: Date.now()
    });
  });

  // Handle player health changes
  socket.on('player-health-changed', (data) => {
    const { roomId, health, maxHealth } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    room.updatePlayerHealth(socket.id, health);

    // Broadcast health change to other players
    socket.to(roomId).emit('player-health-updated', {
      playerId: socket.id,
      health,
      maxHealth
    });
  });

  // Handle player shield changes
  socket.on('player-shield-changed', (data) => {
    const { roomId, shield, maxShield } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    room.updatePlayerShield(socket.id, shield, maxShield);

    // Broadcast shield change to other players
    socket.to(roomId).emit('player-shield-changed', {
      playerId: socket.id,
      shield,
      maxShield
    });
  });

  // Handle player level changes (for tertiary weapon unlocks)
  socket.on('player-level-changed', (data) => {
    const { roomId, playerId, level } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId);

    if (player) {
      player.level = level;

      // Broadcast level change to all players in the room (including the sender for consistency)
      room.io.to(roomId).emit('player-level-changed', {
        playerId,
        level,
        timestamp: Date.now()
      });
    }
  });

  // Handle ally healing (Reanimate & Oathstrike)
  socket.on('heal-allies', (data) => {
    const { roomId, healAmount, abilityType, position } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    
    // Heal all players in the room
    room.players.forEach((player, playerId) => {
      const newHealth = Math.min(player.maxHealth, player.health + healAmount);
      room.updatePlayerHealth(playerId, newHealth);
    });

    // Broadcast healing event to all players in the room (including the healer)
    room.io.to(roomId).emit('ally-healed', {
      healerId: socket.id,
      healAmount,
      abilityType,
      position,
      timestamp: Date.now()
    });
  });

  // Handle nearby ally healing (Reanimate with range check)
  socket.on('heal-nearby-allies', (data) => {
    const { roomId, healAmount, abilityType, position, radius } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const healerPlayer = room.getPlayer(socket.id);
    
    if (!healerPlayer) return;
    
    console.log(`🔍 DEBUG: Reanimate cast by ${socket.id} at position:`, position, `radius: ${radius}`);
    
    // Helper function to calculate distance between two positions
    const calculateDistance = (pos1, pos2) => {
      if (!pos2 || pos2.x === undefined || pos2.y === undefined || pos2.z === undefined) {
        console.log(`⚠️ WARNING: Invalid position for player:`, pos2);
        return Infinity; // Return infinite distance if position is invalid
      }
      const dx = pos1.x - pos2.x;
      const dy = pos1.y - pos2.y;
      const dz = pos1.z - pos2.z;
      return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };
    
    // Find all players within radius and heal them
    let healedPlayers = [];
    room.players.forEach((player, playerId) => {
      console.log(`🔍 DEBUG: Checking player ${playerId}, health: ${player.health}, position:`, player.position);
      
      // Skip dead players
      if (player.health <= 0) {
        console.log(`⚠️ Skipping dead player ${playerId}`);
        return;
      }
      
      // Skip if player has no position
      if (!player.position) {
        console.log(`⚠️ WARNING: Player ${playerId} has no position data!`);
        return;
      }
      
      // Calculate distance from healer position to this player
      const distance = calculateDistance(position, player.position);
      console.log(`📏 Distance from caster to player ${playerId}: ${distance.toFixed(2)} units (radius: ${radius})`);
      
      // Heal if within radius
      if (distance <= radius) {
        const previousHealth = player.health;
        const newHealth = Math.min(player.maxHealth, player.health + healAmount);
        room.updatePlayerHealth(playerId, newHealth);
        
        const actualHealingAmount = newHealth - previousHealth;
        
        console.log(`💚 Healing player ${playerId}: ${previousHealth} -> ${newHealth} (${actualHealingAmount} HP)`);
        
        // Only broadcast if actual healing occurred
        if (actualHealingAmount > 0) {
          healedPlayers.push({
            playerId: playerId,
            healAmount: actualHealingAmount,
            position: player.position
          });
          
          // Broadcast healing event to the healed player (and all others to show the visual)
          room.io.to(roomId).emit('player-healing', {
            sourcePlayerId: socket.id,
            targetPlayerId: playerId,
            healingAmount: actualHealingAmount,
            healingType: abilityType,
            position: {
              x: player.position.x,
              y: player.position.y + 1.5, // Position above player's head
              z: player.position.z
            },
            timestamp: Date.now()
          });
        }
      }
    });
    
    console.log(`💚 Player ${socket.id} healed ${healedPlayers.length} nearby allies with ${abilityType} (${healAmount} HP, ${radius} units radius)`);
  });

  // Handle player healing (for totems, etc.)
  socket.on('player-healing', (data) => {
    const { roomId, healingAmount, healingType, position, targetPlayerId } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const healerPlayer = room.getPlayer(socket.id);

    if (!healerPlayer) return;

    // Validate that the target player exists
    if (targetPlayerId) {
      const targetPlayer = room.getPlayer(targetPlayerId);
      if (!targetPlayer) return;

      // Apply healing to target player
      const previousHealth = targetPlayer.health;
      const newHealth = Math.min(targetPlayer.maxHealth, targetPlayer.health + healingAmount);
      const actualHealingAmount = newHealth - previousHealth;

      if (actualHealingAmount > 0) {
        room.updatePlayerHealth(targetPlayerId, newHealth);

        console.log(`💚 Player ${socket.id} healed ${targetPlayerId} for ${actualHealingAmount} HP (${healingType})`);

        // Broadcast healing event to all players in the room
        room.io.to(roomId).emit('player-healing', {
          sourcePlayerId: socket.id,
          targetPlayerId: targetPlayerId,
          healingAmount: actualHealingAmount,
          healingType: healingType,
          position: position,
          timestamp: Date.now()
        });
      }
    }
  });

  // Handle player death
  socket.on('player-died', (data) => {
    const { roomId } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const player = room.getPlayer(socket.id);

    room.updatePlayerHealth(socket.id, 0);

    // Remove dead player from all aggro charts (boss, skeletons, enemies)
    if (room.enemyAI) {
      room.enemyAI.removePlayerFromAllAggro(socket.id);
    }

    // Broadcast player death to other players
    socket.to(roomId).emit('player-died', {
      playerId: socket.id
    });
  });

  // Handle player respawn
  socket.on('player-respawned', (data) => {
    const { roomId, health, maxHealth, position } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const player = room.getPlayer(socket.id);
    const newHealth = health || maxHealth;
    
    room.updatePlayerHealth(socket.id, newHealth);
    
    if (position) {
      room.updatePlayerPosition(socket.id, position, { x: 0, y: 0, z: 0 });
    }

    // Broadcast player respawn to other players
    socket.to(roomId).emit('player-respawned', {
      playerId: socket.id,
      health: newHealth,
      maxHealth,
      position
    });
  });

  // Handle room preview request (get room info without joining)
  socket.on('preview-room', (data) => {
    const { roomId = 'default' } = data || {};
    
    if (!gameRooms.has(roomId)) {
      // Room doesn't exist yet
      socket.emit('room-preview', {
        roomId,
        exists: false,
        players: [],
        playerCount: 0,
        maxPlayers: 5,
        enemies: []
      });
      return;
    }
    
    const room = gameRooms.get(roomId);
    
    // Get room information without joining
    socket.emit('room-preview', {
      roomId,
      exists: true,
      players: room.getPlayers(),
      playerCount: room.getPlayerCount(),
      maxPlayers: 5,
      enemies: room.getEnemies()
    });
  });

  // Handle PVP damage between players
  socket.on('player-damage', (data) => {
    const { roomId, targetPlayerId, damage, damageType, isCritical } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const sourcePlayer = room.getPlayer(socket.id);
    const targetPlayer = room.getPlayer(targetPlayerId);
    
    if (!sourcePlayer || !targetPlayer) {
      return;
    }
    
    // Prevent damaging already dead players (health <= 0)
    if (targetPlayer.health <= 0) {
      return;
    }
    
    // Apply damage to target player
    const previousHealth = targetPlayer.health;
    targetPlayer.health = Math.max(0, targetPlayer.health - damage);
    
    // Simple kill detection: Player died if they had health > 0 before and health <= 0 after
    let wasActuallyKilled = previousHealth > 0 && targetPlayer.health <= 0;
    
    // Broadcast damage event to all players in the room
    room.io.to(roomId).emit('player-damaged', {
      sourcePlayerId: socket.id,
      targetPlayerId: targetPlayerId,
      damage: damage,
      damageType: damageType,
      isCritical: isCritical,
      newHealth: targetPlayer.health,
      maxHealth: targetPlayer.maxHealth,
      wasKilled: wasActuallyKilled,
      timestamp: Date.now()
    });
    
    // If player was killed, broadcast kill event for scoreboard tracking
    // NOTE: Experience is now awarded by a separate death confirmation system
    if (wasActuallyKilled) {
      room.io.to(roomId).emit('player-kill', {
        killerId: socket.id,
        victimId: targetPlayerId,
        killerName: sourcePlayer.name,
        victimName: targetPlayer.name,
        timestamp: Date.now()
      });

      // Mark player as requiring death confirmation for experience award
      // The actual experience will be awarded when death is confirmed by the death system

      // Store kill data for death confirmation system
      room.setPendingKill({
        killerId: socket.id,
        victimId: targetPlayerId,
        killerName: sourcePlayer.name,
        victimName: targetPlayer.name,
        damageType: damageType,
        timestamp: Date.now()
      });
    }
    
    // Also broadcast health update specifically
    room.io.to(roomId).emit('player-health-updated', {
      playerId: targetPlayerId,
      health: targetPlayer.health,
      maxHealth: targetPlayer.maxHealth
    });
  });

  // Handle PVP healing effects
  socket.on('player-healing', (data) => {
    const { roomId, healingAmount, healingType, position, targetPlayerId } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    
    // If targetPlayerId is specified, heal that player; otherwise heal the source player
    const playerToHeal = targetPlayerId || socket.id;
    const targetPlayer = room.getPlayer(playerToHeal);
    
    if (!targetPlayer) {
      return;
    }
    
    // Prevent healing dead players (health <= 0)
    if (targetPlayer.health <= 0) {
      return;
    }
    
    // Apply healing to the target player
    const previousHealth = targetPlayer.health;
    targetPlayer.health = Math.min(targetPlayer.maxHealth, targetPlayer.health + healingAmount);
    
    const actualHealingAmount = targetPlayer.health - previousHealth;

    // Only broadcast healing event if actual healing occurred
    if (actualHealingAmount > 0) {
      // Broadcast healing event to all players in the room (including source for confirmation)
      room.io.to(roomId).emit('player-healing', {
        sourcePlayerId: socket.id,
        targetPlayerId: playerToHeal,
        healingAmount: actualHealingAmount,
        healingType: healingType,
        position: position,
        timestamp: Date.now()
      });
    }
  });

  // Handle summoned unit damage in PVP (server-authoritative)
  socket.on('summoned-unit-damage', (data) => {
    const { roomId, unitId, unitOwnerId, damage, sourcePlayerId } = data;

    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const sourcePlayer = room.getPlayer(socket.id);
    
    if (!sourcePlayer) {
      return;
    }

    // Validate that the source player is not trying to damage their own units
    // Use socket.id as the authoritative source since that's who sent the request
    if (socket.id === unitOwnerId) {
      return;
    }
    
    // Apply damage server-side (authoritative)
    const damageApplied = room.damageSummonedUnitDirect(unitId, damage, sourcePlayerId);
    
    if (damageApplied) {
      // Broadcast summoned unit damage to all players in the room
      room.io.to(roomId).emit('summoned-unit-damaged', {
        unitId: unitId,
        unitOwnerId: unitOwnerId,
        sourcePlayerId: sourcePlayerId,
        damage: damage,
        timestamp: Date.now()
      });
    }
  });

  // Handle ping/latency measurement
  socket.on('ping', () => {
    socket.emit('pong', Date.now());
  });

  // TEMPORARY: Test wave completion (for debugging experience system)
  socket.on('test-wave-completion', (data) => {
    const { roomId } = data;

    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    room.triggerTestWaveCompletion();
  });

  // Handle player respawn confirmation for experience award
  socket.on('player-respawn', (data) => {
    const { roomId, playerId, position } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId || socket.id);
    
    if (!player) {
      return;
    }

    // Reset player health to max on respawn
    player.health = player.maxHealth;

    // Set respawn position (center of map if not provided)
    const respawnPosition = position || { x: 0, y: 0.5, z: 0 };
    player.position = respawnPosition;

    // Confirm death and award experience if there was a pending kill
    const confirmedKill = room.confirmPlayerDeath(playerId || socket.id);

    // Broadcast respawn to all players
    room.io.to(roomId).emit('player-respawned', {
      playerId: playerId || socket.id,
      playerName: player.name,
      health: player.health,
      maxHealth: player.maxHealth,
      position: respawnPosition,
      timestamp: Date.now()
    });
  });

  // Handle player death effect broadcasting
  socket.on('player-death-effect', (data) => {
    const { roomId, playerId, position, isStarting, timestamp } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);

    // Broadcast death effect to other players in the room
    socket.to(roomId).emit('player-death-effect', {
      playerId,
      position,
      isStarting,
      timestamp
    });
  });

  // Handle player essence changes
  socket.on('player-essence-changed', (data) => {
    const { roomId, playerId, essence } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId || socket.id);

    if (player) {
      // Add essence to current amount (initialize to 0 if undefined)
      const currentEssence = player.essence || 0;
      player.essence = currentEssence + essence;

      // Broadcast essence change to all players in the room (including the sender for consistency)
      room.io.to(roomId).emit('player-essence-changed', {
        playerId: playerId || socket.id,
        essence: player.essence,
        timestamp: Date.now()
      });
    }
  });

  socket.on('player-purchase', (data) => {
    const { roomId, playerId, itemId, cost, currency } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const player = room.getPlayer(playerId || socket.id);

    if (player) {
      // Initialize purchasedItems array if it doesn't exist
      if (!player.purchasedItems) {
        player.purchasedItems = [];
      }

      // Check if item is already purchased
      if (player.purchasedItems.includes(itemId)) {
        return; // Item already purchased
      }

      // Only handle essence currency
      if (currency !== 'essence') {
        return; // Invalid currency
      }

      // Check if player has enough essence
      if ((player.essence || 0) < cost) {
        return; // Not enough essence
      }

      // Deduct essence and add item
      player.essence = (player.essence || 0) - cost;
      player.purchasedItems.push(itemId);

      // Broadcast purchase to all players in the room
      room.io.to(roomId).emit('player-purchase', {
        playerId: playerId || socket.id,
        itemId,
        cost,
        currency,
        timestamp: Date.now()
      });

      // Also broadcast essence update
      room.io.to(roomId).emit('player-essence-changed', {
        playerId: playerId || socket.id,
        essence: player.essence,
        timestamp: Date.now()
      });
    }
  });
}

module.exports = { handlePlayerEvents };
