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
const {
  MAX_PLAYERS_PER_ROOM,
  EMPTY_ROOM_GRACE_MS,
  normalizeRoomId,
  isDefaultFamilyId,
  nextDefaultFallbackId,
} = require('./roomConfig');
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
    const playerCount = room.getPlayerCount();
    const occupancy = typeof room.getOccupancy === 'function' ? room.getOccupancy() : playerCount;
    const reserved = playerCount === 0;
    rooms.push({
      roomId: id,
      playerCount,
      occupancy,
      maxPlayers: MAX_PLAYERS_PER_ROOM,
      gameStarted: room.getGameStarted(),
      gameMode: room.gameMode || 'coop',
      inThronePrep: typeof room.isInCoopThronePrep === 'function' ? room.isInCoopThronePrep() : false,
      reserved,
    });
  }
  return rooms;
}

function isRoomUnavailableForDefaultFallback(entry) {
  const live = entry?.playerCount ?? 0;
  const occ = typeof entry?.occupancy === 'number' ? entry.occupancy : live;
  return live > 0 || occ >= MAX_PLAYERS_PER_ROOM;
}

async function allocateDefaultFallbackRoom(fromId) {
  const from = normalizeRoomId(fromId);
  const all = await roomDirectory.globalRooms(summarizeLocalRooms());
  const unavailable = new Set();
  for (const entry of all) {
    const id = normalizeRoomId(entry?.roomId);
    if (!isDefaultFamilyId(id)) continue;
    if (isRoomUnavailableForDefaultFallback(entry)) unavailable.add(id);
  }
  const roomId = nextDefaultFallbackId(from, unavailable);
  if (!roomId) return null;
  const existing = all.find((entry) => normalizeRoomId(entry?.roomId) === roomId);
  return { roomId, exists: !!existing };
}

async function emitRoomFull(socket, roomId) {
  const payload = { roomId };
  if (isDefaultFamilyId(roomId)) {
    try {
      const fallback = await allocateDefaultFallbackRoom(roomId);
      if (fallback?.roomId) payload.suggestedRoomId = fallback.roomId;
    } catch (err) {
      console.warn('default-fallback suggest failed', err.message);
    }
  }
  socket.emit('room-full', payload);
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

app.get('/default-fallback', async (req, res) => {
  try {
    const from = normalizeRoomId(req.query.from);
    const result = await allocateDefaultFallbackRoom(from);
    if (!result) {
      res.json({ roomId: null, exists: false });
      return;
    }
    res.json(result);
  } catch (err) {
    console.warn('default-fallback failed', err.message);
    res.status(500).json({ error: 'default-fallback failed' });
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
  socket.on('join-room', async (data) => {
    try {
    const { playerName = `Player${Math.floor(Math.random() * 1000)}`, weapon = 'scythe', subclass, gameMode = 'multiplayer', expectExisting = false } = data || {};
    const roomId = normalizeRoomId(data?.roomId);
    const sessionId = sanitizeSessionId(data?.sessionId);

    const targetRoom = gameRooms.get(roomId);
    if (expectExisting && !targetRoom) {
      socket.emit('room-not-found', { roomId });
      return;
    }

    const alreadyInTarget = !!(targetRoom && targetRoom.getPlayer(socket.id));
    const reclaiming = !!(targetRoom && sessionId && typeof targetRoom.peekReclaimable === 'function' && targetRoom.peekReclaimable(sessionId));
    const occupancy = targetRoom && typeof targetRoom.getOccupancy === 'function'
      ? targetRoom.getOccupancy()
      : (targetRoom ? targetRoom.getPlayerCount() : 0);
    if (targetRoom && !alreadyInTarget && !reclaiming && occupancy >= MAX_PLAYERS_PER_ROOM) {
      await emitRoomFull(socket, roomId);
      return;
    }

    if (alreadyInTarget) {
      socket.join(roomId);
      emitRoomJoined(socket, targetRoom, roomId, gameMode, { created: false, echo: true });
      return;
    }

    // Remove from any previous GameRoom (Socket.io leave alone leaves a ghost player).
    detachPlayerFromRoom(socket.id, roomId, { stash: false });
    clearPlayerHandlerState(socket.id);

    // Leave any existing Socket.io rooms first
    Array.from(socket.rooms).forEach(room => {
      if (room !== socket.id) {
        socket.leave(room);
      }
    });

    const { room, created } = getOrCreateRoom(roomId, gameMode);

    const occupancyAfter = typeof room.getOccupancy === 'function' ? room.getOccupancy() : room.getPlayerCount();
    const reclaimNow = !!(sessionId && typeof room.peekReclaimable === 'function' && room.peekReclaimable(sessionId));
    if (!reclaimNow && occupancyAfter >= MAX_PLAYERS_PER_ROOM) {
      await emitRoomFull(socket, roomId);
      return;
    }

    socket.join(roomId);
    let reclaimed = false;
    if (reclaimNow && typeof room.tryReclaimPlayer === 'function') {
      reclaimed = !!room.tryReclaimPlayer(sessionId, socket.id);
    }
    if (!reclaimed) {
      room.addPlayer(socket.id, playerName, weapon, subclass, gameMode, sessionId);
    }

    console.log(`Player ${socket.id} joined room ${roomId} as ${playerName} with weapon ${weapon}${created ? ' (created)' : ''}${reclaimed ? ' (reclaimed)' : ''}`);

    emitRoomJoined(socket, room, roomId, gameMode, { created, reclaimed });

    socket.to(roomId).emit('player-joined', {
      playerId: socket.id,
      playerName,
      players: room.getPlayers()
    });
    } catch (err) {
      console.warn('join-room failed', err.message);
    }
  });

  socket.on('list-rooms', async () => {
    try {
      const rooms = await roomDirectory.globalRooms(summarizeLocalRooms());
      socket.emit('rooms-list', { rooms: rooms.filter((r) => !r.reserved) });
    } catch (err) {
      console.warn('list-rooms failed', err.message);
      socket.emit('rooms-list', { rooms: summarizeLocalRooms().filter((r) => !r.reserved).map((r) => ({ ...r, instance: FLY_MACHINE_ID })) });
    }
  });

  socket.on('allocate-default-fallback', async (data) => {
    try {
      const from = normalizeRoomId(data?.from);
      const result = await allocateDefaultFallbackRoom(from);
      socket.emit('default-fallback', result || { roomId: null, exists: false });
    } catch (err) {
      console.warn('allocate-default-fallback failed', err.message);
      socket.emit('default-fallback', { roomId: null, exists: false });
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

  socket.on('tree-damage', (data) => {
    const { roomId, index, damage, sourcePlayerId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.damageTree !== 'function') return;
    const pid = sourcePlayerId || socket.id;
    room.damageTree(index, damage, pid);
  });

  socket.on('root-damage', (data) => {
    const { roomId, index, damage, sourcePlayerId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.damageRoot !== 'function') return;
    const pid = sourcePlayerId || socket.id;
    room.damageRoot(index, damage, pid);
  });

  socket.on('rock-damage', (data) => {
    const { roomId, index, damage, sourcePlayerId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.damageRock !== 'function') return;
    const pid = sourcePlayerId || socket.id;
    room.damageRock(index, damage, pid);
  });

  socket.on('spine-damage', (data) => {
    const { roomId, index, damage, sourcePlayerId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.damageSpine !== 'function') return;
    const pid = sourcePlayerId || socket.id;
    room.damageSpine(index, damage, pid);
  });

  socket.on('pickup-wood-drop', (data) => {
    const { roomId, dropId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.pickupWoodDrop !== 'function') return;
    room.pickupWoodDrop(dropId, socket.id);
  });

  socket.on('pickup-stone-drop', (data) => {
    const { roomId, dropId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.pickupStoneDrop !== 'function') return;
    room.pickupStoneDrop(dropId, socket.id);
  });

  socket.on('pickup-meat-drop', (data) => {
    const { roomId, dropId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.pickupMeatDrop !== 'function') return;
    room.pickupMeatDrop(dropId, socket.id);
  });

  socket.on('place-building', (data) => {
    const { roomId, kind, x, z } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.placeBuilding !== 'function') return;
    room.placeBuilding(socket.id, { kind, x, z });
  });

  socket.on('barracks-recruit-ally', (data) => {
    const { roomId, kind } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.barracksRecruitAlly !== 'function') return;
    room.barracksRecruitAlly(socket.id, { kind });
  });

  socket.on('research-purchase', (data) => {
    const { roomId, id } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.researchPurchase !== 'function') return;
    room.researchPurchase(socket.id, { id });
  });

  socket.on('shrine-claim', (data) => {
    const { roomId, gift } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.shrineClaim !== 'function') return;
    room.shrineClaim(socket.id, { gift });
  });

  socket.on('cathedral-claim', (data) => {
    const { roomId, itemType } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.cathedralClaim !== 'function') return;
    room.cathedralClaim(socket.id, { itemType });
  });

  socket.on('obelisk-buy-talent', (data) => {
    const { roomId, talentId } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.obeliskBuyTalent !== 'function') return;
    room.obeliskBuyTalent(socket.id, { talentId });
  });

  socket.on('fire-pit-heal', (data) => {
    const { roomId, action } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;
    const room = gameRooms.get(roomId);
    if (typeof room.firePitHeal !== 'function') return;
    room.firePitHeal(socket.id, { action });
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
    if (room.gamePaused || (room.gameStartTime > 0 && !room.getGameStarted())) {
      socket.emit('start-game-failed', { error: 'Game already started' });
      return;
    }

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

  // Co-op death retry / legacy clients: same full wipe as end-coop-game.
  socket.on('restart-coop-to-throne', (data, ack) => {
    const reply = (payload) => {
      if (typeof ack === 'function') ack(payload);
    };
    const roomId = normalizeRoomId(data?.roomId);
    if (!roomId || !gameRooms.has(roomId)) {
      reply({ ok: false, error: 'Room not found' });
      return;
    }

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) {
      reply({ ok: false, error: 'Player not in room' });
      return;
    }
    if (room.gameMode !== 'coop' || !room.getGameStarted()) {
      reply({ ok: false, error: 'Not a started co-op run' });
      return;
    }
    if (typeof room.restartCoopRunToThrone !== 'function') {
      reply({ ok: false, error: 'Restart unavailable' });
      return;
    }

    const restarted = room.restartCoopRunToThrone(socket.id);
    if (restarted) {
      console.log(`🔁 Co-op run restarted to throne in room ${roomId} by ${socket.id}`);
      reply({ ok: true, roomId });
    } else {
      reply({ ok: false, error: 'Restart failed' });
    }
  });

  // Settings END GAME: full pre-weapon throne reset (same room code).
  socket.on('end-coop-game', (data, ack) => {
    const reply = (payload) => {
      if (typeof ack === 'function') ack(payload);
    };
    const roomId = normalizeRoomId(data?.roomId);
    if (!roomId || !gameRooms.has(roomId)) {
      reply({ ok: false, error: 'Room not found' });
      return;
    }

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) {
      reply({ ok: false, error: 'Player not in room' });
      return;
    }
    if (room.gameMode !== 'coop' || !room.getGameStarted()) {
      reply({ ok: false, error: 'Not a started co-op run' });
      return;
    }
    if (typeof room.endCoopGameToThrone !== 'function') {
      reply({ ok: false, error: 'End game unavailable' });
      return;
    }

    const ended = room.endCoopGameToThrone(socket.id);
    if (ended) {
      console.log(`⏹ Co-op game ended to throne in room ${roomId} by ${socket.id}`);
      reply({ ok: true, roomId });
    } else {
      reply({ ok: false, error: 'End game failed' });
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
    } else if (camp === 'explore') {
      ok = room.isInCoopThronePrep() ? room.beginExploreRoom() : false;
    } else if (camp === 'defense') {
      ok = room.isInCoopThronePrep() ? room.beginDefenseRoom() : false;
    } else if (camp === 'dungeon') {
      ok = room.isInCoopThronePrep() ? room.beginDungeonRoom() : false;
    } else if (camp === 'sky_temple') {
      ok = room.isInCoopThronePrep() ? room.beginSkyTempleRoom() : false;
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

  socket.on('explore-camp-claim', (data) => {
    const { roomId, campId } = data || {};
    if (!roomId || !campId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.claimExploreCamp !== 'function') return;

    const ok = room.claimExploreCamp(socket.id, campId);
    if (ok) {
      socket.emit('explore-camp-claim-success', { roomId, campId, timestamp: Date.now() });
    }
  });

  socket.on('explore-fog-update', (data) => {
    const { roomId, exploreFogChunks } = data || {};
    if (!roomId || !gameRooms.has(roomId)) return;

    const room = gameRooms.get(roomId);
    if (!room.getPlayer(socket.id)) return;
    if (typeof room.mergeExploreFogChunks !== 'function') return;

    const merged = room.mergeExploreFogChunks(exploreFogChunks);
    if (merged.length > 0) {
      socket.to(roomId).emit('explore-fog-updated', {
        exploreFogChunks: merged,
        timestamp: Date.now(),
      });
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
    cleanupPlayer(socket.id, { stash: false });
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

function sanitizeSessionId(raw) {
  const normalized = String(raw ?? '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return normalized.length >= 8 ? normalized : null;
}

function emitRoomJoined(socket, room, roomId, gameMode, extra = {}) {
  const reclaimedPlayer = extra.reclaimed && typeof room.getPlayer === 'function'
    ? room.getPlayer(socket.id)
    : null;
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
    reclaimed: !!extra.reclaimed,
    echo: !!extra.echo,
    coopRoomEntryToken: typeof room.getCoopRoomEntryToken === 'function'
      ? room.getCoopRoomEntryToken()
      : 0,
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
    woodDrops: typeof room.getWoodDrops === 'function' ? room.getWoodDrops() : [],
    stoneDrops: typeof room.getStoneDrops === 'function' ? room.getStoneDrops() : [],
    meatDrops: typeof room.getMeatDrops === 'function' ? room.getMeatDrops() : [],
    lateJoinCombatLoadout: extra.reclaimed ? null : (() => {
      const p = room.getPlayer(socket.id);
      if (!p?.lateJoinCombatLoadout) return null;
      p.lateJoinCombatLoadout = false;
      return { weapon: p.weapon, subclass: p.subclass };
    })(),
    reclaimedPlayerState: extra.reclaimed && typeof room.serializeReclaimedPlayerState === 'function'
      ? room.serializeReclaimedPlayerState(reclaimedPlayer)
      : null,
    ...(typeof room.getCoopSessionSnapshotFields === 'function' ? room.getCoopSessionSnapshotFields() : {
      ...(typeof room._getDeepSanctumPayloadFields === 'function' ? room._getDeepSanctumPayloadFields() : {}),
      ...(typeof room._getEdenPayloadFields === 'function' ? room._getEdenPayloadFields() : {}),
      ...(typeof room._getCoopSkyPayloadFields === 'function' ? room._getCoopSkyPayloadFields() : {}),
      ...(typeof room._getCoopGrassPayloadFields === 'function' ? room._getCoopGrassPayloadFields() : {}),
    }),
  });

  if (typeof room.isInCoopThronePrep === 'function' && room.isInCoopThronePrep()) {
    socket.emit('coop-throne-sync', room.getCoopThroneSyncPayload());
  }
}

/** Remove a player from their GameRoom without dropping the socket. */
function detachPlayerFromRoom(playerId, keepRoomId, options = {}) {
  const shouldStash = options.stash !== false && !keepRoomId;
  for (const [roomId, room] of gameRooms) {
    if (room.getPlayer(playerId)) {
      const player = room.getPlayer(playerId);
      const stashSessionId = shouldStash ? (player?.sessionId || null) : null;
      room.removePlayer(playerId, { stashSessionId });

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
function cleanupPlayer(playerId, options = {}) {
  console.log(`Cleaning up player: ${playerId}`);
  detachPlayerFromRoom(playerId, undefined, { stash: options.stash !== false });
  playerSockets.delete(playerId);
  playerHeartbeats.delete(playerId);
  clearPlayerHandlerState(playerId);
}

// Periodic cleanup of stale connections (every 30 seconds)
setInterval(() => {
  const now = Date.now();
  // Well above Engine.IO pingTimeout (20s). Hidden tabs throttle setInterval heartbeats;
  // Engine.IO pings own liveness — only reap sockets that are already disconnected.
  const STALE_THRESHOLD = 120000;

  for (const [playerId, lastHeartbeat] of playerHeartbeats) {
    if (now - lastHeartbeat > STALE_THRESHOLD) {
      const staleSocket = playerSockets.get(playerId);
      if (staleSocket && staleSocket.connected) continue;
      console.log(`Cleaning up stale connection: ${playerId}, last heartbeat: ${Math.floor((now - lastHeartbeat) / 1000)}s ago`);
      cleanupPlayer(playerId);
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
