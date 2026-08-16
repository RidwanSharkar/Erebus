const dns = require('dns').promises;

const SELF = process.env.FLY_MACHINE_ID || null;
const APP = process.env.FLY_APP_NAME || null;
const INTERNAL_PORT = Number(process.env.PORT) || 8080;

const MACHINE_IDS_TTL_MS = 10000;
const GLOBAL_ROOMS_TTL_MS = 1500;
const PEER_FETCH_MS = 2500;

let machineIdsCache = { at: 0, ids: [] };
let globalRoomsCache = { at: 0, key: '', rooms: null };

function isFly() {
  return !!(SELF && APP);
}

/** djb2 — stable across processes so two machines hash a new code to the same host. */
function stableHash(text) {
  let hash = 5381;
  const s = String(text);
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function parseVmsTxt(records) {
  const ids = [];
  for (const chunks of records) {
    const text = Array.isArray(chunks) ? chunks.join('') : String(chunks);
    for (const part of text.split(',')) {
      const id = part.trim().split(/\s+/)[0];
      if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

async function machineIds() {
  if (!isFly()) return [];
  const now = Date.now();
  if (now - machineIdsCache.at < MACHINE_IDS_TTL_MS && machineIdsCache.ids.length) {
    return machineIdsCache.ids;
  }
  try {
    const records = await dns.resolveTxt(`vms.${APP}.internal`);
    const ids = parseVmsTxt(records);
    if (SELF && !ids.includes(SELF)) ids.push(SELF);
    machineIdsCache = { at: now, ids };
    return ids;
  } catch (err) {
    console.warn('roomDirectory: failed to resolve vms.internal', err.message);
    const fallback = SELF ? [SELF] : [];
    machineIdsCache = { at: now, ids: fallback };
    return fallback;
  }
}

function tagLocalRooms(localRooms) {
  return localRooms.map((room) => ({ ...room, instance: SELF }));
}

async function fetchPeerRooms(machineId) {
  const url = `http://${machineId}.vm.${APP}.internal:${INTERNAL_PORT}/internal/local-rooms`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PEER_FETCH_MS) });
    if (!res.ok) return null;
    const data = await res.json();
    const rooms = Array.isArray(data?.rooms) ? data.rooms : [];
    const instance = data?.instance || machineId;
    return rooms.map((room) => ({ ...room, instance }));
  } catch (err) {
    console.warn(`roomDirectory: peer ${machineId} unreachable`, err.message);
    return null;
  }
}

function dedupeRooms(rooms) {
  const byId = new Map();
  for (const room of rooms) {
    const prev = byId.get(room.roomId);
    if (!prev || (room.playerCount || 0) > (prev.playerCount || 0)) {
      byId.set(room.roomId, room);
    }
  }
  return [...byId.values()];
}

/**
 * Merge this machine's rooms with peers over 6PN. Local-only when not on Fly.
 * `localRooms` should already be summaries (no GameRoom objects).
 */
async function globalRooms(localRooms) {
  const tagged = tagLocalRooms(localRooms);
  if (!isFly()) return tagged;

  const now = Date.now();
  const key = JSON.stringify(localRooms.map((r) => [r.roomId, r.playerCount]));
  if (
    globalRoomsCache.rooms
    && now - globalRoomsCache.at < GLOBAL_ROOMS_TTL_MS
    && globalRoomsCache.key === key
  ) {
    return globalRoomsCache.rooms;
  }

  const ids = await machineIds();
  const peerIds = ids.filter((id) => id !== SELF);
  const peerLists = await Promise.all(peerIds.map(fetchPeerRooms));
  const merged = [...tagged];
  for (const list of peerLists) {
    if (!list) continue;
    merged.push(...list);
  }
  const rooms = dedupeRooms(merged);
  globalRoomsCache = { at: now, key, rooms };
  return rooms;
}

/**
 * Machine that already hosts `code`, else a deterministic hash of the code
 * over the current machine list so two independent creates agree.
 */
async function resolveHost(code, rooms) {
  const matches = (rooms || []).filter((r) => r.roomId === code && r.instance);
  if (matches.length) {
    matches.sort((a, b) => (b.playerCount || 0) - (a.playerCount || 0));
    return matches[0].instance;
  }
  if (!isFly()) return null;
  const ids = await machineIds();
  const sorted = (ids.length ? ids : [SELF]).slice().sort();
  return sorted[stableHash(code) % sorted.length];
}

module.exports = {
  SELF,
  APP,
  isFly,
  machineIds,
  globalRooms,
  resolveHost,
};
