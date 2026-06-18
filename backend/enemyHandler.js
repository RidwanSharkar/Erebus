function handleEnemyEvents(socket, gameRooms) {
  // Handle enemy damage from players
  socket.on('enemy-damage', (data) => {
    const {
      roomId,
      enemyId,
      damage,
      sourcePlayerId,
      damageType,
      infestedStrike,
      staggerToAdd,
      infestedSmite,
      infestedCombo,
      infernalSmite,
      infernoCrossentropy,
      reaperCrossentropy,
      crossentropyPlague,
      crossentropyMeteor,
      wyvernBiteVenom,
      wyvernStingVenomZombie,
      wyvernBiteConcentratedDoT,
      infestedBackstab,
      sabreInfestingSwipes,
      infestedFlourish,
      killstreakBackstab,
      relentlessBackstab,
      arcticBlizzard,
      frostTotemChill,
      glacialBiteChill,
      glacialTalons,
      entanglementBarrage,
      rebukeRoom,
    } = data;

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
      hitMeta = {
        damageType: 'crossentropy',
        infernoCrossentropy: !!infernoCrossentropy,
        reaperCrossentropy: !!reaperCrossentropy,
        crossentropyPlague: !!crossentropyPlague,
        crossentropyMeteor: !!crossentropyMeteor,
      };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
    } else if (damageType === 'ignite') {
      hitMeta = { damageType: 'ignite' };
    } else if (damageType === 'rebuke') {
      hitMeta = { damageType: 'rebuke', rebukeRoom: !!rebukeRoom };
    } else if (damageType === 'reaping_talons') {
      hitMeta = { damageType: 'reaping_talons' };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
      if (glacialTalons) hitMeta.glacialTalons = true;
    } else if (damageType === 'barrage') {
      hitMeta = { damageType: 'barrage', wyvernBiteVenom: !!wyvernBiteVenom };
      if (glacialBiteChill) hitMeta.glacialBiteChill = true;
      if (entanglementBarrage) hitMeta.entanglementBarrage = true;
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
    } else if (damageType === 'venom') {
      hitMeta = {
        damageType: 'venom',
        wyvernStingVenomZombie: !!wyvernStingVenomZombie,
        wyvernBiteConcentratedDoT: !!wyvernBiteConcentratedDoT,
      };
    } else if (damageType === 'wyvern_talons_detonate') {
      hitMeta = { damageType: 'wyvern_talons_detonate' };
    } else if (damageType === 'backstab') {
      hitMeta = { damageType: 'backstab' };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
      if (infestedBackstab) hitMeta.infestedBackstab = true;
      if (killstreakBackstab) hitMeta.killstreakBackstab = true;
      if (relentlessBackstab) hitMeta.relentlessBackstab = true;
    } else if (damageType === 'runeblade_combo' || damageType === 'sabre_left' || damageType === 'sabre_right') {
      hitMeta = { damageType };
      if (damageType === 'runeblade_combo' && infestedCombo) {
        hitMeta.infestedCombo = true;
      }
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
      if ((damageType === 'sabre_left' || damageType === 'sabre_right') && sabreInfestingSwipes) {
        hitMeta.sabreInfestingSwipes = true;
      }
    } else if (damageType === 'sunder') {
      hitMeta = { damageType: 'sunder' };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
      if (infestedFlourish) hitMeta.infestedFlourish = true;
    } else if (damageType === 'fan_of_knives') {
      hitMeta = { damageType: 'fan_of_knives' };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
      if (infestedFlourish) hitMeta.infestedFlourish = true;
    } else if (damageType === 'projectile' && typeof staggerToAdd === 'number' && staggerToAdd > 0) {
      hitMeta = { damageType: 'projectile', staggerToAdd };
    } else if (damageType === 'stagger_break') {
      hitMeta = { damageType: 'stagger_break' };
    } else if (damageType === 'blizzard') {
      hitMeta = { damageType: 'blizzard', arcticBlizzard: !!arcticBlizzard };
    } else if (damageType === 'breath_weapon') {
      hitMeta = { damageType: 'breath_weapon' };
    } else if (damageType === 'entropic') {
      hitMeta = { damageType: 'entropic' };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
      if (data.entropicWrathful) hitMeta.entropicWrathful = true;
      if (data.entropicInfesting) hitMeta.entropicInfesting = true;
      if (frostTotemChill) hitMeta.frostTotemChill = true;
    } else if (damageType === 'icebeam') {
      hitMeta = { damageType: 'icebeam' };
      if (typeof staggerToAdd === 'number' && staggerToAdd > 0) {
        hitMeta.staggerToAdd = staggerToAdd;
      }
      if (data.icebeamWrathful) hitMeta.icebeamWrathful = true;
      if (data.icebeamInfested) hitMeta.icebeamInfested = true;
    }
    room.damageEnemy(enemyId, damage, actualSourcePlayerId, player, hitMeta);
  });

  socket.on('wyvern-talons-detonate-cv', (data) => {
    const { roomId, enemyId, cobraRemainingDamage } = data;
    if (!roomId || !enemyId) return;
    if (!gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    const fromPlayerId = socket.id;
    if (typeof room.detonateWyvernConcentratedVenom === 'function') {
      room.detonateWyvernConcentratedVenom(enemyId, fromPlayerId, cobraRemainingDamage);
    }
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
    const targetEnemy = room.getEnemy?.(enemyId);
    if (
      targetEnemy &&
      targetEnemy.alliedUnit === true &&
      ['freeze', 'stun', 'corrupted', 'entangle', 'ignite'].includes(effectType)
    ) {
      return;
    }
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

  socket.on('pickup-gold-drop', (data) => {
    const { roomId, dropId } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    room.pickupGoldDrop(dropId, socket.id);
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