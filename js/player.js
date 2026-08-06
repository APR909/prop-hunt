// ============================================================
// PLAYER — top-down character: body circle + head offset toward
// facing direction, so rotation reads clearly at a glance.
// ============================================================
export const PLAYER_RADIUS = 16;
export const MOVE_SPEED = 220; // px/s

export function createPlayer(x, y, color = "#E4283C") {
  return { x, y, angle: 0, radius: PLAYER_RADIUS, color };
}

export function drawPlayer(ctx, p, headColor = "#F3EFEA", bob = 0) {
  const { x, angle, radius, color } = p;
  const baseY = p.y;
  const hop = Math.abs(bob) * radius * 0.22;
  const squash = 1 - Math.abs(bob) * 0.12;
  const y = baseY - hop;

  // ground shadow — stays at floor level and widens slightly at the peak of the hop,
  // which is what sells the sense of height.
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(x, baseY + 3, radius * (0.9 + Math.abs(bob) * 0.12), radius * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, squash);
  ctx.translate(-x, -y);

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
  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(hx, hy, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}
