// ============================================================
// INPUT — WASD / arrow-key movement, normalized for diagonals.
// ============================================================
export function createKeyboard() {
  const keys = new Set();

  window.addEventListener("keydown", (e) => keys.add(e.key.toLowerCase()));
  window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  return {
    getMoveVector() {
      let dx = 0;
      let dy = 0;
      if (keys.has("w") || keys.has("arrowup")) dy -= 1;
      if (keys.has("s") || keys.has("arrowdown")) dy += 1;
      if (keys.has("a") || keys.has("arrowleft")) dx -= 1;
      if (keys.has("d") || keys.has("arrowright")) dx += 1;

      if (dx !== 0 && dy !== 0) {
        const inv = 1 / Math.sqrt(2);
        dx *= inv;
        dy *= inv;
      }
      return { dx, dy };
    },
  };
}
