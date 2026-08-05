import { CANVAS_W, CANVAS_H, drawRoom, ROOM_LEFT, ROOM_RIGHT, ROOM_TOP, ROOM_BOTTOM } from "./room.js";
import { createProp, drawProp } from "./props.js";
import { createPlayer, drawPlayer, MOVE_SPEED } from "./player.js";
import { createKeyboard } from "./input.js";
import { resolveCollisions } from "./physics.js";

const canvas = document.getElementById("scene");
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext("2d");

const keyboard = createKeyboard();

const props = [
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

const player = createPlayer((ROOM_LEFT + ROOM_RIGHT) / 2, (ROOM_TOP + ROOM_BOTTOM) / 2);

let lastTime = performance.now();
function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  const { dx, dy } = keyboard.getMoveVector();
  if (dx !== 0 || dy !== 0) {
    player.x += dx * MOVE_SPEED * dt;
    player.y += dy * MOVE_SPEED * dt;
    player.angle = Math.atan2(dy, dx);
  }
  resolveCollisions(player, props);

  drawRoom(ctx);

  const drawables = [...props.map((p) => ({ y: p.y, draw: () => drawProp(ctx, p) })), { y: player.y, draw: () => drawPlayer(ctx, player) }];
  drawables.sort((a, b) => a.y - b.y);
  drawables.forEach((d) => d.draw());

  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
