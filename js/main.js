import { CANVAS_W, CANVAS_H, drawRoom, generateFloorPlan } from "./room.js";
import { drawProp, scatterProps, PROP_TYPES } from "./props.js";
import { createPlayer, drawPlayer, MOVE_SPEED } from "./player.js";

const HIDER_SPEED_MULTIPLIER = 1.15; // the hider is always a bit quicker than the hunter
import { createKeyboard } from "./input.js";
import { resolveCollisions } from "./physics.js";
import { applyFogOfWar } from "./fog.js";
import { createAIHider, startHiding, updateAI, aiEffectiveRadius } from "./ai.js";
import * as net from "./network.js";

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
const btnModeOnline = document.getElementById("btnModeOnline");
const onlineLobbyOverlayEl = document.getElementById("onlineLobbyOverlay");
const btnCreateRoom = document.getElementById("btnCreateRoom");
const joinCodeInput = document.getElementById("joinCodeInput");
const btnJoinRoom = document.getElementById("btnJoinRoom");
const lobbyStatusEl = document.getElementById("lobbyStatus");
const btnBackFromLobby = document.getElementById("btnBackFromLobby");
const onlineWaitingOverlayEl = document.getElementById("onlineWaitingOverlay");
const roomCodeBigEl = document.getElementById("roomCodeBig");
const btnCancelWaiting = document.getElementById("btnCancelWaiting");

const DISGUISE_RANGE = 46;
const CHECK_RANGE = 50;
const HIDE_DURATION_LOCAL = 30;
const HUNT_DURATION_LOCAL = 90;
const HIDE_DURATION_AI = 10;
const HUNT_DURATION_AI = 45;
const HIDE_DURATION_ONLINE = 20;
const HUNT_DURATION_ONLINE = 90;
const STATE_SEND_INTERVAL = 90; // ms between position broadcasts

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

let gameMode = null; // "local" | "ai" | "online"
let mode = "hider";  // which entity local keyboard input drives (local mode only)
let roundPhase = "hiding";
let hideTimeLeft = HIDE_DURATION_LOCAL;
let huntTimeLeft = HUNT_DURATION_LOCAL;
let hideDuration = HIDE_DURATION_LOCAL;
let huntDuration = HUNT_DURATION_LOCAL;
let feedback = null;
let transformFX = null;

// ---------- online multiplayer session ----------
let mp = null; // { code, role, unsubscribe, opponentConnected, remote: {x,y,angle,disguise,moving} }
let lastStateSendAt = 0;
let myWalkPhase = 0;
let myBobAmount = 0;
let remoteWalkPhase = 0;
let remoteBobAmount = 0;

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

/** Hunter's check target in online mode: the closest of (real static props,
 *  the remote hider's synced position — disguised or exposed). */
function nearestForHunterOnline() {
  let best = null;
  let bestDist = Infinity;
  for (const p of props) {
    const dist = Math.hypot(hunter.x - p.x, hunter.y - p.y) - p.radius - hunter.radius;
    if (dist < CHECK_RANGE && dist < bestDist) {
      best = p;
      bestDist = dist;
    }
  }
  if (mp?.remote) {
    const r = mp.remote;
    const radius = r.disguise ? PROP_TYPES[r.disguise].radius : hider.radius;
    const dist = Math.hypot(hunter.x - r.x, hunter.y - r.y) - radius - hunter.radius;
    if (dist < CHECK_RANGE && dist < bestDist) {
      best = { x: r.x, y: r.y, radius, isHiddenPlayer: true };
    }
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
btnModeOnline.addEventListener("click", () => {
  modeSelectOverlayEl.classList.add("hidden");
  onlineLobbyOverlayEl.classList.remove("hidden");
  lobbyStatusEl.textContent = "";
});
btnBackFromLobby.addEventListener("click", () => {
  onlineLobbyOverlayEl.classList.add("hidden");
  modeSelectOverlayEl.classList.remove("hidden");
});

function attachRoomListeners(code) {
  return net.listenRoom(code, {
    onStatus: (status) => {
      if (status === "playing" && mp && mp.role === "hider" && !mp.gameStarted) {
        mp.gameStarted = true;
        onlineWaitingOverlayEl.classList.add("hidden");
        gameMode = "online";
        startRound();
      }
      if (mp) mp.opponentConnected = status === "playing";
    },
    onHider: (state) => {
      if (!state || !mp) return;
      if (mp.role === "hunter") mp.remote = state;
      mp.hiderConnected = state.connected !== false;
    },
    onHunter: (state) => {
      if (!state || !mp) return;
      if (mp.role === "hider") mp.remote = state;
      mp.hunterConnected = state.connected !== false;
    },
    onPhase: (info) => {
      if (!mp || !info.phase) return;
      applyRemotePhase(info);
    },
    onResult: (result) => {
      if (!result || !mp || roundPhase === "ended") return;
      endRound(result === "hunter_wins" ? "hunters" : "hiders");
    },
  });
}

function applyRemotePhase(info) {
  if (info.phase === roundPhase) return;
  if (info.phase === "hunting" && roundPhase === "hiding") {
    startHuntPhaseOnline();
  }
}

btnCreateRoom.addEventListener("click", async () => {
  lobbyStatusEl.textContent = "creando sala…";
  try {
    const plan = newFloorPlan();
    const created = await net.createRoom(plan, "Jugador 1");
    mp = { code: created.code, role: "hider", floorPlan: plan, gameStarted: false, remote: null, opponentConnected: false };
    mp.unsubscribe = attachRoomListeners(created.code);
    onlineLobbyOverlayEl.classList.add("hidden");
    onlineWaitingOverlayEl.classList.remove("hidden");
    roomCodeBigEl.textContent = created.code;
  } catch (err) {
    lobbyStatusEl.textContent = err.message || "no se pudo crear la sala";
  }
});

btnJoinRoom.addEventListener("click", async () => {
  const code = joinCodeInput.value.trim();
  if (!code) return;
  lobbyStatusEl.textContent = "uniéndose…";
  try {
    const joined = await net.joinRoom(code, "Jugador 2");
    mp = { code: joined.code, role: "hunter", floorPlan: joined.floorPlan, gameStarted: true, remote: null, opponentConnected: true };
    mp.unsubscribe = attachRoomListeners(joined.code);
    net.sendPhaseChange(joined.code, "hiding", { hideDuration: HIDE_DURATION_ONLINE, huntDuration: HUNT_DURATION_ONLINE });
    onlineLobbyOverlayEl.classList.add("hidden");
    gameMode = "online";
    startRound();
  } catch (err) {
    lobbyStatusEl.textContent = err.message || "no se pudo unir a la sala";
  }
});

btnCancelWaiting.addEventListener("click", () => {
  if (mp) {
    net.leaveRoom(mp.code, mp.role);
    if (mp.unsubscribe) mp.unsubscribe();
  }
  mp = null;
  onlineWaitingOverlayEl.classList.add("hidden");
  modeSelectOverlayEl.classList.remove("hidden");
});

// =========================================================
// ROUND FLOW
// =========================================================
function startRound() {
  if (gameMode === "online") {
    floorPlan = mp.floorPlan;
    props = floorPlan.props;

    const hiderStart = roomCenter(floorPlan.rooms[0]);
    const hunterStart = roomCenter(floorPlan.rooms[floorPlan.rooms.length - 1]);

    if (mp.role === "hider") {
      hider.x = hiderStart.x;
      hider.y = hiderStart.y;
      hider.disguise = null;
    } else {
      hunter.x = hunterStart.x;
      hunter.y = hunterStart.y;
      hunter.angle = 0;
    }

    roundPhase = "hiding";
    hideDuration = HIDE_DURATION_ONLINE;
    huntDuration = HUNT_DURATION_ONLINE;
    hideTimeLeft = hideDuration;
    feedback = null;
    roundEndOverlayEl.classList.add("hidden");
    return;
  }

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

function startHuntPhaseOnline() {
  const hunterStart = roomCenter(floorPlan.rooms[floorPlan.rooms.length - 1]);
  if (mp.role === "hunter") {
    hunter.x = hunterStart.x;
    hunter.y = hunterStart.y;
    hunter.angle = 0;
  }
  roundPhase = "hunting";
  huntTimeLeft = huntDuration;
  feedback = null;
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
  const iAmHider = gameMode === "online" && mp?.role === "hider";
  const iAmHunter = gameMode === "online" && mp?.role === "hunter";

  if (winner === "hunters") {
    roundResultTitleEl.textContent = iAmHunter ? "¡Has ganado!" : iAmHider ? "Te han encontrado…" : "¡El cazador gana!";
    roundResultDescEl.textContent = iAmHunter
      ? "Encontraste al escondido antes de que se acabara el tiempo."
      : "El cazador te ha encontrado antes de que se acabara el tiempo.";
  } else {
    roundResultTitleEl.textContent = iAmHider ? "¡Has ganado!" : iAmHunter ? "Se te escapó…" : "¡El escondido gana!";
    roundResultDescEl.textContent = iAmHider
      ? "El cazador no te encontró a tiempo."
      : iAmHunter
      ? "No encontraste al escondido a tiempo."
      : "El cazador no te encontró a tiempo.";
  }
  roundEndOverlayEl.classList.remove("hidden");
}

btnNewRound.addEventListener("click", () => {
  if (gameMode === "online") {
    if (mp) {
      net.leaveRoom(mp.code, mp.role);
      if (mp.unsubscribe) mp.unsubscribe();
    }
    mp = null;
    gameMode = null;
    roundEndOverlayEl.classList.add("hidden");
    modeSelectOverlayEl.classList.remove("hidden");
    return;
  }
  startRound();
});

// =========================================================
// INPUT
// =========================================================
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  const iAmOnlineHider = gameMode === "online" && mp?.role === "hider";
  if (gameMode !== "local" && !iAmOnlineHider) return; // disguise key only applies when a human plays the hider

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
  if (gameMode === "online" && mp?.role !== "hunter") return; // only the hunter can check

  const target = gameMode === "ai" ? nearestForHunterAI() : gameMode === "online" ? nearestForHunterOnline() : nearestFor(hunter, CHECK_RANGE);
  if (!target) return;
  if (target.isHiddenPlayer) {
    feedback = { text: "¡encontrado!", x: target.x, y: target.y - 40, until: performance.now() + 1500, color: "#FF4D67" };
    if (gameMode === "online") net.sendResult(mp.code, "hunter_wins");
    else endRound("hunters");
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

  if (gameMode === "online") {
    if (roundPhase === "hiding") {
      hideTimeLeft -= dt;
      if (hideTimeLeft <= 0) {
        hideTimeLeft = 0;
        if (mp.role === "hider" && !mp.hideExpirySent) {
          mp.hideExpirySent = true;
          net.sendPhaseChange(mp.code, "hunting");
        }
      }
    } else if (roundPhase === "hunting") {
      huntTimeLeft -= dt;
      if (huntTimeLeft <= 0) {
        huntTimeLeft = 0;
        if (mp.role === "hunter" && !mp.huntExpirySent) {
          mp.huntExpirySent = true;
          net.sendResult(mp.code, "hider_wins");
        }
      }
    }
  } else if (gameMode && roundPhase === "hiding") {
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
    if (gameMode === "online") {
      const active = mp.role === "hider" ? hider : hunter;
      const remoteEntity = mp.role === "hider" ? hunter : hider;
      const { dx, dy } = keyboard.getMoveVector();
      const isMoving = dx !== 0 || dy !== 0;
      const speed = mp.role === "hider" ? MOVE_SPEED * HIDER_SPEED_MULTIPLIER : MOVE_SPEED;
      if (isMoving) {
        active.x += dx * speed * dt;
        active.y += dy * speed * dt;
        active.angle = Math.atan2(dy, dx);
        active.walkPhase += dt * 12;
      }
      active.bobAmount += ((isMoving ? 1 : 0) - active.bobAmount) * Math.min(1, dt * 10);
      resolveCollisions(active, props, floorPlan.walls);

      if (now - lastStateSendAt > STATE_SEND_INTERVAL) {
        lastStateSendAt = now;
        const payload = { x: active.x, y: active.y, angle: active.angle, connected: true };
        if (mp.role === "hider") payload.disguise = hider.disguise;
        net.sendMyState(mp.code, mp.role, payload);
      }

      if (mp.remote) {
        const movedDist = Math.hypot(remoteEntity.x - mp.remote.x, remoteEntity.y - mp.remote.y);
        const remoteMoving = movedDist > 0.5;
        remoteEntity.x = mp.remote.x;
        remoteEntity.y = mp.remote.y;
        remoteEntity.angle = mp.remote.angle;
        if (mp.role === "hunter") hider.disguise = mp.remote.disguise ?? null;
        remoteEntity.walkPhase += (remoteMoving ? dt * 12 : 0);
        remoteEntity.bobAmount += ((remoteMoving ? 1 : 0) - remoteEntity.bobAmount) * Math.min(1, dt * 10);
      }
    } else if (gameMode === "local") {
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
  const onlineHunterWaitingForHide = gameMode === "online" && mp?.role === "hunter" && roundPhase === "hiding";
  let near = null;

  if (aiIsHidingUnseen || onlineHunterWaitingForHide) {
    ctx.fillStyle = "#0a0808";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.save();
    ctx.textAlign = "center";
    ctx.fillStyle = "#A9A29D";
    ctx.font = "600 22px 'Work Sans', sans-serif";
    ctx.fillText(
      aiIsHidingUnseen ? "La IA se está escondiendo…" : "El otro jugador se está escondiendo…",
      CANVAS_W / 2,
      CANVAS_H / 2 - 14
    );
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
    } else if (gameMode === "online") {
      if (mp.role === "hider" && roundPhase === "hiding" && !hider.disguise) {
        near = nearestFor(hider, DISGUISE_RANGE);
        if (near) drawHighlight(near, "rgba(228,40,60,0.85)");
      } else if (mp.role === "hunter" && roundPhase === "hunting") {
        near = nearestForHunterOnline();
        if (near) drawHighlight(near, "rgba(243,239,234,0.55)");
      }
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
    } else if (gameMode === "online") {
      const hiderDraw = hider.disguise
        ? () => PROP_TYPES[hider.disguise].draw(ctx, hider.x, hider.y, hider.angle)
        : () => drawPlayer(ctx, hider, "#F3EFEA", bob);
      drawables.push({ y: hider.y, draw: () => withTransformPop(hider.x, hider.y, hiderDraw) });
      if (roundPhase !== "hiding") {
        drawables.push({ y: hunter.y, draw: () => drawPlayer(ctx, hunter, "#E4283C", hunterBob) });
      }
    }

    drawables.sort((a, b) => a.y - b.y);
    drawables.forEach((d) => d.draw());

    const iAmViewingAsHunter = gameMode === "online" ? mp.role === "hunter" : true;
    if (roundPhase === "hunting" && iAmViewingAsHunter) {
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
  const onlineHider = gameMode === "online" && mp?.role === "hider";
  const onlineHunter = gameMode === "online" && mp?.role === "hunter";

  if (roundPhase === "hiding") {
    phaseLabelEl.textContent = gameMode === "ai" ? "la ia se esconde" : onlineHunter ? "esperando" : "escondiéndote";
    phaseTimerEl.textContent = formatTime(hideTimeLeft);
    phaseBarFillEl.style.width = `${(hideTimeLeft / hideDuration) * 100}%`;
    phaseBarFillEl.className = "phase-bar-fill" + (hideTimeLeft < 5 ? " urgent" : "");

    if (gameMode === "ai") {
      disguiseStatusEl.textContent = "preparándose…";
      disguiseStatusEl.className = "hud-value";
      disguiseHintEl.textContent = "la IA está buscando dónde esconderse";
    } else if (onlineHunter) {
      disguiseStatusEl.textContent = "esperando…";
      disguiseStatusEl.className = "hud-value";
      disguiseHintEl.textContent = "el otro jugador se está escondiendo todavía";
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
    phaseLabelEl.textContent = onlineHider ? "huyendo" : "cazando";
    phaseTimerEl.textContent = formatTime(huntTimeLeft);
    phaseBarFillEl.style.width = `${(huntTimeLeft / huntDuration) * 100}%`;
    phaseBarFillEl.className = "phase-bar-fill hunting" + (huntTimeLeft < 8 ? " urgent" : "");

    if (onlineHider) {
      disguiseStatusEl.textContent = hider.disguise ? `disfrazado de ${PROP_TYPES[hider.disguise].label}` : "sin disfraz";
      disguiseStatusEl.className = "hud-value disguise-active";
      disguiseHintEl.textContent = "el cazador anda cerca — muévete con cuidado";
    } else {
      disguiseStatusEl.textContent = "modo cazador";
      disguiseStatusEl.className = "hud-value disguise-active";
      disguiseHintEl.textContent = near ? "pulsa espacio para inspeccionar" : "busca entre los objetos";
    }
  } else {
    phaseLabelEl.textContent = "ronda terminada";
    phaseTimerEl.textContent = "00:00";
    phaseBarFillEl.style.width = "0%";
  }
}
