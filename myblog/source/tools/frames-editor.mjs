function offset(width, x, y) {
  return (y * width + x) * 4;
}

function covers(selection, x, y) {
  if (!selection || selection.w <= 0 || selection.h <= 0) return true;
  return x >= selection.x && y >= selection.y && x < selection.x + selection.w && y < selection.y + selection.h;
}

function blend(target, index, color) {
  const srcA = color[3] / 255;
  if (srcA <= 0) return;
  const dstA = target[index + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) {
    target[index] = 0;
    target[index + 1] = 0;
    target[index + 2] = 0;
    target[index + 3] = 0;
    return;
  }
  for (let channel = 0; channel < 3; channel += 1) {
    const mixed = color[channel] * srcA + target[index + channel] * dstA * (1 - srcA);
    target[index + channel] = Math.round(mixed / outA);
  }
  target[index + 3] = Math.round(outA * 255);
}

function visitDisk(width, height, cx, cy, radius, selection, paint) {
  const reach = Math.max(0.5, radius);
  const x0 = Math.max(0, Math.floor(cx - reach));
  const y0 = Math.max(0, Math.floor(cy - reach));
  const x1 = Math.min(width - 1, Math.ceil(cx + reach));
  const y1 = Math.min(height - 1, Math.ceil(cy + reach));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      if (!covers(selection, x, y)) continue;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      if (dx * dx + dy * dy > reach * reach) continue;
      paint(x, y, offset(width, x, y));
    }
  }
}

export function paintDisk(target, width, height, cx, cy, radius, color, selection) {
  visitDisk(width, height, cx, cy, radius, selection, (_x, _y, index) => blend(target, index, color));
}

export function eraseDisk(target, width, height, cx, cy, radius, strength, selection) {
  const keep = 1 - Math.min(255, Math.max(0, strength)) / 255;
  visitDisk(width, height, cx, cy, radius, selection, (_x, _y, index) => {
    const alpha = Math.round(target[index + 3] * keep);
    target[index + 3] = alpha;
    if (alpha === 0) {
      target[index] = 0;
      target[index + 1] = 0;
      target[index + 2] = 0;
    }
  });
}

export function restoreDisk(target, source, width, height, cx, cy, radius, selection) {
  visitDisk(width, height, cx, cy, radius, selection, (_x, _y, index) => {
    target[index] = source[index];
    target[index + 1] = source[index + 1];
    target[index + 2] = source[index + 2];
    target[index + 3] = source[index + 3];
  });
}

export function tintDisk(target, width, height, cx, cy, radius, color, selection) {
  const strength = Math.min(255, Math.max(0, color[3])) / 255;
  if (strength <= 0) return;
  visitDisk(width, height, cx, cy, radius, selection, (_x, _y, index) => {
    if (target[index + 3] < 8) return;
    for (let channel = 0; channel < 3; channel += 1) {
      target[index + channel] = Math.round(target[index + channel] * (1 - strength) + color[channel] * strength);
    }
  });
}

export function blurDisk(target, source, width, height, cx, cy, radius, selection) {
  visitDisk(width, height, cx, cy, radius, selection, (x, y, index) => {
    let red = 0;
    let green = 0;
    let blue = 0;
    let alpha = 0;
    let count = 0;
    for (let ky = -1; ky <= 1; ky += 1) {
      for (let kx = -1; kx <= 1; kx += 1) {
        const sx = x + kx;
        const sy = y + ky;
        if (sx < 0 || sy < 0 || sx >= width || sy >= height) continue;
        const sample = offset(width, sx, sy);
        const sampleAlpha = source[sample + 3];
        red += source[sample] * sampleAlpha;
        green += source[sample + 1] * sampleAlpha;
        blue += source[sample + 2] * sampleAlpha;
        alpha += sampleAlpha;
        count += 1;
      }
    }
    if (count === 0 || alpha === 0) {
      target[index] = 0;
      target[index + 1] = 0;
      target[index + 2] = 0;
      target[index + 3] = 0;
      return;
    }
    target[index] = Math.round(red / alpha);
    target[index + 1] = Math.round(green / alpha);
    target[index + 2] = Math.round(blue / alpha);
    target[index + 3] = Math.round(alpha / count);
  });
}

export function floodFill(target, width, height, sx, sy, color, selection) {
  const x = Math.floor(sx);
  const y = Math.floor(sy);
  if (x < 0 || y < 0 || x >= width || y >= height || !covers(selection, x, y)) return 0;
  const start = offset(width, x, y);
  const seed = [target[start], target[start + 1], target[start + 2], target[start + 3]];
  if (seed[0] === color[0] && seed[1] === color[1] && seed[2] === color[2] && seed[3] === color[3]) return 0;
  const tolerance = 28;
  const matches = (index) => Math.abs(target[index] - seed[0]) <= tolerance
    && Math.abs(target[index + 1] - seed[1]) <= tolerance
    && Math.abs(target[index + 2] - seed[2]) <= tolerance
    && Math.abs(target[index + 3] - seed[3]) <= tolerance;
  const seen = new Uint8Array(width * height);
  const stack = [y * width + x];
  seen[y * width + x] = 1;
  let count = 0;
  while (stack.length) {
    const pixel = stack.pop();
    const px = pixel % width;
    const py = (pixel - px) / width;
    const index = pixel * 4;
    if (!matches(index)) continue;
    blend(target, index, color);
    count += 1;
    const next = [[px + 1, py], [px - 1, py], [px, py + 1], [px, py - 1]];
    next.forEach(([nx, ny]) => {
      if (nx < 0 || ny < 0 || nx >= width || ny >= height || !covers(selection, nx, ny)) return;
      const id = ny * width + nx;
      if (seen[id]) return;
      seen[id] = 1;
      stack.push(id);
    });
  }
  return count;
}

function bounds(x0, y0, x1, y1, width, height) {
  const left = Math.max(0, Math.floor(Math.min(x0, x1)));
  const top = Math.max(0, Math.floor(Math.min(y0, y1)));
  const right = Math.min(width - 1, Math.ceil(Math.max(x0, x1)));
  const bottom = Math.min(height - 1, Math.ceil(Math.max(y0, y1)));
  return { left, top, right, bottom };
}

export function fillRect(target, width, height, x0, y0, x1, y1, color, selection) {
  const box = bounds(x0, y0, x1, y1, width, height);
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      if (!covers(selection, x, y)) continue;
      blend(target, offset(width, x, y), color);
    }
  }
}

export function fillEllipse(target, width, height, x0, y0, x1, y1, color, selection) {
  const box = bounds(x0, y0, x1, y1, width, height);
  const cx = (Math.min(x0, x1) + Math.max(x0, x1)) / 2;
  const cy = (Math.min(y0, y1) + Math.max(y0, y1)) / 2;
  const rx = Math.max(0.5, Math.abs(x1 - x0) / 2);
  const ry = Math.max(0.5, Math.abs(y1 - y0) / 2);
  for (let y = box.top; y <= box.bottom; y += 1) {
    for (let x = box.left; x <= box.right; x += 1) {
      if (!covers(selection, x, y)) continue;
      const nx = (x + 0.5 - cx) / rx;
      const ny = (y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      blend(target, offset(width, x, y), color);
    }
  }
}

export function copyChangedPixels(before, after, width, height, frames) {
  const changed = [];
  for (let index = 0; index < before.length; index += 4) {
    if (before[index] !== after[index] || before[index + 1] !== after[index + 1] || before[index + 2] !== after[index + 2] || before[index + 3] !== after[index + 3]) {
      changed.push(index);
    }
  }
  let applied = 0;
  let skipped = 0;
  frames.forEach((frame) => {
    if (frame.width !== width || frame.height !== height || frame.data.length !== after.length) {
      skipped += 1;
      return;
    }
    changed.forEach((index) => {
      frame.data[index] = after[index];
      frame.data[index + 1] = after[index + 1];
      frame.data[index + 2] = after[index + 2];
      frame.data[index + 3] = after[index + 3];
    });
    if (changed.length) applied += 1;
  });
  return { applied, skipped, pixels: changed.length };
}

export function createEditSession(width, height, data) {
  let current = new Uint8ClampedArray(data);
  const opened = new Uint8ClampedArray(data);
  const undo = [];
  const redo = [];
  let strokeBase = new Uint8ClampedArray(current);

  function remember() {
    undo.push(new Uint8ClampedArray(current));
    if (undo.length > 24) undo.shift();
    redo.length = 0;
    strokeBase = new Uint8ClampedArray(current);
  }

  function replace(next) {
    current = new Uint8ClampedArray(next);
  }

  return {
    width,
    height,
    pixels() { return current; },
    strokeBase() { return strokeBase; },
    isDirty() {
      for (let index = 0; index < current.length; index += 1) {
        if (current[index] !== opened[index]) return true;
      }
      return false;
    },
    canUndo() { return undo.length > 0; },
    canRedo() { return redo.length > 0; },
    begin() { remember(); },
    undo() {
      if (!undo.length) return false;
      redo.push(new Uint8ClampedArray(current));
      replace(undo.pop());
      return true;
    },
    redo() {
      if (!redo.length) return false;
      undo.push(new Uint8ClampedArray(current));
      replace(redo.pop());
      return true;
    },
    reset() {
      if (!this.isDirty()) return false;
      remember();
      replace(opened);
      return true;
    },
    paintBrush(cx, cy, radius, color, selection) {
      paintDisk(current, width, height, cx, cy, radius, color, selection);
    },
    eraseBrush(cx, cy, radius, strength, selection) {
      eraseDisk(current, width, height, cx, cy, radius, strength, selection);
    },
    restoreBrush(cx, cy, radius, selection) {
      restoreDisk(current, opened, width, height, cx, cy, radius, selection);
    },
    tintBrush(cx, cy, radius, color, selection) {
      tintDisk(current, width, height, cx, cy, radius, color, selection);
    },
    blurBrush(cx, cy, radius, selection) {
      blurDisk(current, strokeBase, width, height, cx, cy, radius, selection);
    },
    fill(x, y, color, selection) {
      return floodFill(current, width, height, x, y, color, selection);
    },
    rect(x0, y0, x1, y1, color, selection) {
      fillRect(current, width, height, x0, y0, x1, y1, color, selection);
    },
    ellipse(x0, y0, x1, y1, color, selection) {
      fillEllipse(current, width, height, x0, y0, x1, y1, color, selection);
    },
    commit() { return new Uint8ClampedArray(current); },
    changedFromOpen() {
      return { before: opened, after: current, width, height };
    },
  };
}
