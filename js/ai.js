// ============================================================
// AI HIDER — for single-player mode. Picks a room + prop to hide
// as, walks there through the doorway graph (real pathfinding, not
// a straight line, so it doesn't get stuck on walls), disguises,
// and — if the hunter gets close AND has their flashlight cone on
// it — reveals itself and bolts to a new spot elsewhere.
// ============================================================
import { PROP_TYPES } from "./props.js";
import { CONE_HALF_ANGLE } from "./fog.js";

const DETECTION_RANGE = 190; // must be within the cone AND closer than this to be "seen"
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

function pickHidingSpot(rooms, staticProps, avoidRoomIdx) {
  const roomIdxs = rooms.map((_, i) => i).filter((i) => i !== avoidRoomIdx);
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
  return null;
}

export function createAIHider(entity) {
  entity.disguise = null;
  entity.pendingDisguise = null;
  entity.state = "traveling"; // "traveling" | "disguised" | "fleeing"
  entity.path = [];
  entity.walkPhase = 0;
  entity.bobAmount = 0;
  return entity;
}

/** Call once at the start of the hiding phase. */
export function startHiding(ai, rooms, doors, staticProps) {
  const currentRoom = roomIndexAt(rooms, ai.x, ai.y);
  const spot = pickHidingSpot(rooms, staticProps, -1) || { roomIdx: currentRoom, prop: staticProps[0] };
  const roomPath = findRoomPath(rooms, doors, currentRoom, spot.roomIdx);
  ai.state = "traveling";
  ai.disguise = null;
  ai.path = [...roomPath, { x: spot.prop.x, y: spot.prop.y }];
  ai.pendingDisguise = spot.prop.type;
  ai.finalRadius = spot.prop.radius;
}

function isDetectedBy(ai, hunter) {
  const dx = ai.x - hunter.x;
  const dy = ai.y - hunter.y;
  const dist = Math.hypot(dx, dy);
  if (dist > DETECTION_RANGE) return false;
  const angleToAI = Math.atan2(dy, dx);
  let diff = Math.abs(angleToAI - hunter.angle);
  if (diff > Math.PI) diff = Math.PI * 2 - diff;
  return diff < CONE_HALF_ANGLE;
}

function startFleeing(ai, rooms, doors, staticProps, hunter) {
  const currentRoom = roomIndexAt(rooms, ai.x, ai.y);
  const hunterRoom = roomIndexAt(rooms, hunter.x, hunter.y);
  const spot = pickHidingSpot(rooms, staticProps, hunterRoom);
  if (!spot) return;

  ai.state = "fleeing";
  ai.disguise = null;
  const roomPath = findRoomPath(rooms, doors, currentRoom, spot.roomIdx);
  ai.path = [...roomPath, { x: spot.prop.x, y: spot.prop.y }];
  ai.pendingDisguise = spot.prop.type;
  ai.finalRadius = spot.prop.radius;
}

/** Advance the AI by one frame. Returns nothing — mutates `ai` in place. */
export function updateAI(ai, dt, { rooms, doors, staticProps, hunter, roundPhase, moveSpeed }) {
  if (roundPhase === "hunting" && ai.state !== "fleeing" && isDetectedBy(ai, hunter)) {
    startFleeing(ai, rooms, doors, staticProps, hunter);
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
    if (ai.state === "traveling" || ai.state === "fleeing") {
      ai.disguise = ai.pendingDisguise;
      ai.pendingDisguise = null;
      ai.state = "disguised";
    }
  }
}

export function aiEffectiveRadius(ai, fallbackRadius) {
  return ai.disguise ? PROP_TYPES[ai.disguise].radius : fallbackRadius;
}
