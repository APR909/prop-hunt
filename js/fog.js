// ============================================================
// FOG OF WAR — hunter-only flashlight vision. A dark layer covers
// the whole scene; a soft-edged cone in the hunter's facing
// direction, plus a small radius around them, is "erased" from
// that layer so the game shows through underneath.
//
// This is a simple geometric cone — it doesn't check whether a
// wall is in the way, so at extreme angles you could technically
// see a sliver through a thin wall. Keeps this cheap; can be
// upgraded to real line-of-sight later if it turns out to matter.
// ============================================================

let fogCanvas = null;
let fogCtx = null;

function getFogLayer(w, h) {
  if (!fogCanvas) {
    fogCanvas = document.createElement("canvas");
    fogCanvas.width = w;
    fogCanvas.height = h;
    fogCtx = fogCanvas.getContext("2d");
  }
  return fogCtx;
}

const NEAR_RADIUS = 85;                // fully-visible radius around the hunter, every direction
const CONE_RADIUS = 300;               // how far the flashlight reaches
export const CONE_HALF_ANGLE = Math.PI / 6.2; // ~29° each side of facing direction (~58° total)

export function applyFogOfWar(mainCtx, hunter, w, h) {
  const ctx = getFogLayer(w, h);

  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(4,3,3,0.94)";
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "destination-out";

  // near-vision circle, soft edge
  const nearGrad = ctx.createRadialGradient(hunter.x, hunter.y, NEAR_RADIUS * 0.35, hunter.x, hunter.y, NEAR_RADIUS);
  nearGrad.addColorStop(0, "rgba(255,255,255,1)");
  nearGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = nearGrad;
  ctx.beginPath();
  ctx.arc(hunter.x, hunter.y, NEAR_RADIUS, 0, Math.PI * 2);
  ctx.fill();

  // flashlight cone, soft falloff at the far edge
  const coneGrad = ctx.createRadialGradient(hunter.x, hunter.y, NEAR_RADIUS * 0.3, hunter.x, hunter.y, CONE_RADIUS);
  coneGrad.addColorStop(0, "rgba(255,255,255,1)");
  coneGrad.addColorStop(0.7, "rgba(255,255,255,0.9)");
  coneGrad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(hunter.x, hunter.y);
  ctx.arc(hunter.x, hunter.y, CONE_RADIUS, hunter.angle - CONE_HALF_ANGLE, hunter.angle + CONE_HALF_ANGLE);
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = "source-over";

  mainCtx.drawImage(ctx.canvas, 0, 0);
}
