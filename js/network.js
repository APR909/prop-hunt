// ============================================================
// REAL MULTIPLAYER NETWORK LAYER — Firebase Realtime Database
//
// Unlike billar-online's turn-based sync, prop-hunt is real-time:
// both players move simultaneously, so each client streams its own
// {x,y,angle,disguise} a few times a second and listens for the
// other side doing the same. Room/phase transitions use a shared
// timestamp (phaseStartedAt) instead of chatty tick messages, so
// both clients can compute the same countdown locally regardless
// of network latency.
//
//   createRoom() -> { code, role:"hider", floorPlan, name }
//   joinRoom(code) -> { code, role:"hunter", floorPlan, name }
//   listenRoom(code, callbacks) -> unsubscribe()
//   sendMyState(code, role, state)         // throttled by the caller
//   sendPhaseChange(code, phase, extra)
//   sendResult(code, result)
//   leaveRoom(code, role)
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  set,
  update,
  get,
  onValue,
  remove,
  onDisconnect,
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

let uidPromise = null;
function ensureSignedIn() {
  if (auth.currentUser) return Promise.resolve(auth.currentUser.uid);
  if (!uidPromise) {
    uidPromise = new Promise((resolve, reject) => {
      const unsub = onAuthStateChanged(
        auth,
        (user) => {
          if (user) {
            unsub();
            resolve(user.uid);
          }
        },
        reject
      );
      signInAnonymously(auth).catch(reject);
    });
  }
  return uidPromise;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no O/0/I/1 (ambiguous)

function randomCode(len = 5) {
  let c = "";
  for (let i = 0; i < len; i++) c += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return c;
}

function roomRef(code) {
  return ref(db, `prophunt_rooms/${code}`);
}

export async function createRoom(floorPlan, name = "Jugador 1") {
  await ensureSignedIn();
  const code = randomCode();

  await set(roomRef(code), {
    status: "waiting",
    floorPlan,
    phase: "hiding",
    phaseStartedAt: Date.now(),
    hiderName: name,
    hider: { x: 0, y: 0, angle: 0, disguise: null, connected: true },
    hunter: { connected: false },
    result: null,
    createdAt: Date.now(),
  });

  onDisconnect(ref(db, `prophunt_rooms/${code}/hider/connected`)).set(false);

  return { code, role: "hider", floorPlan, name };
}

export async function joinRoom(codeRaw, name = "Jugador 2") {
  await ensureSignedIn();
  const code = codeRaw.trim().toUpperCase();
  const snap = await get(roomRef(code));

  if (!snap.exists()) throw new Error("Esa sala no existe.");
  const room = snap.val();
  if (room.hunter?.connected) throw new Error("Esa sala ya está completa.");

  await update(roomRef(code), {
    status: "playing",
    hunterName: name,
    hunter: { x: 0, y: 0, angle: 0, connected: true },
  });
  onDisconnect(ref(db, `prophunt_rooms/${code}/hunter/connected`)).set(false);

  return { code, role: "hunter", floorPlan: room.floorPlan, name };
}

export function listenRoom(code, callbacks) {
  const unsub = onValue(roomRef(code), (snap) => {
    const room = snap.val();
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
  });
  return unsub;
}

export function sendMyState(code, role, state) {
  return update(ref(db, `prophunt_rooms/${code}/${role}`), state);
}

export function sendPhaseChange(code, phase, extra = {}) {
  return update(roomRef(code), { phase, phaseStartedAt: Date.now(), ...extra });
}

export function sendResult(code, result) {
  return update(roomRef(code), { phase: "ended", result });
}

export async function leaveRoom(code, role) {
  try {
    await update(ref(db, `prophunt_rooms/${code}/${role}`), { connected: false });
  } catch (e) {
    // room may already be gone — fine to ignore
  }
}
