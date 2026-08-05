// ============================================================
// PLAYER — top-down character: body circle + head offset toward
// facing direction, so rotation reads clearly at a glance.
// ============================================================
export const PLAYER_RADIUS = 16;
export const MOVE_SPEED = 220; // px/s

export function createPlayer(x, y) {
  return { x, y, angle: 0, radius: PLAYER_RADIUS, color: "#E4283C" };
}

export function drawPlayer(ctx, p) {
  const { x, y, angle, radius, color } = p;

  // soft ground shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, y + 3, radius * 0.9, radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#7a1020";
  ctx.lineWidth = 2;
  ctx.stroke();

  // head, offset toward facing direction
  const hx = x + Math.cos(angle) * radius * 0.55;
  const hy = y + Math.sin(angle) * radius * 0.55;
  ctx.fillStyle = "#F3EFEA";
  ctx.beginPath();
  ctx.arc(hx, hy, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
}
