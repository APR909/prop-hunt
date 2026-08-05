import { CANVAS_W, CANVAS_H, drawRoom, ROOM_LEFT, ROOM_RIGHT, ROOM_TOP, ROOM_BOTTOM } from "./room.js";
import { createProp, drawProp, PROP_TYPES } from "./props.js";
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
const ROOM_CENTER_X = (ROOM_LEFT + ROOM_RIGHT) / 2;
const ROOM_CENTER_Y = (ROOM_TOP + ROOM_BOTTOM) / 2;

const baseProps = [
  createProp("chair", 220, 150, 0.4),
  createProp("chair", 900, 560, -1.1),
  createProp("lamp", 140, 500),
  createProp("lamp", 950, 160),
  createProp("plant", 180, 620),
  createProp("plant", 980, 400),
  createProp("crate", 420, 130, 0.2),
  createProp("crate", 460, 200, -0.3),
  createProp("crate", 700, 580, 0.6),
  createProp("table", 620, 340, 0.1),
  createProp("barrel", 320, 480),
  createProp("barrel", 800, 230),
];
let props = [...baseProps];

const hider = createPlayer(ROOM_CENTER_X, ROOM_CENTER_Y, "#E4283C");
hider.disguise = null; // null = normal form, or a PROP_TYPES key

const hunter = createPlayer(ROOM_LEFT + 60, ROOM_TOP + 60, "#F3EFEA");

let mode = "hider"; // "hider" | "hunter"
let feedback = null; // { text, x, y, until, color }

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
  hunter.x = ROOM_LEFT + 60;
  hunter.y = ROOM_TOP + 60;
  hunter.angle = 0;
  mode = "hunter";
  feedback = null;
}

function switchToHider() {
  props = [...baseProps];
  hider.x = ROOM_CENTER_X;
  hider.y = ROOM_CENTER_Y;
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
    } else {
      const target = nearestFor(hider, DISGUISE_RANGE);
      if (target) hider.disguise = target.type;
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
  if (dx !== 0 || dy !== 0) {
    active.x += dx * MOVE_SPEED * dt;
    active.y += dy * MOVE_SPEED * dt;
    active.angle = Math.atan2(dy, dx);
  }
  resolveCollisions(active, props);

  drawRoom(ctx);

  let near = null;
  if (mode === "hider" && !hider.disguise) {
    near = nearestFor(hider, DISGUISE_RANGE);
    if (near) drawHighlight(near, "rgba(228,40,60,0.85)");
  } else if (mode === "hunter") {
    near = nearestFor(hunter, CHECK_RANGE);
    if (near) drawHighlight(near, "rgba(243,239,234,0.55)");
  }

  const hiderDraw = hider.disguise
    ? () => PROP_TYPES[hider.disguise].draw(ctx, hider.x, hider.y, hider.angle)
    : () => drawPlayer(ctx, hider);

  const drawables = props.map((p) => ({ y: p.y, draw: () => drawProp(ctx, p) }));
  if (mode === "hider") drawables.push({ y: hider.y, draw: hiderDraw });
  else drawables.push({ y: hunter.y, draw: () => drawPlayer(ctx, hunter, "#E4283C") });
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
