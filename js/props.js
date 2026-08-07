// ============================================================
// PROPS — recognizable top-down silhouettes for each object type.
// Each type has a collision radius (circle, same approach as the
// pool game) and a draw() that renders its distinct top-down look.
// ============================================================

function rot(ctx, x, y, angle, fn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  fn();
  ctx.restore();
}

export const PROP_TYPES = {
  chair: {
    label: "silla",
    radius: 22,
    draw(ctx, x, y, angle = 0) {
      rot(ctx, x, y, angle, () => {
        // wooden legs peeking from under the seat
        ctx.fillStyle = "#4a3320";
        [[-13, -13], [13, -13], [-13, 13], [13, 13]].forEach(([dx, dy]) => {
          ctx.beginPath();
          ctx.arc(dx, dy, 2.6, 0, Math.PI * 2);
          ctx.fill();
        });
        // seat — muted upholstery red, distinct from wood-toned props
        ctx.fillStyle = "#7a2e3a";
        roundRect(ctx, -16, -16, 32, 32, 5);
        ctx.fill();
        ctx.strokeStyle = "#4a1c24";
        ctx.lineWidth = 2;
        ctx.stroke();
        // backrest bar (indicates orientation)
        ctx.fillStyle = "#5a2029";
        roundRect(ctx, -18, -22, 36, 8, 3);
        ctx.fill();
      });
    },
  },

  lamp: {
    label: "lámpara",
    radius: 18,
    draw(ctx, x, y) {
      const glow = ctx.createRadialGradient(x, y, 2, x, y, 30);
      glow.addColorStop(0, "rgba(255, 214, 130, 0.35)");
      glow.addColorStop(1, "rgba(255, 214, 130, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 30, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#f2c879";
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#a9824a";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#fff3d6";
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  plant: {
    label: "planta",
    radius: 24,
    draw(ctx, x, y) {
      // pot
      ctx.fillStyle = "#8a5a34";
      roundRect(ctx, x - 11, y + 4, 22, 14, 3);
      ctx.fill();

      // leafy canopy — a few overlapping circles read as foliage
      ctx.fillStyle = "#2f6b3f";
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
      ctx.fillStyle = "#3d8752";
      ctx.beginPath();
      ctx.arc(x - 3, y - 6, 6, 0, Math.PI * 2);
      ctx.fill();
    },
  },

  crate: {
    label: "caja",
    radius: 26,
    draw(ctx, x, y, angle = 0) {
      rot(ctx, x, y, angle, () => {
        ctx.fillStyle = "#a97c46";
        roundRect(ctx, -22, -22, 44, 44, 3);
        ctx.fill();
        ctx.strokeStyle = "#6b4a26";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(-22, -22, 44, 44);

        ctx.strokeStyle = "#6b4a26";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-22, -22);
        ctx.lineTo(22, 22);
        ctx.moveTo(22, -22);
        ctx.lineTo(-22, 22);
        ctx.stroke();
      });
    },
  },

  table: {
    label: "mesa",
    radius: 40,
    draw(ctx, x, y, angle = 0) {
      rot(ctx, x, y, angle, () => {
        ctx.fillStyle = "#7a4f2c";
        roundRect(ctx, -42, -26, 84, 52, 6);
        ctx.fill();
        ctx.strokeStyle = "#4d3018";
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // corner legs peeking out from under the tabletop
        ctx.fillStyle = "#3f2716";
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
      ctx.fillStyle = "#5c3a20";
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#2e1c0f";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.strokeStyle = "#8a5a34";
      ctx.lineWidth = 1.4;
      [8, 14].forEach((r) => {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.stroke();
      });

      // stave lines
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 1;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        ctx.lineTo(x + Math.cos(a) * 19, y + Math.sin(a) * 19);
        ctx.stroke();
      }
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
