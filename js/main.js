import { CANVAS_W, CANVAS_H, drawRoom, generateFloorPlan } from "./room.js";
import { drawProp, scatterProps, PROP_TYPES } from "./props.js";
import { createPlayer, drawPlayer, MOVE_SPEED } from "./player.js";

const HIDER_SPEED_MULTIPLIER = 1.15; // the hider is always a bit quicker than the hunter
import { createKeyboard } from "./input.js";
import { resolveCollisions } from "./physics.js";
import { applyFogOfWar } from "./fog.js";
import { createAIHider, startHiding, updateAI, aiEffectiveRadius } from "./ai.js";

const canvas = document.getElementById("scene");
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext("2d");

const disguiseStatusEl = document.getElementById("disguiseStatus");
const disguiseHintEl = document.getElementById("disguiseHint");
const phaseLabelEl = document.getElementById("phaseLabel");
const phaseTimerEl = document.getElementById("phaseTimer");
const phaseBarFillEl = document.getElementById("phaseBarFill");
const roundEndOverlayEl = document.getElementById("roundEndOverlay");
const roundResultTitleEl = document.getElementById("roundResultTitle");
const roundResultDescEl = document.getElementById("roundResultDesc");
const btnNewRound = document.getElementById("btnNewRound");
const modeSelectOverlayEl = document.getElementById("modeSelectOverlay");
const btnModeLocal = document.getElementById("btnModeLocal");
const btnModeAI = document.getElementById("btnModeAI");

const DISGUISE_RANGE = 46;
const CHECK_RANGE = 50;
const HIDE_DURATION_LOCAL = 30;
const HUNT_DURATION_LOCAL = 90;
const HIDE_DURATION_AI = 10;
const HUNT_DURATION_AI = 45;

const keyboard = createKeyboard();

function newFloorPlan() {
  const plan = generateFloorPlan();
  const scattered = scatterProps(plan.rooms);
  return { ...plan, props: scattered };
}

function roomCenter(room) {
  return { x: room.x + room.w / 2, y: room.y + room.h / 2 };
}

let floorPlan = newFloorPlan();
let props = floorPlan.props;

const hider = createPlayer(0, 0, "#E4283C");
hider.disguise = null;
hider.walkPhase = 0;
hider.bobAmount = 0;

const hunter = createPlayer(0, 0, "#F3EFEA");
hunter.walkPhase = 0;
hunter.bobAmount = 0;

const aiHider = createAIHider(createPlayer(0, 0, "#E4283C"));

let gameMode = null; // "local" | "ai"
let mode = "hider";  // which entity local keyboard input drives (local mode only)
let roundPhase = "hiding";
let hideTimeLeft = HIDE_DURATION_LOCAL;
let huntTimeLeft = HUNT_DURATION_LOCAL;
let hideDuration = HIDE_DURATION_LOCAL;
let huntDuration = HUNT_DURATION_LOCAL;
let feedback = null;
let transformFX = null;

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

/** Hunter's check target in AI mode: the closest of (real static props,
 *  the AI hider itself — disguised or exposed). */
function nearestForHunterAI() {
  let best = null;
  let bestDist = Infinity;
  for (const p of props) {
    const dist = Math.hypot(hunter.x - p.x, hunter.y - p.y) - p.radius - hunter.radius;
    if (dist < CHECK_RANGE && dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  const aiR = aiEffectiveRadius(aiHider, aiHider.radius);
  const aiDist = Math.hypot(hunter.x - aiHider.x, hunter.y - aiHider.y) - aiR - hunter.radius;
  if (aiDist < CHECK_RANGE && aiDist < bestDist) {
    best = { x: aiHider.x, y: aiHider.y, radius: aiR, isHiddenPlayer: true };
  }
  return best;
}

function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = String(Math.floor(s / 60)).padStart(2, "0");
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}

// =========================================================
// MODE SELECT
// =========================================================
btnModeLocal.addEventListener("click", () => {
  gameMode = "local";
  modeSelectOverlayEl.classList.add("hidden");
  startRound();
});
btnModeAI.addEventListener("click", () => {
  gameMode = "ai";
  modeSelectOverlayEl.classList.add("hidden");
  startRound();
});

// =========================================================
// ROUND FLOW
// =========================================================
function startRound() {
  floorPlan = newFloorPlan();
  props = floorPlan.props;

  const hiderStart = roomCenter(floorPlan.rooms[0]);
  hider.x = hiderStart.x;
  hider.y = hiderStart.y;
  hider.disguise = null;

  aiHider.x = hiderStart.x;
  aiHider.y = hiderStart.y;
  aiHider.disguise = null;
  aiHider.pendingDisguise = null;
  aiHider.path = [];

  roundPhase = "hiding";
  hideDuration = gameMode === "ai" ? HIDE_DURATION_AI : HIDE_DURATION_LOCAL;
  huntDuration = gameMode === "ai" ? HUNT_DURATION_AI : HUNT_DURATION_LOCAL;
  hideTimeLeft = hideDuration;
  mode = "hider";
  feedback = null;
  roundEndOverlayEl.classList.add("hidden");

  if (gameMode === "ai") {
    startHiding(aiHider, floorPlan.rooms, floorPlan.doors, floorPlan.props);
  }
}

function startHuntPhase() {
  if (gameMode === "local" && hider.disguise) {
    props.push({
      type: hider.disguise,
      x: hider.x,
      y: hider.y,
      angle: hider.angle,
      radius: PROP_TYPES[hider.disguise].radius,
      isHiddenPlayer: true,
    });
  }
  const hunterStart = roomCenter(floorPlan.rooms[floorPlan.rooms.length - 1]);
  hunter.x = hunterStart.x;
  hunter.y = hunterStart.y;
  hunter.angle = 0;

  roundPhase = "hunting";
  huntTimeLeft = huntDuration;
  mode = "hunter";
  feedback = null;
}

function endRound(winner) {
  roundPhase = "ended";
  feedback = null;
  if (winner === "hunters") {
    roundResultTitleEl.textContent = "¡El cazador gana!";
    roundResultDescEl.textContent = "Te ha encontrado antes de que se acabara el tiempo.";
  } else {
    roundResultTitleEl.textContent = "¡El escondido gana!";
    roundResultDescEl.textContent = "El cazador no te encontró a tiempo.";
  }
  roundEndOverlayEl.classList.remove("hidden");
}

btnNewRound.addEventListener("click", startRound);

// =========================================================
// INPUT
// =========================================================
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (gameMode !== "local") return; // disguise key only applies when a human plays the hider

  if (roundPhase === "hiding" && key === "e") {
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
});

window.addEventListener("keydown", (e) => {
  if (e.key !== " " || roundPhase !== "hunting") return;
  e.preventDefault();

  const target = gameMode === "ai" ? nearestForHunterAI() : nearestFor(hunter, CHECK_RANGE);
  if (!target) return;
  if (target.isHiddenPlayer) {
    feedback = { text: "¡encontrado!", x: target.x, y: target.y - 40, until: performance.now() + 1500, color: "#FF4D67" };
    endRound("hunters");
  } else {
    feedback = { text: "nada por aquí…", x: target.x, y: target.y - 40, until: performance.now() + 900, color: "#A9A29D" };
  }
});

// =========================================================
// MAIN LOOP
// =========================================================
let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  if (gameMode && roundPhase === "hiding") {
    hideTimeLeft -= dt;
    if (hideTimeLeft <= 0) {
      hideTimeLeft = 0;
      startHuntPhase();
    }
  } else if (gameMode && roundPhase === "hunting") {
    huntTimeLeft -= dt;
    if (huntTimeLeft <= 0) {
      huntTimeLeft = 0;
      endRound("hiders");
    }
  }

  if (gameMode && roundPhase !== "ended") {
    if (gameMode === "local") {
      const active = mode === "hider" ? hider : hunter;
      const { dx, dy } = keyboard.getMoveVector();
      const isMoving = dx !== 0 || dy !== 0;
      const speed = mode === "hider" ? MOVE_SPEED * HIDER_SPEED_MULTIPLIER : MOVE_SPEED;
      if (isMoving) {
        active.x += dx * speed * dt;
        active.y += dy * speed * dt;
        active.angle = Math.atan2(dy, dx);
        active.walkPhase += dt * 12;
      }
      active.bobAmount += ((isMoving ? 1 : 0) - active.bobAmount) * Math.min(1, dt * 10);
      resolveCollisions(active, props, floorPlan.walls);
    } else {
      // AI mode: human always drives the hunter; AI drives the hider throughout
      const { dx, dy } = keyboard.getMoveVector();
      const isMoving = dx !== 0 || dy !== 0;
      if (isMoving) {
        hunter.x += dx * MOVE_SPEED * dt;
        hunter.y += dy * MOVE_SPEED * dt;
        hunter.angle = Math.atan2(dy, dx);
        hunter.walkPhase += dt * 12;
      }
      hunter.bobAmount += ((isMoving ? 1 : 0) - hunter.bobAmount) * Math.min(1, dt * 10);
      resolveCollisions(hunter, props, floorPlan.walls);

      updateAI(aiHider, dt, {
        rooms: floorPlan.rooms,
        doors: floorPlan.doors,
        staticProps: floorPlan.props,
        hunter,
        roundPhase,
        moveSpeed: MOVE_SPEED * HIDER_SPEED_MULTIPLIER,
      });
      resolveCollisions(aiHider, props, floorPlan.walls);
    }
  }

  const aiIsHidingUnseen = gameMode === "ai" && roundPhase === "hiding";
  let near = null;

  if (aiIsHidingUnseen) {
    ctx.fillStyle = "#0a0808";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#A9A29D";
    ctx.font = "600 22px 'Work Sans', sans-serif";
    ctx.fillText("La IA se está escondiendo…", CANVAS_W / 2, CANVAS_H / 2 - 14);
    ctx.font = "16px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#7a746f";
    ctx.fillText("no puedes ver el mapa hasta que empiece la caza", CANVAS_W / 2, CANVAS_H / 2 + 18);
    ctx.restore();
  } else {
    drawRoom(ctx, floorPlan.walls, floorPlan.tubes);

    if (gameMode === "local") {
      if (roundPhase === "hiding" && !hider.disguise) {
        near = nearestFor(hider, DISGUISE_RANGE);
        if (near) drawHighlight(near, "rgba(228,40,60,0.85)");
      } else if (roundPhase === "hunting") {
        near = nearestFor(hunter, CHECK_RANGE);
        if (near) drawHighlight(near, "rgba(243,239,234,0.55)");
      }
    } else if (gameMode === "ai" && roundPhase === "hunting") {
      near = nearestForHunterAI();
      if (near) drawHighlight(near, "rgba(243,239,234,0.55)");
    }

    const bob = Math.sin(hider.walkPhase) * hider.bobAmount;
    const hunterBob = Math.sin(hunter.walkPhase) * hunter.bobAmount;
    const aiBob = Math.sin(aiHider.walkPhase) * aiHider.bobAmount;

    const drawables = props.map((p) => ({ y: p.y, draw: () => drawProp(ctx, p) }));

    if (gameMode === "local") {
      const hiderDraw = hider.disguise
        ? () => PROP_TYPES[hider.disguise].draw(ctx, hider.x, hider.y, hider.angle)
        : () => drawPlayer(ctx, hider, "#F3EFEA", mode === "hider" ? bob : 0);
      if (roundPhase === "hiding") {
        drawables.push({ y: hider.y, draw: () => withTransformPop(hider.x, hider.y, hiderDraw) });
      } else if (roundPhase === "hunting") {
        drawables.push({ y: hunter.y, draw: () => drawPlayer(ctx, hunter, "#E4283C", hunterBob) });
      }
    } else if (gameMode === "ai") {
      const aiDraw = aiHider.disguise
        ? () => PROP_TYPES[aiHider.disguise].draw(ctx, aiHider.x, aiHider.y, aiHider.angle)
        : () => drawPlayer(ctx, aiHider, "#F3EFEA", aiBob);
      drawables.push({ y: aiHider.y, draw: aiDraw });
      if (roundPhase !== "hiding") {
        drawables.push({ y: hunter.y, draw: () => drawPlayer(ctx, hunter, "#E4283C", hunterBob) });
      }
    }

    drawables.sort((a, b) => a.y - b.y);
    drawables.forEach((d) => d.draw());

    if (roundPhase === "hunting") {
      applyFogOfWar(ctx, hunter, CANVAS_W, CANVAS_H);
    }

    if (feedback && performance.now() < feedback.until) {
      ctx.save();
      ctx.font = "600 20px 'Work Sans', sans-serif";
      ctx.fillStyle = feedback.color;
      ctx.textAlign = "center";
      ctx.fillText(feedback.text, feedback.x, feedback.y);
      ctx.restore();
    }
  }

  if (gameMode) updateHud(near);

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
  if (roundPhase === "hiding") {
    phaseLabelEl.textContent = gameMode === "ai" ? "la ia se esconde" : "escondiéndote";
    phaseTimerEl.textContent = formatTime(hideTimeLeft);
    phaseBarFillEl.style.width = `${(hideTimeLeft / hideDuration) * 100}%`;
    phaseBarFillEl.className = "phase-bar-fill" + (hideTimeLeft < 5 ? " urgent" : "");

    if (gameMode === "ai") {
      disguiseStatusEl.textContent = "preparándose…";
      disguiseStatusEl.className = "hud-value";
      disguiseHintEl.textContent = "la IA está buscando dónde esconderse";
    } else if (hider.disguise) {
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
  } else if (roundPhase === "hunting") {
    phaseLabelEl.textContent = "cazando";
    phaseTimerEl.textContent = formatTime(huntTimeLeft);
    phaseBarFillEl.style.width = `${(huntTimeLeft / huntDuration) * 100}%`;
    phaseBarFillEl.className = "phase-bar-fill hunting" + (huntTimeLeft < 8 ? " urgent" : "");

    disguiseStatusEl.textContent = "modo cazador";
    disguiseStatusEl.className = "hud-value disguise-active";
    disguiseHintEl.textContent = near ? "pulsa espacio para inspeccionar" : "busca entre los objetos";
  } else {
    phaseLabelEl.textContent = "ronda terminada";
    phaseTimerEl.textContent = "00:00";
    phaseBarFillEl.style.width = "0%";
  }
}
