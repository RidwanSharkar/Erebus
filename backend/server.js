const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);

// CORS configuration for both Express and Socket.io
const getCorsOrigins = () => {
    const corsOriginsEnv = process.env.CORS_ORIGINS;
    if (corsOriginsEnv) {
        return corsOriginsEnv.split(',').map(origin => origin.trim());
    }

    // Fallback origins if env var not set - only allow frontend domains
    return process.env.NODE_ENV === 'production'
      ? ['https://empyrea.vercel.app', 'https://empyrea-ridwansharkar.vercel.app', 'https://empyrea-game-backend.fly.dev']
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'];
};

const corsOptions = {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    credentials: true
};

// Log incoming requests for debugging (dev only)
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${req.method} ${req.path} from ${req.get('origin') || 'no-origin'}`);
        next();
    });
}

app.use(cors(corsOptions));
app.use(express.json());

const io = socketIo(server, {
  cors: {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST'],
    credentials: true
  },
  transports: ['polling', 'websocket'],
  allowEIO3: true,
  pingTimeout: 20000,  // Reduced from 60000ms (60s) to 20000ms (20s)
  pingInterval: 10000,  // Reduced from 25000ms (25s) to 10000ms (10s)
  connectTimeout: 20000, // Reduced from 45000ms (45s) to 20000ms (20s)
  maxHttpBufferSize: 4 * 1024 * 1024
});

/** Default matches Next dev client `NEXT_PUBLIC_BACKEND_URL` fallback in MultiplayerContext. */
const PORT = process.env.PORT || 8080;
const { MAX_PLAYERS_PER_ROOM, EMPTY_ROOM_GRACE_MS, normalizeRoomId } = require('./roomConfig');
const roomDirectory = require('./roomDirectory');
const FLY_MACHINE_ID = roomDirectory.SELF;

if (FLY_MACHINE_ID) {
  const engineUpgrade = server.listeners('upgrade');
  server.removeAllListeners('upgrade');
  server.on('upgrade', (req, socket, head) => {
    let target = null;
    try {
      target = new URL(req.url, 'http://local').searchParams.get('fly_instance_id');
    } catch (_) {
      target = null;
    }
    if (target && target !== FLY_MACHINE_ID) {
      console.log(`fly-replay: ${FLY_MACHINE_ID} -> ${target} (${req.url})`);
      socket.end(`HTTP/1.1 101 Switching Protocols\r\nfly-replay: instance=${target}\r\n\r\n`);
      return;
    }
    for (const listener of engineUpgrade) {
      listener.call(server, req, socket, head);
    }
  });
}

// Game state management
const gameRooms = new Map();
const playerSockets = new Map();
const playerHeartbeats = new Map(); // Track last heartbeat for each player
const roomReclaimTimers = new Map(); // roomId -> timeout for empty-room grace window

// Import game modules
const GameRoom = require('./gameRoom');
const { handlePlayerEvents, clearPlayerHandlerState } = require('./playerHandler');
const { handleEnemyEvents } = require('./enemyHandler');

// Health check endpoint
app.get('/health', (req, res) => {
  const roomDetails = {};
  let totalPlayersInRooms = 0;
  
  for (const [roomId, room] of gameRooms) {
    const playerCount = room.getPlayerCount();
    roomDetails[roomId] = {
      players: playerCount,
      enemies: room.enemies.size
    };
    totalPlayersInRooms += playerCount;
  }
  
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    instance: FLY_MACHINE_ID,
    rooms: gameRooms.size,
    totalSockets: playerSockets.size,
    playersInRooms: totalPlayersInRooms,
    roomDetails
  });
});

function summarizeLocalRooms() {
  const rooms = [];
  for (const [id, room] of gameRooms) {
    if (room.getPlayerCount() === 0 && roomReclaimTimers.has(id)) continue;
    rooms.push({
      roomId: id,
      playerCount: room.getPlayerCount(),
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      gameStarted: room.getGameStarted(),
      gameMode: room.gameMode || 'coop',
      inThronePrep: typeof room.isInCoopThronePrep === 'function' ? room.isInCoopThronePrep() : false,
    });
  }
  return rooms;
}

app.get('/internal/local-rooms', (req, res) => {
  res.json({
    instance: FLY_MACHINE_ID,
    rooms: summarizeLocalRooms(),
  });
});

app.get('/room-host', async (req, res) => {
  try {
    const room = normalizeRoomId(req.query.room);
    const all = await roomDirectory.globalRooms(summarizeLocalRooms());
    const instance = await roomDirectory.resolveHost(room, all);
    const existing = all.find((entry) => entry.roomId === room);
    res.json({
      room,
      instance,
      exists: !!existing,
      playerCount: existing?.playerCount ?? 0,
    });
  } catch (err) {
    console.warn('room-host failed', err.message);
    res.status(500).json({ error: 'room-host failed' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Store socket reference and initialize heartbeat
  playerSockets.set(socket.id, socket);
  playerHeartbeats.set(socket.id, Date.now());
  socket.onAny(() => {
    playerHeartbeats.set(socket.id, Date.now());
  });

  // Handle room joining
  socket.on('join-room', (data) => {
    const { playerName = `Player${Math.floor(Math.random() * 1000)}`, weapon = 'scythe', subclass, gameMode = 'multiplayer', expectExisting = false } = data || {};
    const roomId = normalizeRoomId(data?.roomId);

    const targetRoom = gameRooms.get(roomId);
    if (expectExisting && !targetRoom) {
      socket.emit('room-not-found', { roomId });
      return;
    }

    const alreadyInTarget = !!(targetRoom && targetRoom.getPlayer(socket.id));
    if (targetRoom && !alreadyInTarget && targetRoom.getPlayerCount() >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('room-full');
      return;
    }

    if (alreadyInTarget) {
      socket.join(roomId);
      emitRoomJoined(socket, targetRoom, roomId, gameMode, { created: false });
      return;
    }

    // Remove from any previous GameRoom (Socket.io leave alone leaves a ghost player).
    detachPlayerFromRoom(socket.id, roomId);
    clearPlayerHandlerState(socket.id);

    // Leave any existing Socket.io rooms first
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    const { room, created } = getOrCreateRoom(roomId, gameMode);

    if (room.getPlayerCount() >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('room-full');
      return;
    }

    socket.join(roomId);
    room.addPlayer(socket.id, playerName, weapon, subclass, gameMode);

    console.log(`Player ${socket.id} joined room ${roomId} as ${playerName} with weapon ${weapon}${created ? ' (created)' : ''}`);

    emitRoomJoined(socket, room, roomId, gameMode, { created });

    socket.to(roomId).emit('player-joined', {
      playerId: socket.id,
      playerName,
      players: room.getPlayers()
    });
  });

  socket.on('list-rooms', async () => {
    try {
      const rooms = await roomDirectory.globalRooms(summarizeLocalRooms());
      socket.emit('rooms-list', { rooms });
    } catch (err) {
      console.warn('list-rooms failed', err.message);
      socket.emit('rooms-list', { rooms: summarizeLocalRooms().map((r) => ({ ...r, instance: FLY_MACHINE_ID })) });
    }
  });

  // Register player event handlers
  handlePlayerEvents(socket, gameRooms);
  
  // Register enemy event handlers
  handleEnemyEvents(socket, gameRooms);
  
  // Handle tower damage from players
  socket.on('tower-damage', (data) => {
    const { roomId, towerId, damage, sourcePlayerId, damageType } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const result = room.damageTower(towerId, damage, sourcePlayerId, damageType);

    if (result) {
      console.log(`🏰 Tower ${towerId} took ${damage} damage from player ${sourcePlayerId || socket.id} (${damageType || 'unknown'})`);
    }
  });

  // Handle pillar damage from players
  socket.on('pillar-damage', (data) => {
    const { roomId, pillarId, damage, sourcePlayerId } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    const result = room.damagePillar(pillarId, damage, sourcePlayerId);

    if (result) {
      console.log(`🏛️ Pillar ${pillarId} took ${damage} damage from player ${sourcePlayerId || socket.id}`);
    }
  });

  // Co-op destructible mushrooms (server-authoritative HP + eruption)
  socket.on('mushroom-damage', (data) => {
    const { roomId, index, damage, sourcePlayerId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.damageMushroom !== 'function') return;
    const pid = sourcePlayerId || socket.id;
    room.damageMushroom(index, damage, pid);
  });

  // Handle heartbeat from client
  socket.on('heartbeat', () => {
    playerHeartbeats.set(socket.id, Date.now());
  });

  // Handle start game event
  socket.on('start-game', (data) => {
    const { roomId } = data;
    console.log(`Player ${socket.id} requesting to start game in room ${roomId}`);
    
    if (!gameRooms.has(roomId)) {
      socket.emit('start-game-failed', { error: 'Room not found' });
      return;
    }
    
    const room = gameRooms.get(roomId);
    
    // Only allow starting if the player is in the room
    if (!room.getPlayer(socket.id)) {
      socket.emit('start-game-failed', { error: 'Player not in room' });
      return;
    }
    
    // Start the game
    const started = room.startGame(socket.id);
    
    if (started) {
      console.log(`🎮 Game started in room ${roomId} by player ${socket.id}`);
      socket.emit('start-game-success', { 
        roomId, 
        killCount: room.getKillCount(),
        timestamp: Date.now() 
      });
    } else {
      socket.emit('start-game-failed', { error: 'Game already started' });
    }
  });

  // Co-op: leave the throne prep room and start the main arena (enemies + AI)
  socket.on('enter-combat-arena', (data) => {
    const { roomId, chosenCampType } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;

    let ok = false;
    const camp = String(chosenCampType || '').toLowerCase();
    if (camp === 'dev_boss') {
      ok = room.activateDevBossArena();
    } else if (camp === 'dev_boss1_elite') {
      ok = room.activateDevBoss1EliteArena();
    } else if (camp === 'dev_boss2') {
      ok = room.activateDevBoss2Arena();
    } else if (camp === 'dev_boss3') {
      ok = room.activateDevBoss3Arena();
    } else if (/^dev_intro_[1-4]$/.test(camp)) {
      ok = room.activateDevIntroRoom(Number(camp.slice(-1)));
    } else if (/^dev_sunken_[1-4]$/.test(camp)) {
      ok = room.activateDevSunkenRoom(Number(camp.slice(-1)));
    } else if (/^dev_eternity_[1-5]$/.test(camp)) {
      ok = room.activateDevEternityRoom(Number(camp.slice(-1)));
    } else if (camp === 'dev_erebus_gate') {
      ok = room.activateDevErebusGate();
    } else if (camp === 'dev_delirium_gate') {
      ok = room.activateDevDeliriumGate();
    } else if (room.isInCoopThronePrep()) {
      ok = room.beginFaeRealmRoom(1);
    } else if (room.coopFaeRealmPortalOpen && room.coopFaeRealmActive) {
      if (room.coopFaeRealmRoomIndex === 3) {
        ok = room.beginIntroRoom(1);
      } else {
        ok = room.beginFaeRealmRoom(room.coopFaeRealmRoomIndex + 1);
      }
    } else if (room.coopEternityPortalOpen && room.coopEternityActive) {
      ok = room.beginEternityRoom(room.coopEternityRoomIndex + 1);
    } else if (room.coopEternityFountainPhase && room.coopEternityFountainUsed && room.coopEternityLootPhaseComplete) {
      ok = room.enterMainLoopAfterEternity(chosenCampType);
    } else if (room.coopSunkenPortalOpen && room.coopSunkenActive) {
      ok = room.beginSunkenRoom(room.coopSunkenRoomIndex + 1);
    } else if (room.coopSunkenFountainPhase && room.coopSunkenFountainUsed && room.coopSunkenLootPhaseComplete) {
      ok = room.enterMainLoopAfterSunken(chosenCampType);
    } else if (room.coopIntroPortalOpen && room.coopIntroActive) {
      ok = room.beginIntroRoom(room.coopIntroRoomIndex + 1);
    } else if (room.coopIntroFountainPhase && room.coopIntroFountainUsed && room.coopIntroAllyChoiceMade) {
      ok = room.enterFirstNormalRoomAfterIntro(chosenCampType);
    } else if (room.coopMainArenaPortalPhase) {
      ok = room.resolveMainArenaPortal(chosenCampType);
    } else {
      ok = room.activateCombatArena(chosenCampType);
    }
    if (ok) {
      socket.emit('enter-combat-arena-success', { roomId, timestamp: Date.now() });
    }
  });

  socket.on('coop-use-fountain', (data) => {
    const { roomId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.useCoopFountain !== 'function') return;

    const ok = room.useCoopFountain(socket.id);
    if (ok) {
      socket.emit('coop-use-fountain-success', { roomId, timestamp: Date.now() });
    }
  });

  socket.on('coop-choose-ally', (data) => {
    const { roomId, allyKind } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.chooseCoopAlly !== 'function') return;

    const ok = room.chooseCoopAlly(socket.id, allyKind);
    if (ok) {
      socket.emit('coop-choose-ally-success', { roomId, allyKind: room.coopAllyKind, timestamp: Date.now() });
    }
  });

  socket.on('coop-choose-sunken-loot', (data) => {
    const { roomId, stockId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.chooseSunkenTempleLoot !== 'function') return;

    const ok = room.chooseSunkenTempleLoot(socket.id, stockId);
    if (ok) {
      socket.emit('coop-choose-sunken-loot-success', { roomId, stockId, timestamp: Date.now() });
    }
  });

  socket.on('coop-choose-eternity-pet-upgrade', (data) => {
    const { roomId, upgradeId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.chooseEternityPetUpgrade !== 'function') return;

    const ok = room.chooseEternityPetUpgrade(socket.id, upgradeId);
    if (ok) {
      socket.emit('coop-choose-eternity-pet-upgrade-success', { roomId, upgradeId, timestamp: Date.now() });
    }
  });

  // Legacy no-op — Eternity III now uses pet upgrades instead of Architect loot.
  socket.on('coop-choose-eternity-loot', (data) => {
    const { roomId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    socket.emit('coop-eternity-pet-upgrade-failed', {
      reason: 'loot_replaced_by_pet_upgrade',
      timestamp: Date.now(),
    });
  });

  socket.on('coop-pre-boss-reward-claimed', (data) => {
    const { roomId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.claimPreBossReward !== 'function') return;

    room.claimPreBossReward(socket.id);
  });

  socket.on('coop-deep-sanctum-reward-claimed', (data) => {
    const { roomId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.claimDeepSanctumReward !== 'function') return;

    const ok = room.claimDeepSanctumReward(socket.id);
    if (ok) {
      socket.emit('coop-deep-sanctum-reward-claimed-success', { roomId, timestamp: Date.now() });
    }
  });

  socket.on('coop-pre-boss-merchant-finished', (data) => {
    const { roomId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.finishPreBossMerchant !== 'function') return;

    room.finishPreBossMerchant(socket.id);
  });

  socket.on('coop-combat-transition-ready', (data) => {
    const { roomId, transitionId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.markCoopCombatTransitionReady !== 'function') return;

    room.markCoopCombatTransitionReady(socket.id, transitionId);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const { roomId, message } = data;

    if (!gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);

    // Check if player is in the room
    if (!room.getPlayer(socket.id)) return;

    // Broadcast chat message to all players in the room
    socket.to(roomId).emit('chat-message', {
      message: message
    });

    console.log(`💬 Chat message from ${socket.id} in room ${roomId}: ${message.message}`);
  });

  // Handle manual disconnect (when user intentionally leaves)
  socket.on('leave-room', () => {
    console.log(`Player manually left: ${socket.id}`);
    cleanupPlayer(socket.id);
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`Player disconnected: ${socket.id}, reason: ${reason}`);
    cleanupPlayer(socket.id);
  });
});

/** Cancel a pending empty-room reclaim timer. */
function cancelRoomReclaim(roomId) {
  const timer = roomReclaimTimers.get(roomId);
  if (!timer) return;
  clearTimeout(timer);
  roomReclaimTimers.delete(roomId);
}

/** Keep an emptied room reserved under its code until the grace window expires. */
function scheduleRoomReclaim(roomId) {
  cancelRoomReclaim(roomId);
  const timer = setTimeout(() => {
    roomReclaimTimers.delete(roomId);
    const room = gameRooms.get(roomId);
    if (!room || room.getPlayerCount() > 0) return;
    console.log(`Cleaning up empty room after grace: ${roomId}`);
    room.destroy();
    gameRooms.delete(roomId);
  }, EMPTY_ROOM_GRACE_MS);
  roomReclaimTimers.set(roomId, timer);
}

/** Reuse the original GameRoom for this code, cancelling any pending reclaim. */
function getOrCreateRoom(roomId, gameMode) {
  cancelRoomReclaim(roomId);
  let created = false;
  if (!gameRooms.has(roomId)) {
    const newRoom = new GameRoom(roomId, io);
    newRoom.gameMode = gameMode;
    gameRooms.set(roomId, newRoom);
    created = true;
  }
  return { room: gameRooms.get(roomId), created };
}

function emitRoomJoined(socket, room, roomId, gameMode, extra = {}) {
  socket.emit('room-joined', {
    roomId,
    playerId: socket.id,
    players: room.getPlayers(),
    enemies: room.getEnemies(),
    killCount: room.getKillCount(),
    gameStarted: room.getGameStarted(),
    gameMode: room.gameMode || gameMode,
    instance: FLY_MACHINE_ID,
    created: !!extra.created,
    campTypes: room.getCampTypes(),
    combatArenaActive: room.gameMode !== 'coop' ? true : !!room.combatArenaActive,
    thronePortalOffer: room.getThronePortalOffer(),
    thronePortalLayout: room.getThronePortalLayout(),
    coopMainArenaPortalPhase: room.getCoopMainArenaPortalPhase(),
    coopBossThroneArena: room.getCoopBossThroneArena(),
    coopCombatTransitionId: typeof room.getCoopCombatTransitionId === 'function'
      ? room.getCoopCombatTransitionId()
      : null,
    coopThroneBossKind: typeof room.getCoopThroneBossKind === 'function' ? room.getCoopThroneBossKind() : null,
    coopTerrainTheme: typeof room.getCoopTerrainTheme === 'function' ? room.getCoopTerrainTheme() : null,
    coopCurrentRoomKind: typeof room.getCoopCurrentRoomKind === 'function' ? room.getCoopCurrentRoomKind() : null,
    coopClearedRoomKind: typeof room.getCoopClearedRoomKind === 'function' ? room.getCoopClearedRoomKind() : null,
    merchantInventory: typeof room.getMerchantInventory === 'function' ? room.getMerchantInventory() : [],
    mushroomState: typeof room.getMushroomState === 'function' ? room.getMushroomState() : null,
    goldDrops: typeof room.getGoldDrops === 'function' ? room.getGoldDrops() : [],
    lateJoinCombatLoadout: (() => {
      const p = room.getPlayer(socket.id);
      if (!p?.lateJoinCombatLoadout) return null;
      p.lateJoinCombatLoadout = false;
      return { weapon: p.weapon, subclass: p.subclass };
    })(),
    ...(typeof room._getDeepSanctumPayloadFields === 'function' ? room._getDeepSanctumPayloadFields() : {}),
    ...(typeof room._getEdenPayloadFields === 'function' ? room._getEdenPayloadFields() : {}),
    ...(typeof room._getCoopSkyPayloadFields === 'function' ? room._getCoopSkyPayloadFields() : {}),
    ...(typeof room._getCoopGrassPayloadFields === 'function' ? room._getCoopGrassPayloadFields() : {}),
  });

  if (typeof room.isInCoopThronePrep === 'function' && room.isInCoopThronePrep()) {
    socket.emit('coop-throne-sync', room.getCoopThroneSyncPayload());
  }
}

/** Remove a player from their GameRoom without dropping the socket. */
function detachPlayerFromRoom(playerId, keepRoomId) {
  for (const [roomId, room] of gameRooms) {
    if (room.getPlayer(playerId)) {
      room.removePlayer(playerId);

      const socket = playerSockets.get(playerId);
      if (socket) {
        socket.to(roomId).emit('player-left', {
          playerId,
          players: room.getPlayers()
        });
      }

      if (room.getPlayerCount() === 0 && roomId !== keepRoomId) {
        console.log(`Reserving empty room: ${roomId}`);
        scheduleRoomReclaim(roomId);
      }

      break;
    }
  }
}

// Player cleanup function
function cleanupPlayer(playerId) {
  console.log(`Cleaning up player: ${playerId}`);
  detachPlayerFromRoom(playerId);
  playerSockets.delete(playerId);
  playerHeartbeats.delete(playerId);
  clearPlayerHandlerState(playerId);
}

// Periodic cleanup of stale connections (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  const STALE_THRESHOLD = 60000; // 60 seconds without heartbeat = stale

  // console.log(`Running cleanup check. Active connections: ${playerSockets.size}`);

  for (const [playerId, lastHeartbeat] of playerHeartbeats) {
    if (now - lastHeartbeat > STALE_THRESHOLD) {
      console.log(`Cleaning up stale connection: ${playerId}, last heartbeat: ${Math.floor((now - lastHeartbeat) / 1000)}s ago`);
      const staleSocket = playerSockets.get(playerId);
      cleanupPlayer(playerId);
      // Forcibly disconnect the underlying socket so Engine.IO doesn't keep it alive
      if (staleSocket) staleSocket.disconnect(true);
    }
  }
}, 30000);

// Start server
server.listen(PORT, () => {
  console.log(`=== Server Starting ===`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Port: ${PORT}`);
  console.log(`Allowed CORS Origins:`, getCorsOrigins());
  console.log(`=====================`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`${signal} received, shutting down gracefully`);
  for (const timer of roomReclaimTimers.values()) {
    clearTimeout(timer);
  }
  roomReclaimTimers.clear();
  // Destroy all active rooms so their timers and AI loops are stopped
  for (const room of gameRooms.values()) {
    try { room.destroy(); } catch (_) {}
  }
  gameRooms.clear();
  io.close();
  server.close(() => {
    console.log('Process terminated');
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
