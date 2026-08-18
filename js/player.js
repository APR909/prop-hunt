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

  // small curved horns, swept back opposite the facing direction — a
  // lighter bone tone so they read clearly against dark floors
  const backAngle = angle + Math.PI;
  [-0.5, 0.5].forEach((side) => {
    const hornBaseX = hx + Math.cos(angle + side * 1.3) * radius * 0.32;
    const hornBaseY = hy + Math.sin(angle + side * 1.3) * radius * 0.32;
    const hornTipX = hornBaseX + Math.cos(backAngle + side * 0.5) * radius * 0.42;
    const hornTipY = hornBaseY + Math.sin(backAngle + side * 0.5) * radius * 0.42;
    ctx.beginPath();
    ctx.moveTo(hornBaseX, hornBaseY);
    ctx.lineTo(hornTipX, hornTipY);
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = "#c9b898";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(hornBaseX, hornBaseY);
    ctx.lineTo(hornTipX, hornTipY);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = "#241012";
    ctx.stroke();
  });

  ctx.fillStyle = headColor;
  ctx.beginPath();
  ctx.arc(hx, hy, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // glowing ember eyes
  ctx.save();
  ctx.shadowColor = "rgba(255,130,50,1)";
  ctx.shadowBlur = 5;
  ctx.fillStyle = "#ff6a28";
  const eyeOffset = radius * 0.16;
  const perpAngle = angle + Math.PI / 2;
  [-1, 1].forEach((side) => {
    const ex = hx + Math.cos(angle) * radius * 0.12 + Math.cos(perpAngle) * eyeOffset * side;
    const ey = hy + Math.sin(angle) * radius * 0.12 + Math.sin(perpAngle) * eyeOffset * side;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.1, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  ctx.restore();
}
