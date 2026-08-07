// ============================================================
// ROOM — procedural multi-room floor plan (grid of rooms
// connected by randomly-placed doorways) + rendering.
// ============================================================
export const CANVAS_W = 1300;
export const CANVAS_H = 820;

export const WALL = 26; // outer wall thickness
const INNER_WALL = 14;  // interior partition thickness
const DOOR_SIZE = 84;   // doorway gap width
const DOOR_MARGIN = 36; // keep doorways away from room corners

export const ROOM_LEFT = WALL;
export const ROOM_TOP = WALL;
export const ROOM_RIGHT = CANVAS_W - WALL;
export const ROOM_BOTTOM = CANVAS_H - WALL;

const GRID_COLS = 3;
const GRID_ROWS = 2;

function randomSplit(total, parts, minShare = 0.72) {
  // random positive weights, each clamped so no room ends up tiny
  const weights = Array.from({ length: parts }, () => 0.6 + Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  const sizes = weights.map((w) => (w / sum) * total);
  // enforce a minimum size relative to the even split, redistributing the rest
  const evenShare = total / parts;
  const minSize = evenShare * minShare;
  let deficit = 0;
  sizes.forEach((s, i) => {
    if (s < minSize) {
      deficit += minSize - s;
      sizes[i] = minSize;
    }
  });
  if (deficit > 0) {
    const donors = sizes.map((s, i) => (s > minSize ? i : -1)).filter((i) => i >= 0);
    donors.forEach((i) => (sizes[i] -= deficit / donors.length));
  }
  return sizes;
}

function randomGap(start, length, gapSize, margin) {
  const usable = length - 2 * margin - gapSize;
  const size = usable < 0 ? Math.max(20, length - 2 * margin) : gapSize;
  const offset = margin + (usable > 0 ? Math.random() * usable : 0);
  return { start: start + offset, end: start + offset + size };
}

/** Generates a fresh grid-of-rooms floor plan: room rectangles (inner,
 *  walkable bounds) plus the wall segments (with doorway gaps carved in). */
export function generateFloorPlan() {
  const totalW = ROOM_RIGHT - ROOM_LEFT;
  const totalH = ROOM_BOTTOM - ROOM_TOP;
  const colWidths = randomSplit(totalW, GRID_COLS);
  const rowHeights = randomSplit(totalH, GRID_ROWS);

  const colX = [ROOM_LEFT];
  colWidths.forEach((w) => colX.push(colX[colX.length - 1] + w));
  const rowY = [ROOM_TOP];
  rowHeights.forEach((h) => rowY.push(rowY[rowY.length - 1] + h));

  const rooms = [];
  for (let j = 0; j < GRID_ROWS; j++) {
    for (let i = 0; i < GRID_COLS; i++) {
      rooms.push({ col: i, row: j, x: colX[i], y: rowY[j], w: colWidths[i], h: rowHeights[j] });
    }
  }
  const roomAt = (i, j) => rooms[j * GRID_COLS + i];

  const walls = [];
  const doors = []; // { a, b, x, y } — room indices + the doorway gap's center point

  for (let j = 0; j < GRID_ROWS; j++) {
    for (let i = 0; i < GRID_COLS; i++) {
      const room = roomAt(i, j);
      const roomIdx = j * GRID_COLS + i;

      if (i < GRID_COLS - 1) {
        // shared wall with the room to the right
        const wx = room.x + room.w - INNER_WALL / 2;
        const gap = randomGap(room.y, room.h, DOOR_SIZE, DOOR_MARGIN);
        walls.push({ x: wx, y: room.y, w: INNER_WALL, h: gap.start - room.y });
        walls.push({ x: wx, y: gap.end, w: INNER_WALL, h: room.y + room.h - gap.end });
        doors.push({ a: roomIdx, b: roomIdx + 1, x: wx + INNER_WALL / 2, y: (gap.start + gap.end) / 2 });
      }
      if (j < GRID_ROWS - 1) {
        // shared wall with the room below
        const wy = room.y + room.h - INNER_WALL / 2;
        const gap = randomGap(room.x, room.w, DOOR_SIZE, DOOR_MARGIN);
        walls.push({ x: room.x, y: wy, w: gap.start - room.x, h: INNER_WALL });
        walls.push({ x: gap.end, y: wy, w: room.x + room.w - gap.end, h: INNER_WALL });
        doors.push({ a: roomIdx, b: roomIdx + GRID_COLS, x: (gap.start + gap.end) / 2, y: wy + INNER_WALL / 2 });
      }
    }
  }

  return { rooms, walls, doors };
}

export function drawRoom(ctx, walls) {
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
  for (const w of walls) {
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
