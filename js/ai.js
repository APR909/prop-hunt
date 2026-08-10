// ============================================================
// AI HIDER — for single-player mode. Picks a room + prop to hide
// as during the hide phase, and walks there through the doorway
// graph (real pathfinding, not a straight line, so it doesn't get
// stuck on walls).
//
// Once the hunter gets VERY close, the game turns into tag: the AI
// drops its disguise, and from that moment on just keeps running
// away from wherever the hunter currently is for the rest of the
// round — no more re-hiding, no more disguises.
// ============================================================
import { PROP_TYPES } from "./props.js";

const CLOSE_RANGE = 75; // pure proximity — how close the hunter must get to spook it into a permanent chase
const ARRIVE_TOL = 10;

function roomIndexAt(rooms, x, y) {
  for (let i = 0; i < rooms.length; i++) {
    const r = rooms[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return 0;
}

/** BFS over the room-adjacency graph (built from the door list) — returns
 *  the sequence of doorway center points to pass through to go from
 *  room `fromIdx` to room `toIdx`. */
function findRoomPath(rooms, doors, fromIdx, toIdx) {
  if (fromIdx === toIdx) return [];
  const adj = rooms.map(() => []);
  doors.forEach((d) => {
    adj[d.a].push({ to: d.b, x: d.x, y: d.y });
    adj[d.b].push({ to: d.a, x: d.x, y: d.y });
  });

  const visited = new Set([fromIdx]);
  const queue = [[fromIdx, []]];
  while (queue.length) {
    const [cur, path] = queue.shift();
    if (cur === toIdx) return path;
    for (const edge of adj[cur]) {
      if (!visited.has(edge.to)) {
        visited.add(edge.to);
        queue.push([edge.to, [...path, { x: edge.x, y: edge.y }]]);
      }
    }
  }
  return [];
}

function pickHidingSpot(rooms, staticProps, avoidRoomIdxs) {
  const avoid = Array.isArray(avoidRoomIdxs) ? avoidRoomIdxs : [avoidRoomIdxs];
  const roomIdxs = rooms.map((_, i) => i).filter((i) => !avoid.includes(i));
  const shuffled = roomIdxs.sort(() => Math.random() - 0.5);

  for (const roomIdx of shuffled) {
    const room = rooms[roomIdx];
    const inRoom = staticProps.filter(
      (p) => p.x >= room.x && p.x <= room.x + room.w && p.y >= room.y && p.y <= room.y + room.h
    );
    if (inRoom.length > 0) {
      const prop = inRoom[Math.floor(Math.random() * inRoom.length)];
      return { roomIdx, prop };
    }
  }
  if (staticProps.length > 0) {
    const prop = staticProps[Math.floor(Math.random() * staticProps.length)];
    const roomIdx = rooms.findIndex(
      (r) => prop.x >= r.x && prop.x <= r.x + r.w && prop.y >= r.y && prop.y <= r.y + r.h
    );
    return { roomIdx: roomIdx >= 0 ? roomIdx : 0, prop };
  }
  return null;
}

export function createAIHider(entity) {
  entity.disguise = null;
  entity.pendingDisguise = null;
  entity.state = "traveling"; // "traveling" | "disguised" | "chased"
  entity.path = [];
  entity.walkPhase = 0;
  entity.bobAmount = 0;
  return entity;
}

/** Call once at the start of the hiding phase. */
export function startHiding(ai, rooms, doors, staticProps) {
  const currentRoom = roomIndexAt(rooms, ai.x, ai.y);
  const spot = pickHidingSpot(rooms, staticProps, []) || { roomIdx: currentRoom, prop: staticProps[0] };
  const roomPath = findRoomPath(rooms, doors, currentRoom, spot.roomIdx);
  ai.state = "traveling";
  ai.disguise = null;
  ai.path = [...roomPath, { x: spot.prop.x, y: spot.prop.y }];
  ai.pendingDisguise = spot.prop.type;
  ai.finalRadius = spot.prop.radius;
}

function isVeryClose(ai, hunter) {
  return Math.hypot(ai.x - hunter.x, ai.y - hunter.y) < CLOSE_RANGE;
}

/** Advance the AI by one frame. Returns nothing — mutates `ai` in place. */
export function updateAI(ai, dt, { hunter, roundPhase, moveSpeed }) {
  if (roundPhase === "hunting" && ai.state !== "chased" && isVeryClose(ai, hunter)) {
    ai.state = "chased";
    ai.disguise = null;
    ai.path = [];
  }

  if (ai.state === "chased") {
    const dx = ai.x - hunter.x;
    const dy = ai.y - hunter.y;
    const dist = Math.hypot(dx, dy) || 1;
    ai.x += (dx / dist) * moveSpeed * dt;
    ai.y += (dy / dist) * moveSpeed * dt;
    ai.angle = Math.atan2(dy, dx);
    ai.walkPhase += dt * 12;
    ai.bobAmount += (1 - ai.bobAmount) * Math.min(1, dt * 10);
    return;
  }

  if (ai.path.length > 0) {
    const target = ai.path[0];
    const dx = target.x - ai.x;
    const dy = target.y - ai.y;
    const dist = Math.hypot(dx, dy);
    const isFinalLeg = ai.path.length === 1;
    const tol = isFinalLeg ? ai.finalRadius + ai.radius + 8 : ARRIVE_TOL;
    if (dist < tol) {
      ai.path.shift();
    } else {
      ai.x += (dx / dist) * moveSpeed * dt;
      ai.y += (dy / dist) * moveSpeed * dt;
      ai.angle = Math.atan2(dy, dx);
      ai.walkPhase += dt * 12;
    }
    ai.bobAmount += (1 - ai.bobAmount) * Math.min(1, dt * 10);
  } else {
    ai.bobAmount += (0 - ai.bobAmount) * Math.min(1, dt * 10);
    if (ai.state === "traveling") {
      ai.disguise = ai.pendingDisguise;
      ai.pendingDisguise = null;
      ai.state = "disguised";
    }
  }
}

export function aiEffectiveRadius(ai, fallbackRadius) {
  return ai.disguise ? PROP_TYPES[ai.disguise].radius : fallbackRadius;
}
