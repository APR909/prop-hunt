// ============================================================
// ROOM — procedural floor plan: two separate room clusters,
// each its own grid of rooms, linked to each other by a pair of
// tube corridors crossing the gap between them.
// ============================================================
export const CANVAS_W = 1300;
export const CANVAS_H = 820;

export const WALL = 26; // outer wall thickness
const INNER_WALL = 14;  // interior partition thickness
const DOOR_SIZE = 78;   // doorway gap width (inside a cluster)
const DOOR_MARGIN = 32; // keep doorways away from room corners
const GAP_WIDTH = 130;  // void between the two clusters
const TUBE_HEIGHT = 92; // how tall each tube opening is

export const ROOM_LEFT = WALL;
export const ROOM_TOP = WALL;
export const ROOM_RIGHT = CANVAS_W - WALL;
export const ROOM_BOTTOM = CANVAS_H - WALL;

const CLUSTER_COLS = 2;
const CLUSTER_ROWS = 2;

function randomSplit(total, parts, minShare = 0.72) {
  const weights = Array.from({ length: parts }, () => 0.6 + Math.random());
  const sum = weights.reduce((a, b) => a + b, 0);
  const sizes = weights.map((w) => (w / sum) * total);
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

/** Generates one cluster's rooms/walls/doors within the given bounds.
 *  Room indices are offset by `indexOffset` so multiple clusters can
 *  share one continuous room-index space (needed for AI pathfinding). */
function generateCluster(bounds, cols, rows, indexOffset) {
  const colWidths = randomSplit(bounds.w, cols);
  const rowHeights = randomSplit(bounds.h, rows);

  const colX = [bounds.x];
  colWidths.forEach((w) => colX.push(colX[colX.length - 1] + w));
  const rowY = [bounds.y];
  rowHeights.forEach((h) => rowY.push(rowY[rowY.length - 1] + h));

  const rooms = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      rooms.push({ col: i, row: j, x: colX[i], y: rowY[j], w: colWidths[i], h: rowHeights[j] });
    }
  }
  const roomAt = (i, j) => rooms[j * cols + i];

  const walls = [];
  const doors = [];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const room = roomAt(i, j);
      const roomIdx = indexOffset + j * cols + i;

      if (i < cols - 1) {
        const wx = room.x + room.w - INNER_WALL / 2;
        const gap = randomGap(room.y, room.h, DOOR_SIZE, DOOR_MARGIN);
        walls.push({ x: wx, y: room.y, w: INNER_WALL, h: gap.start - room.y });
        walls.push({ x: wx, y: gap.end, w: INNER_WALL, h: room.y + room.h - gap.end });
        doors.push({ a: roomIdx, b: roomIdx + 1, x: wx + INNER_WALL / 2, y: (gap.start + gap.end) / 2 });
      }
      if (j < rows - 1) {
        const wy = room.y + room.h - INNER_WALL / 2;
        const gap = randomGap(room.x, room.w, DOOR_SIZE, DOOR_MARGIN);
        walls.push({ x: room.x, y: wy, w: gap.start - room.x, h: INNER_WALL });
        walls.push({ x: gap.end, y: wy, w: room.x + room.w - gap.end, h: INNER_WALL });
        doors.push({ a: roomIdx, b: roomIdx + cols, x: (gap.start + gap.end) / 2, y: wy + INNER_WALL / 2 });
      }
    }
  }

  return { rooms, walls, doors };
}

/** Generates a fresh floor plan: two clusters of rooms, connected by
 *  tube corridors. Returns rooms/walls/doors (same shape as before, so
 *  physics and AI pathfinding need no special-casing) plus `tubes` for
 *  rendering the pipe visuals. */
export function generateFloorPlan() {
  const clusterW = (CANVAS_W - 2 * WALL - GAP_WIDTH) / 2;
  const clusterH = CANVAS_H - 2 * WALL;

  const clusterA = generateCluster({ x: WALL, y: WALL, w: clusterW, h: clusterH }, CLUSTER_COLS, CLUSTER_ROWS, 0);
  const clusterB = generateCluster(
    { x: WALL + clusterW + GAP_WIDTH, y: WALL, w: clusterW, h: clusterH },
    CLUSTER_COLS,
    CLUSTER_ROWS,
    clusterA.rooms.length
  );

  const rooms = [...clusterA.rooms, ...clusterB.rooms];
  const walls = [...clusterA.walls, ...clusterB.walls];
  const doors = [...clusterA.doors, ...clusterB.doors];
  const tubes = [];

  const gapX = WALL + clusterW;
  const rightColOf = (cluster, indexOffset) =>
    cluster.rooms
      .map((r, i) => ({ r, idx: indexOffset + i }))
      .filter(({ r }) => r.col === CLUSTER_COLS - 1);
  const leftColOf = (cluster, indexOffset) =>
    cluster.rooms.map((r, i) => ({ r, idx: indexOffset + i })).filter(({ r }) => r.col === 0);

  const aRight = rightColOf(clusterA, 0);
  const bLeft = leftColOf(clusterB, clusterA.rooms.length);

  // one tube per row, so the two clusters have redundant connections
  for (let row = 0; row < CLUSTER_ROWS; row++) {
    const roomA = aRight.find(({ r }) => r.row === row);
    const roomB = bLeft.find(({ r }) => r.row === row);
    if (!roomA || !roomB) continue;

    const spanTop = Math.max(roomA.r.y, roomB.r.y) + 24;
    const spanBottom = Math.min(roomA.r.y + roomA.r.h, roomB.r.y + roomB.r.h) - 24;
    const centerY = (spanTop + spanBottom) / 2;
    const tubeTop = Math.max(spanTop, centerY - TUBE_HEIGHT / 2);
    const tubeBottom = Math.min(spanBottom, centerY + TUBE_HEIGHT / 2);

    tubes.push({ x: gapX, y: tubeTop, w: GAP_WIDTH, h: tubeBottom - tubeTop });
    doors.push({ a: roomA.idx, b: roomB.idx, x: gapX + GAP_WIDTH / 2, y: (tubeTop + tubeBottom) / 2 });
  }

  // fill the gap with solid wall, minus the tube openings
  let cursor = ROOM_TOP;
  const sortedTubes = [...tubes].sort((a, b) => a.y - b.y);
  sortedTubes.forEach((t) => {
    if (t.y > cursor) walls.push({ x: gapX, y: cursor, w: GAP_WIDTH, h: t.y - cursor });
    cursor = t.y + t.h;
  });
  if (cursor < ROOM_BOTTOM) walls.push({ x: gapX, y: cursor, w: GAP_WIDTH, h: ROOM_BOTTOM - cursor });

  return { rooms, walls, doors, tubes };
}

export function drawRoom(ctx, walls, tubes) {
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

  // cracked flagstone floor grid — replaces the plain wood-plank lines
  ctx.strokeStyle = "rgba(0,0,0,0.28)";
  ctx.lineWidth = 1;
  const tile = 46;
  for (let x = ROOM_LEFT + tile; x < ROOM_RIGHT; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, ROOM_TOP);
    ctx.lineTo(x, ROOM_BOTTOM);
    ctx.stroke();
  }
  for (let y = ROOM_TOP + tile; y < ROOM_BOTTOM; y += tile) {
    ctx.beginPath();
    ctx.moveTo(ROOM_LEFT, y);
    ctx.lineTo(ROOM_RIGHT, y);
    ctx.stroke();
  }

  // faint glowing ember seams at a handful of fixed tile intersections —
  // deterministic (not random) so the floor doesn't flicker frame to frame
  ctx.save();
  ctx.strokeStyle = "rgba(255,90,40,0.22)";
  ctx.lineWidth = 1.4;
  ctx.shadowColor = "rgba(255,90,40,0.5)";
  ctx.shadowBlur = 3;
  for (let gx = ROOM_LEFT + tile * 2; gx < ROOM_RIGHT; gx += tile * 5) {
    for (let gy = ROOM_TOP + tile * 3; gy < ROOM_BOTTOM; gy += tile * 4) {
      ctx.beginPath();
      ctx.moveTo(gx - 10, gy - 6);
      ctx.lineTo(gx + 4, gy + 3);
      ctx.lineTo(gx - 2, gy + 12);
      ctx.stroke();
    }
  }
  ctx.restore();

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

  // tubes — rusted metal pipe crossing the void between clusters
  (tubes || []).forEach((t) => drawTube(ctx, t));
}

function drawTube(ctx, t) {
  const grad = ctx.createLinearGradient(0, t.y, 0, t.y + t.h);
  grad.addColorStop(0, "#4a4038");
  grad.addColorStop(0.5, "#2a231d");
  grad.addColorStop(1, "#1a1512");
  ctx.fillStyle = grad;
  ctx.fillRect(t.x, t.y, t.w, t.h);

  // rim highlights (top/bottom edge of the pipe, cylindrical shading)
  ctx.fillStyle = "rgba(255,255,255,0.08)";
  ctx.fillRect(t.x, t.y, t.w, 3);
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(t.x, t.y + t.h - 3, t.w, 3);

  // pipe segment rings
  ctx.strokeStyle = "rgba(0,0,0,0.5)";
  ctx.lineWidth = 3;
  const ringGap = 34;
  for (let x = t.x + ringGap / 2; x < t.x + t.w; x += ringGap) {
    ctx.beginPath();
    ctx.moveTo(x, t.y);
    ctx.lineTo(x, t.y + t.h);
    ctx.stroke();
  }

  // ember rivets at each ring
  ctx.fillStyle = "rgba(255,90,40,0.55)";
  for (let x = t.x + ringGap / 2; x < t.x + t.w; x += ringGap) {
    ctx.beginPath();
    ctx.arc(x, t.y + 6, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, t.y + t.h - 6, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // end caps — a slightly darker rim where the tube meets each room
  ctx.strokeStyle = "rgba(228,40,60,0.4)";
  ctx.lineWidth = 3;
  ctx.strokeRect(t.x, t.y, t.w, t.h);
}

export function clampToRoom(x, y, r) {
  return {
    x: Math.min(ROOM_RIGHT - r, Math.max(ROOM_LEFT + r, x)),
    y: Math.min(ROOM_BOTTOM - r, Math.max(ROOM_TOP + r, y)),
  };
}
