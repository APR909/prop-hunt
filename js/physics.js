// ============================================================
// PHYSICS — player vs walls (clamp) and player vs static props
// (push the player out; props don't move).
// ============================================================
import { clampToRoom } from "./room.js";

export function resolveCollisions(player, props) {
  const clamped = clampToRoom(player.x, player.y, player.radius);
  player.x = clamped.x;
  player.y = clamped.y;

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

  const reclamped = clampToRoom(player.x, player.y, player.radius);
  player.x = reclamped.x;
  player.y = reclamped.y;
}
