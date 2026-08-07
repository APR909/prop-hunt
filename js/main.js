import { CANVAS_W, CANVAS_H, drawRoom, generateFloorPlan } from "./room.js";
import { drawProp, scatterProps, PROP_TYPES } from "./props.js";
import { createPlayer, drawPlayer, MOVE_SPEED } from "./player.js";
import { createKeyboard } from "./input.js";
import { resolveCollisions } from "./physics.js";

const canvas = document.getElementById("scene");
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext("2d");

const disguiseStatusEl = document.getElementById("disguiseStatus");
const disguiseHintEl = document.getElementById("disguiseHint");
const modeToggleBtn = document.getElementById("modeToggle");

const DISGUISE_RANGE = 46; // extra reach beyond the two radii touching
const CHECK_RANGE = 50;    // how close the hunter must be to inspect an object

const keyboard = createKeyboard();

function newFloorPlan() {
  const plan = generateFloorPlan();
  const scattered = scatterProps(plan.rooms);
  return { ...plan, props: scattered };
}

let floorPlan = newFloorPlan();
let props = floorPlan.props;

function roomCenter(room) {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

const hiderStart = roomCenter(floorPlan.rooms[0]);
const hunterStart = roomCenter(floorPlan.rooms[floorPlan.rooms.length - 1]);

const hider = createPlayer(hiderStart.x, hiderStart.y, "#E4283C");
hider.disguise = null; // null = normal form, or a PROP_TYPES key
hider.walkPhase = 0;
hider.bobAmount = 0;

const hunter = createPlayer(hunterStart.x, hunterStart.y, "#F3EFEA");
hunter.walkPhase = 0;
hunter.bobAmount = 0;

let mode = "hider"; // "hider" | "hunter"
let feedback = null; // { text, x, y, until, color }
let transformFX = null; // { x, y, start, duration } — brief "pop" when disguising/undisguising

function triggerTransformFX(x, y) {
  transformFX = { x, y, start: performance.now(), duration: 260 };
}


function nearestFor(entity, range) {
  let best = null;
  let bestDist = Infinity;
  for (const p of props) {
    const dist = Math.hypot(entity.x - p.x, entity.y - p.y) - p.radius - entity.radius;
    if (dist < range && dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  return best;
}

function switchToHunter() {
  if (hider.disguise) {
    props.push({
      type: hider.disguise,
      x: hider.x,
      y: hider.y,
      angle: hider.angle,
      radius: PROP_TYPES[hider.disguise].radius,
      isHiddenPlayer: true,
    });
  }
  const start = roomCenter(floorPlan.rooms[floorPlan.rooms.length - 1]);
  hunter.x = start.x;
  hunter.y = start.y;
  hunter.angle = 0;
  mode = "hunter";
  feedback = null;
}

function switchToHider() {
  floorPlan = newFloorPlan(); // fresh layout + props each round
  props = floorPlan.props;
  const start = roomCenter(floorPlan.rooms[0]);
  hider.x = start.x;
  hider.y = start.y;
  hider.disguise = null;
  mode = "hider";
  feedback = null;
}

modeToggleBtn.addEventListener("click", () => {
  if (mode === "hider") switchToHunter();
  else switchToHider();
});

window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();

  if (key === "tab") {
    e.preventDefault();
    if (mode === "hider") switchToHunter();
    else switchToHider();
    return;
  }

  if (mode === "hider" && key === "e") {
    if (hider.disguise) {
      hider.disguise = null;
      triggerTransformFX(hider.x, hider.y);
    } else {
      const target = nearestFor(hider, DISGUISE_RANGE);
      if (target) {
        hider.disguise = target.type;
        triggerTransformFX(hider.x, hider.y);
      }
    }
  }

  if (mode === "hunter" && key === " ") {
    e.preventDefault();
    const target = nearestFor(hunter, CHECK_RANGE);
    if (!target) return;
    if (target.isHiddenPlayer) {
      feedback = { text: "¡encontrado!", x: target.x, y: target.y - 40, until: performance.now() + 2200, color: "#FF4D67" };
    } else {
      feedback = { text: "nada por aquí…", x: target.x, y: target.y - 40, until: performance.now() + 900, color: "#A9A29D" };
    }
  }
});

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  const active = mode === "hider" ? hider : hunter;
  const { dx, dy } = keyboard.getMoveVector();
  const isMoving = dx !== 0 || dy !== 0;
  if (isMoving) {
    active.x += dx * MOVE_SPEED * dt;
    active.y += dy * MOVE_SPEED * dt;
    active.angle = Math.atan2(dy, dx);
    active.walkPhase += dt * 12;
  }
  active.bobAmount += ((isMoving ? 1 : 0) - active.bobAmount) * Math.min(1, dt * 10);
  resolveCollisions(active, props, floorPlan.walls);

  drawRoom(ctx, floorPlan.walls);

  let near = null;
  if (mode === "hider" && !hider.disguise) {
    near = nearestFor(hider, DISGUISE_RANGE);
    if (near) drawHighlight(near, "rgba(228,40,60,0.85)");
  } else if (mode === "hunter") {
    near = nearestFor(hunter, CHECK_RANGE);
    if (near) drawHighlight(near, "rgba(243,239,234,0.55)");
  }

  const bob = Math.sin(active.walkPhase) * active.bobAmount;

  const hiderDraw = hider.disguise
    ? () => PROP_TYPES[hider.disguise].draw(ctx, hider.x, hider.y, hider.angle)
    : () => drawPlayer(ctx, hider, "#F3EFEA", mode === "hider" ? bob : 0);

  const drawables = props.map((p) => ({ y: p.y, draw: () => drawProp(ctx, p) }));
  if (mode === "hider") {
    drawables.push({ y: hider.y, draw: () => withTransformPop(hider.x, hider.y, hiderDraw) });
  } else {
    drawables.push({ y: hunter.y, draw: () => drawPlayer(ctx, hunter, "#E4283C", bob) });
  }
  drawables.sort((a, b) => a.y - b.y);
  drawables.forEach((d) => d.draw());

  if (feedback && performance.now() < feedback.until) {
    ctx.save();
    ctx.font = "600 20px 'Work Sans', sans-serif";
    ctx.fillStyle = feedback.color;
    ctx.textAlign = "center";
    ctx.fillText(feedback.text, feedback.x, feedback.y);
    ctx.restore();
  }

  updateHud(near);

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function withTransformPop(x, y, drawFn) {
  if (!transformFX || performance.now() - transformFX.start >= transformFX.duration) {
    drawFn();
    return;
  }

  const t = (performance.now() - transformFX.start) / transformFX.duration;
  let scale;
  if (t < 0.35) scale = 1 - 0.85 * (t / 0.35);
  else if (t < 0.7) scale = 0.15 + 1.1 * ((t - 0.35) / 0.35);
  else scale = 1.25 - 0.25 * ((t - 0.7) / 0.3);

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.translate(-x, -y);
  drawFn();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = `rgba(255,255,255,${(1 - t) * 0.6})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 10 + t * 38, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawHighlight(prop, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.arc(prop.x, prop.y, prop.radius + 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function updateHud(near) {
  modeToggleBtn.textContent = mode === "hider" ? "Pasar a cazador (Tab)" : "Pasar a escondido (Tab)";

  if (mode === "hider") {
    if (hider.disguise) {
      disguiseStatusEl.textContent = `disfrazado de ${PROP_TYPES[hider.disguise].label}`;
      disguiseStatusEl.className = "hud-value disguise-active";
      disguiseHintEl.textContent = "pulsa E para volver a tu forma";
    } else {
      disguiseStatusEl.textContent = "sin disfraz";
      disguiseStatusEl.className = "hud-value";
      disguiseHintEl.textContent = near
        ? `pulsa E para disfrazarte de ${PROP_TYPES[near.type].label}`
        : "acércate a un objeto para disfrazarte";
    }
  } else {
    disguiseStatusEl.textContent = "modo cazador";
    disguiseStatusEl.className = "hud-value disguise-active";
    disguiseHintEl.textContent = near ? "pulsa espacio para inspeccionar" : "busca entre los objetos";
  }
}
