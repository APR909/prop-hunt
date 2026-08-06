// ============================================================
// ROOM — top-down floor plan geometry + rendering
// ============================================================
export const CANVAS_W = 1100;
export const CANVAS_H = 700;

export const WALL = 26; // wall thickness

export const ROOM_LEFT = WALL;
export const ROOM_TOP = WALL;
export const ROOM_RIGHT = CANVAS_W - WALL;
export const ROOM_BOTTOM = CANVAS_H - WALL;

// interior walls: partition (with a doorway gap) splitting off a side room,
// plus two short stub walls that carve out corner nooks.
export const INTERIOR_WALLS = [
  { x: 734, y: 26, w: 12, h: 254 },   // partition, above the doorway
  { x: 734, y: 420, w: 12, h: 254 },  // partition, below the doorway
  { x: 26, y: 500, w: 174, h: 12 },   // bottom-left nook stub
  { x: 900, y: 26, w: 12, h: 154 },   // top-right nook stub (in the side room)
];

export function drawRoom(ctx) {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // outer wall band
  ctx.fillStyle = "#0a0808";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // floor
  const floorGrad = ctx.createLinearGradient(0, ROOM_TOP, 0, ROOM_BOTTOM);
  floorGrad.addColorStop(0, "#221c17");
  floorGrad.addColorStop(1, "#181310");
  ctx.fillStyle = floorGrad;
  ctx.fillRect(ROOM_LEFT, ROOM_TOP, ROOM_RIGHT - ROOM_LEFT, ROOM_BOTTOM - ROOM_TOP);

  // floor plank lines for a little texture
  ctx.strokeStyle = "rgba(0,0,0,0.22)";
  ctx.lineWidth = 1;
  const plank = 46;
  for (let x = ROOM_LEFT + plank; x < ROOM_RIGHT; x += plank) {
    ctx.beginPath();
    ctx.moveTo(x, ROOM_TOP);
    ctx.lineTo(x, ROOM_BOTTOM);
    ctx.stroke();
  }

  // inner wall trim (subtle red accent, matches the site brand)
  ctx.strokeStyle = "rgba(228,40,60,0.35)";
  ctx.lineWidth = 3;
  ctx.strokeRect(ROOM_LEFT, ROOM_TOP, ROOM_RIGHT - ROOM_LEFT, ROOM_BOTTOM - ROOM_TOP);

  // outer wall edge
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 2;
  ctx.strokeRect(WALL / 2, WALL / 2, CANVAS_W - WALL, CANVAS_H - WALL);

  // interior walls — same material as the outer band, with a thin red edge
  for (const w of INTERIOR_WALLS) {
    ctx.fillStyle = "#0a0808";
    ctx.fillRect(w.x, w.y, w.w, w.h);
    ctx.strokeStyle = "rgba(228,40,60,0.3)";
    ctx.lineWidth = 2;
    ctx.strokeRect(w.x, w.y, w.w, w.h);
  }
}

export function clampToRoom(x, y, r) {
  return {
    x: Math.min(ROOM_RIGHT - r, Math.max(ROOM_LEFT + r, x)),
    y: Math.min(ROOM_BOTTOM - r, Math.max(ROOM_TOP + r, y)),
  };
}
