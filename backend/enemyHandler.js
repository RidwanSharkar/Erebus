function handleEnemyEvents(socket, gameRooms) {
  // Handle enemy damage from players
  socket.on('enemy-damage', (data) => {
    const { roomId, enemyId, damage, sourcePlayerId, damageType, infestedStrike, staggerToAdd, infestedSmite, infestedCombo, infernalSmite, infernoCrossentropy, reaperCrossentropy, wyvernBiteVenom } = data;

    console.log(`⚔️ Received enemy-damage: room=${roomId}, enemy=${enemyId}, damage=${damage}, source=${sourcePlayerId || socket.id}`);

    if (!gameRooms.has(roomId)) {
      console.log(`❌ Room ${roomId} not found`);
      return;
    }

    const room = gameRooms.get(roomId);
    // Use sourcePlayerId if provided, otherwise fall back to socket.id for direct player damage
    const actualSourcePlayerId = sourcePlayerId || socket.id;
    const player = room.players.get(actualSourcePlayerId);
    let hitMeta = null;
    if (damageType === 'wraith_strike' || infestedStrike) {
      hitMeta = { damageType: damageType || undefined, infestedStrike: !!infestedStrike };
      if (damageType === 'wraith_strike' && typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
    } else if (damageType === 'smite') {
      hitMeta = { damageType: 'smite', infestedSmite: !!infestedSmite, infernalSmite: !!infernalSmite };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
    } else if (damageType === 'crossentropy') {
      hitMeta = { damageType: 'crossentropy', infernoCrossentropy: !!infernoCrossentropy, reaperCrossentropy: !!reaperCrossentropy };
    } else if (damageType === 'ignite') {
      hitMeta = { damageType: 'ignite' };
    } else if (damageType === 'barrage') {
      hitMeta = { damageType: 'barrage', wyvernBiteVenom: !!wyvernBiteVenom };
    } else if (damageType === 'venom') {
      hitMeta = { damageType: 'venom' };
    } else if (damageType === 'runeblade_combo' || damageType === 'sabre_left' || damageType === 'sabre_right') {
      hitMeta = { damageType };
      if (damageType === 'runeblade_combo' && infestedCombo) {
        hitMeta.infestedCombo = true;
      }
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
    } else if (damageType === 'projectile' && typeof staggerToAdd === 'number' && staggerToAdd > 0) {
      hitMeta = { damageType: 'projectile', staggerToAdd };
    } else if (damageType === 'stagger_break') {
      hitMeta = { damageType: 'stagger_break' };
    } else if (damageType === 'blizzard') {
      hitMeta = { damageType: 'blizzard' };
    }
    room.damageEnemy(enemyId, damage, actualSourcePlayerId, player, hitMeta);
  });

  // Handle enemy position updates from AI
  socket.on('enemy-position-update', (data) => {
    const { roomId, enemyId, position, rotation } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const enemy = room.getEnemy(enemyId);
    
    if (enemy) {
      enemy.position = position;
      enemy.rotation = rotation;
      
      // Broadcast position update to all players
      room.io.to(roomId).emit('enemy-moved', {
        enemyId,
        position,
        rotation,
        timestamp: Date.now()
      });
    }
  });

  // Handle status effect applications
  socket.on('apply-status-effect', (data) => {
    const { roomId, enemyId, effectType, duration } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const success = room.applyStatusEffect(enemyId, effectType, duration);
    
    if (success) {
      // console.log(`🎯 Applied ${effectType} to enemy ${enemyId} for ${duration}ms by player ${socket.id}`);
    }
  });

  // Handle item pickup from player
  socket.on('pickup-item', (data) => {
    const { roomId, itemId } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    room.pickupItem(itemId, socket.id);
  });

  // Handle requests for enemy status effects
  socket.on('get-enemy-status', (data) => {
    const { roomId, enemyId } = data;
    
    if (!gameRooms.has(roomId)) return;
    
    const room = gameRooms.get(roomId);
    const effects = room.getEnemyStatusEffects(enemyId);
    
    socket.emit('enemy-status-response', {
      enemyId,
      effects,
      timestamp: Date.now()
    });
  });
}

// Utility function to broadcast enemy spawn to all players in a room
function broadcastEnemySpawn(io, roomId, enemyData) {
  io.to(roomId).emit('enemy-spawned', {
    enemy: enemyData,
    timestamp: Date.now()
  });
}

// Utility function to broadcast enemy death to all players in a room
function broadcastEnemyDeath(io, roomId, enemyId, killedBy) {
  io.to(roomId).emit('enemy-died', {
    enemyId,
    killedBy,
    timestamp: Date.now()
  });
}

module.exports = { 
  handleEnemyEvents, 
  broadcastEnemySpawn, 
  broadcastEnemyDeath 
};