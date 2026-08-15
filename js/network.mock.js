// TEST-ONLY MOCK — simulates network.js's API using localStorage +
// storage events, so two tabs on the same machine can play against each
// other without touching real Firebase. Same exported function names/shapes
// as network.js, so main.js needs zero changes to swap between them.

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(len = 5) {
  let c = "";
  for (let i = 0; i < len; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

function key(code) {
  return `prophunt_room_${code}`;
}
function readRoom(code) {
  const raw = localStorage.getItem(key(code));
  return raw ? JSON.parse(raw) : null;
}
function writeRoom(code, data) {
  localStorage.setItem(key(code), JSON.stringify(data));
  window.dispatchEvent(new StorageEvent("storage", { key: key(code) }));
}

export async function createRoom(floorPlan, name = "Jugador 1") {
  const code = randomCode();
  writeRoom(code, {
    status: "waiting",
    floorPlan,
    phase: "hiding",
    phaseStartedAt: Date.now(),
    hiderName: name,
    hider: { x: 0, y: 0, angle: 0, disguise: null, connected: true },
    hunter: { connected: false },
    result: null,
  });
  return { code, role: "hider", floorPlan, name };
}

export async function joinRoom(codeRaw, name = "Jugador 2") {
  const code = codeRaw.trim().toUpperCase();
  const room = readRoom(code);
  if (!room) throw new Error("Esa sala no existe.");
  if (room.hunter?.connected) throw new Error("Esa sala ya está completa.");

  room.status = "playing";
  room.hunterName = name;
  room.hunter = { x: 0, y: 0, angle: 0, connected: true };
  writeRoom(code, room);

  return { code, role: "hunter", floorPlan: room.floorPlan, name };
}

export function listenRoom(code, callbacks) {
  const handler = () => {
    const room = readRoom(code);
    if (!room) return;
    callbacks.onStatus?.(room.status);
    callbacks.onNames?.({ hiderName: room.hiderName, hunterName: room.hunterName });
    callbacks.onPhase?.({
      phase: room.phase,
      phaseStartedAt: room.phaseStartedAt,
      hideDuration: room.hideDuration,
      huntDuration: room.huntDuration,
    });
    callbacks.onHider?.(room.hider);
    callbacks.onHunter?.(room.hunter);
    callbacks.onResult?.(room.result);
  };
  window.addEventListener("storage", handler);
  handler();
  return () => window.removeEventListener("storage", handler);
}

export function sendMyState(code, role, state) {
  const room = readRoom(code);
  if (!room) return;
  room[role] = { ...room[role], ...state };
  writeRoom(code, room);
}

export function sendPhaseChange(code, phase, extra = {}) {
  const room = readRoom(code);
  if (!room) return;
  Object.assign(room, { phase, phaseStartedAt: Date.now() }, extra);
  writeRoom(code, room);
}

export function sendResult(code, result) {
  const room = readRoom(code);
  if (!room) return;
  room.phase = "ended";
  room.result = result;
  writeRoom(code, room);
}

export async function leaveRoom(code, role) {
  const room = readRoom(code);
  if (!room) return;
  room[role] = { ...room[role], connected: false };
  writeRoom(code, room);
}
