// ============================================================
// PHYSICS — player vs walls (clamp) and player vs static props
// (push the player out; props don't move).
// ============================================================
import { clampToRoom } from "./room.js";

function resolveWalls(entity, walls) {
  for (const w of walls) {
    const closestX = Math.max(w.x, Math.min(entity.x, w.x + w.w));
    const closestY = Math.max(w.y, Math.min(entity.y, w.y + w.h));
    const dx = entity.x - closestX;
    const dy = entity.y - closestY;
    const dist = Math.hypot(dx, dy);

    if (dist === 0) {
      // center is inside the rect (rare/edge case) — push out along the shallowest axis
      const pushLeft = entity.x - w.x;
      const pushRight = w.x + w.w - entity.x;
      const pushTop = entity.y - w.y;
      const pushBottom = w.y + w.h - entity.y;
      const min = Math.min(pushLeft, pushRight, pushTop, pushBottom);
      if (min === pushLeft) entity.x = w.x - entity.radius;
      else if (min === pushRight) entity.x = w.x + w.w + entity.radius;
      else if (min === pushTop) entity.y = w.y - entity.radius;
      else entity.y = w.y + w.h + entity.radius;
      continue;
    }

    if (dist < entity.radius) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = entity.radius - dist;
      entity.x += nx * overlap;
      entity.y += ny * overlap;
    }
  }
}

export function resolveCollisions(player, props, walls) {
  const clamped = clampToRoom(player.x, player.y, player.radius);
  player.x = clamped.x;
  player.y = clamped.y;

  resolveWalls(player, walls);

  for (const prop of props) {
    const dx = player.x - prop.x;
    const dy = player.y - prop.y;
    const dist = Math.hypot(dx, dy);
    const minDist = player.radius + prop.radius;
    if (dist === 0 || dist >= minDist) continue;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    player.x += nx * overlap;
    player.y += ny * overlap;
  }

  resolveWalls(player, walls);
  const reclamped = clampToRoom(player.x, player.y, player.radius);
  player.x = reclamped.x;
  player.y = reclamped.y;
}
