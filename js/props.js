// ============================================================
// PROPS — recognizable top-down silhouettes for each object type,
// reskinned with an infernal theme: charred wood, ember cracks,
// bone and rune details — while keeping each shape distinct enough
// to still read clearly as "chair", "lamp", "table" etc.
// ============================================================

function rot(ctx, x, y, angle, fn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fn();
  ctx.restore();
}

/** A thin glowing ember seam — the recurring "cracked lava rock" motif
 *  used across the other infernal-themed projects. */
function emberCrack(ctx, points, color = "rgba(255,120,40,0.85)", width = 1.4) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;
  ctx.beginPath();
  points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
  ctx.stroke();
  ctx.restore();
}

export const PROP_TYPES = {
  chair: {
    label: "silla",
    radius: 22,
    draw(ctx, x, y, angle = 0) {
      rot(ctx, x, y, angle, () => {
        // charred bone-dark legs
        ctx.fillStyle = "#2a2320";
        [[-13, -13], [13, -13], [-13, 13], [13, 13]].forEach(([dx, dy]) => {
          ctx.beginPath();
          ctx.arc(dx, dy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
        // seat — dark oxblood leather, ember piping along the seam
        ctx.fillStyle = "#3a1016";
        roundRect(ctx, -16, -16, 32, 32, 5);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,90,40,0.55)";
        ctx.lineWidth = 1.6;
        ctx.stroke();
        // backrest bar with a small carved skull motif (indicates orientation)
        ctx.fillStyle = "#241012";
        roundRect(ctx, -18, -23, 36, 9, 3);
        ctx.fill();
        ctx.fillStyle = "rgba(215,200,175,0.85)";
        ctx.beginPath();
        ctx.arc(0, -18.5, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#241012";
        ctx.beginPath();
        ctx.arc(-1.1, -19, 0.7, 0, Math.PI * 2);
        ctx.arc(1.1, -19, 0.7, 0, Math.PI * 2);
        ctx.fill();
      });
    },
  },

  lamp: {
    label: "brasero",
    radius: 18,
    draw(ctx, x, y) {
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 32);
      glow.addColorStop(0, "rgba(255, 110, 40, 0.4)");
      glow.addColorStop(1, "rgba(255, 90, 30, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 32, 0, Math.PI * 2);
      ctx.fill();

      // squat iron brazier bowl instead of a lampshade
      ctx.fillStyle = "#2a2422";
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#141110";
      ctx.lineWidth = 2;
      ctx.stroke();

      // flickering ember core
      ctx.save();
      ctx.shadowColor = "rgba(255,140,50,0.9)";
      ctx.shadowBlur = 8;
      const emberGrad = ctx.createRadialGradient(x, y, 1, x, y, 8);
      emberGrad.addColorStop(0, "#fff2c8");
      emberGrad.addColorStop(0.5, "#ff8a2e");
      emberGrad.addColorStop(1, "#c22a10");
      ctx.fillStyle = emberGrad;
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    },
  },

  plant: {
    label: "planta",
    radius: 24,
    draw(ctx, x, y) {
      // ash-blackened pot
      ctx.fillStyle = "#231b16";
      roundRect(ctx, x - 11, y + 4, 22, 14, 3);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,90,40,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 11, y + 4, 22, 14);

      // blackened, thorny canopy — a few overlapping dark blobs read as foliage
      ctx.fillStyle = "#1c2318";
      const blobs = [
        [0, -4, 15],
        [-11, 2, 11],
        [11, 2, 11],
        [-6, -12, 10],
        [7, -11, 10],
      ];
      blobs.forEach(([dx, dy, r]) => {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = "#2a3320";
      ctx.beginPath();
      ctx.arc(x - 3, y - 6, 6, 0, Math.PI * 2);
      ctx.fill();

      // small ember "berries" glowing among the leaves
      ctx.save();
      ctx.shadowColor = "rgba(255,90,40,0.9)";
      ctx.shadowBlur = 4;
      ctx.fillStyle = "#ff5a28";
      [[-8, -6], [6, -13], [2, 1]].forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(x + dx, y + dy, 1.8, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();

      // a couple of thin thorn spikes poking past the canopy silhouette
      ctx.strokeStyle = "#1c2318";
      ctx.lineWidth = 1.4;
      [[-14, -14, -19, -19], [13, -12, 18, -17]].forEach(([x1, y1, x2, y2]) => {
        ctx.beginPath();
        ctx.moveTo(x + x1, y + y1);
        ctx.lineTo(x + x2, y + y2);
        ctx.stroke();
      });
    },
  },

  crate: {
    label: "caja",
    radius: 26,
    draw(ctx, x, y, angle = 0) {
      rot(ctx, x, y, angle, () => {
        ctx.fillStyle = "#4a3420";
        roundRect(ctx, -22, -22, 44, 44, 3);
        ctx.fill();
        ctx.strokeStyle = "#241a10";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-22, -22, 44, 44);

        // charred cross-bracing
        ctx.strokeStyle = "#241a10";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-22, -22);
        ctx.lineTo(22, 22);
        ctx.moveTo(22, -22);
        ctx.lineTo(-22, 22);
        ctx.stroke();

        // glowing ember crack running through one corner
        emberCrack(ctx, [
          [-20, -6],
          [-10, -10],
          [-6, -2],
          [4, -6],
        ]);

        // hazard-stripe corner marking (reused visual language from the other builds)
        ctx.save();
        ctx.fillStyle = "#d4aa28";
        ctx.beginPath();
        ctx.rect(12, 12, 10, 10);
        ctx.clip();
        for (let i = -10; i < 20; i += 4) {
          ctx.fillRect(12 + i, 12, 2, 10);
        }
        ctx.restore();
      });
    },
  },

  table: {
    label: "mesa",
    radius: 40,
    draw(ctx, x, y, angle = 0) {
      rot(ctx, x, y, angle, () => {
        ctx.fillStyle = "#3a2a1a";
        roundRect(ctx, -42, -26, 84, 52, 6);
        ctx.fill();
        ctx.strokeStyle = "#1c130b";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // faint rune-like etchings across the tabletop
        ctx.save();
        ctx.strokeStyle = "rgba(255,80,40,0.4)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(0, 0, 14, 0, Math.PI * 2);
        ctx.moveTo(0, -14);
        ctx.lineTo(0, 14);
        ctx.moveTo(-12, -8);
        ctx.lineTo(12, 8);
        ctx.stroke();
        ctx.restore();

        // charred iron-capped legs peeking out from under the tabletop
        ctx.fillStyle = "#161010";
        [[-36, -20], [36, -20], [-36, 20], [36, 20]].forEach(([dx, dy]) => {
          ctx.beginPath();
          ctx.arc(dx, dy, 4, 0, Math.PI * 2);
          ctx.fill();
        });
      });
    },
  },

  barrel: {
    label: "barril",
    radius: 20,
    draw(ctx, x, y) {
      ctx.fillStyle = "#2e2018";
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#120c08";
      ctx.lineWidth = 2;
      ctx.stroke();

      // rusted iron hoops
      ctx.strokeStyle = "#5a4530";
      ctx.lineWidth = 1.6;
      [8, 14].forEach((r) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // stave lines
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        ctx.lineTo(x + Math.cos(a) * 19, y + Math.sin(a) * 19);
        ctx.stroke();
      }

      // glowing ember seeping through a crack in the staves
      ctx.save();
      ctx.shadowColor = "rgba(255,100,30,0.9)";
      ctx.shadowBlur = 5;
      ctx.strokeStyle = "#ff6a1e";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 12);
      ctx.lineTo(x - 1, y - 4);
      ctx.lineTo(x - 5, y + 2);
      ctx.lineTo(x - 2, y + 10);
      ctx.stroke();
      ctx.restore();
    },
  },
};

export function createProp(type, x, y, angle = 0) {
  return { type, x, y, angle, radius: PROP_TYPES[type].radius };
}

/** Scatters 2-4 random props per room, keeping them clear of walls and
 *  of each other (simple rejection sampling — a handful of retries each). */
export function scatterProps(rooms) {
  const types = Object.keys(PROP_TYPES);
  const props = [];
  const PAD = 34;

  for (const room of rooms) {
    const count = 2 + Math.floor(Math.random() * 3); // 2..4
    let placed = 0;
    let attempts = 0;

    while (placed < count && attempts < 50) {
      attempts++;
      const type = types[Math.floor(Math.random() * types.length)];
      const r = PROP_TYPES[type].radius;
      const spanX = room.w - 2 * (PAD + r);
      const spanY = room.h - 2 * (PAD + r);
      if (spanX <= 0 || spanY <= 0) continue;

      const x = room.x + PAD + r + Math.random() * spanX;
      const y = room.y + PAD + r + Math.random() * spanY;

      const overlaps = props.some((p) => Math.hypot(p.x - x, p.y - y) < p.radius + r + 16);
      if (overlaps) continue;

      props.push(createProp(type, x, y, (Math.random() - 0.5) * 1.4));
      placed++;
    }
  }

  return props;
}

export function drawProp(ctx, prop) {
  PROP_TYPES[prop.type].draw(ctx, prop.x, prop.y, prop.angle);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
