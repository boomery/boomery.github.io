export const CLIP_PRESETS = [
  { id: 'party_shen', label: '沈砚 · 站姿', loop: true },
  { id: 'shen_duanshui', label: '沈砚 · 断水', loop: false },
  { id: 'shen_pomen', label: '沈砚 · 破门', loop: false },
  { id: 'shen_hengdao', label: '沈砚 · 横刀', loop: false },
  { id: 'door_shen', label: '沈砚 · 死门', loop: false },
  { id: 'party_yan', label: '燕回 · 站姿', loop: true },
  { id: 'yan_feishi', label: '燕回 · 飞石', loop: false },
  { id: 'yan_lueying', label: '燕回 · 掠影', loop: false },
  { id: 'yan_dingxi', label: '燕回 · 定息', loop: false },
  { id: 'door_yan', label: '燕回 · 死门', loop: false },
  { id: 'party_su', label: '苏药 · 站姿', loop: true },
  { id: 'su_yinzhen', label: '苏药 · 银针', loop: false },
  { id: 'su_zhenyu', label: '苏药 · 鸩羽', loop: false },
  { id: 'su_zhixue', label: '苏药 · 止血', loop: false },
  { id: 'door_su', label: '苏药 · 死门', loop: false },
];

export function blankFrame(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function cloneFrame(frame) {
  return { width: frame.width, height: frame.height, data: new Uint8ClampedArray(frame.data) };
}

export function hexToRgb(hex) {
  const raw = String(hex || '').replace('#', '').trim();
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw.slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (!Number.isFinite(value)) return [0, 255, 0];
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function colorDist(data, i, kr, kg, kb) {
  const dr = data[i] - kr;
  const dg = data[i + 1] - kg;
  const db = data[i + 2] - kb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function pixelStep(data, a, b) {
  const dr = data[a] - data[b];
  const dg = data[a + 1] - data[b + 1];
  const db = data[a + 2] - data[b + 2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

export function sampleBackgroundColor(frame) {
  const pts = [];
  const stepX = Math.max(1, Math.floor(frame.width / 8));
  const stepY = Math.max(1, Math.floor(frame.height / 8));
  const push = (x, y) => {
    const i = (y * frame.width + x) * 4;
    pts.push([frame.data[i], frame.data[i + 1], frame.data[i + 2]]);
  };
  for (let x = 0; x < frame.width; x += stepX) {
    push(x, 0);
    push(Math.min(frame.width - 1, x), frame.height - 1);
  }
  for (let y = 0; y < frame.height; y += stepY) {
    push(0, y);
    push(frame.width - 1, Math.min(frame.height - 1, y));
  }
  const median = (channel) => {
    const values = pts.map((point) => point[channel]).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)] || 0;
  };
  return [median(0), median(1), median(2)];
}

export function chromaKey(frame, options = {}) {
  const color = options.color || [0, 255, 0];
  const kr = color[0];
  const kg = color[1];
  const kb = color[2];
  const tolerance = Math.max(0, Number(options.tolerance) || 0);
  const softness = Math.max(0, Number(options.softness) || 0);
  const despill = Math.min(1, Math.max(0, Number(options.despill) || 0));
  const inner = Math.max(0, tolerance - softness);
  const outer = tolerance + softness;
  const stepLimit = Math.min(32, Math.max(16, tolerance * 0.4));
  const data = frame.data;
  const w = frame.width;
  const h = frame.height;
  const n = w * h;
  const mask = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  const push = (p, from) => {
    if (p < 0 || p >= n || mask[p]) return;
    const i = p * 4;
    if (colorDist(data, i, kr, kg, kb) > outer) return;
    if (from >= 0 && pixelStep(data, i, from * 4) > stepLimit) return;
    mask[p] = 1;
    stack[top] = p;
    top += 1;
  };
  for (let x = 0; x < w; x += 1) {
    push(x, -1);
    push((h - 1) * w + x, -1);
  }
  for (let y = 1; y < h - 1; y += 1) {
    push(y * w, -1);
    push(y * w + w - 1, -1);
  }
  while (top) {
    top -= 1;
    const p = stack[top];
    const x = p % w;
    if (x > 0) push(p - 1, p);
    if (x + 1 < w) push(p + 1, p);
    if (p - w >= 0) push(p - w, p);
    if (p + w < n) push(p + w, p);
  }

  const spread = Math.max(kr, kg, kb) - Math.min(kr, kg, kb);
  let keyChan = 0;
  if (kg >= kr && kg >= kb) keyChan = 1;
  else if (kb >= kr && kb >= kg) keyChan = 2;
  const spillOn = despill > 0 && spread >= 48;
  const wash = (i, amount) => {
    const rgb = [data[i], data[i + 1], data[i + 2]];
    const other = keyChan === 0 ? Math.max(rgb[1], rgb[2]) : keyChan === 1 ? Math.max(rgb[0], rgb[2]) : Math.max(rgb[0], rgb[1]);
    const spill = rgb[keyChan] - other;
    if (spill > 0 && amount > 0) {
      rgb[keyChan] = Math.max(0, rgb[keyChan] - spill * amount);
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
    }
  };

  for (let p = 0; p < n; p += 1) {
    if (!mask[p]) continue;
    const i = p * 4;
    const dist = colorDist(data, i, kr, kg, kb);
    const prev = data[i + 3];
    let alpha = prev;
    if (dist <= inner || outer <= inner) alpha = 0;
    else alpha = Math.round(prev * ((dist - inner) / (outer - inner)));
    if (spillOn && alpha < prev) wash(i, despill * (1 - alpha / 255));
    data[i + 3] = alpha;
  }

  if (spillOn) {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const p = y * w + x;
        const i = p * 4;
        if (mask[p] || data[i + 3] === 0) continue;
        let touch = false;
        if (x > 0 && data[i - 4 + 3] === 0) touch = true;
        else if (x + 1 < w && data[i + 4 + 3] === 0) touch = true;
        else if (y > 0 && data[i - w * 4 + 3] === 0) touch = true;
        else if (y + 1 < h && data[i + w * 4 + 3] === 0) touch = true;
        if (touch) wash(i, despill);
      }
    }
  }
  return frame;
}

export function replaceWithTransparent(frame, options = {}) {
  const color = options.color || [0, 255, 0];
  const tolerance = Math.max(0, Number(options.tolerance) || 0);
  const softness = Math.max(0, Number(options.softness) || 0);
  const inner = Math.max(0, tolerance - softness);
  const outer = tolerance + softness;
  const data = frame.data;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const dist = colorDist(data, i, color[0], color[1], color[2]);
    if (dist > outer) continue;
    if (dist <= inner || outer <= inner) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 0;
      continue;
    }
    data[i + 3] = Math.round(data[i + 3] * ((dist - inner) / (outer - inner)));
  }
  return frame;
}

export function previewChroma(frame, options = {}) {
  const source = frame.original || frame.data;
  const copy = { width: frame.width, height: frame.height, data: new Uint8ClampedArray(source) };
  chromaKey(copy, options);
  const current = frame.data;
  const out = copy.data;
  const n = Math.min(current.length, out.length);
  for (let i = 0; i < n; i += 4) {
    if (current[i + 3] < out[i + 3]) {
      out[i] = current[i];
      out[i + 1] = current[i + 1];
      out[i + 2] = current[i + 2];
      out[i + 3] = current[i + 3];
    }
  }
  return copy;
}

export function fingerprint(frame, size = 16) {
  const out = new Float32Array(size * size);
  const sx = frame.width / size;
  const sy = frame.height / size;
  for (let y = 0; y < size; y += 1) {
    const py = Math.min(frame.height - 1, Math.floor((y + 0.5) * sy));
    for (let x = 0; x < size; x += 1) {
      const px = Math.min(frame.width - 1, Math.floor((x + 0.5) * sx));
      const i = (py * frame.width + px) * 4;
      const alpha = frame.data[i + 3] / 255;
      const luma = (frame.data[i] * 0.299 + frame.data[i + 1] * 0.587 + frame.data[i + 2] * 0.114) / 255;
      out[y * size + x] = luma * alpha;
    }
  }
  return out;
}

export function meanAbsDiff(a, b) {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) sum += Math.abs(a[i] - b[i]);
  return n ? (sum / n) * 255 : 0;
}

export function markDuplicates(frames, threshold) {
  const prints = frames.map((frame) => fingerprint(frame));
  const marked = [];
  let last = 0;
  for (let i = 1; i < frames.length; i += 1) {
    if (meanAbsDiff(prints[last], prints[i]) < threshold) marked.push(i);
    else last = i;
  }
  return marked;
}

export function findLoop(frames) {
  if (frames.length < 3) return null;
  const prints = frames.map((frame) => fingerprint(frame));
  let index = -1;
  let score = Infinity;
  for (let i = 2; i < prints.length; i += 1) {
    const diff = meanAbsDiff(prints[0], prints[i]);
    if (diff < score) {
      score = diff;
      index = i;
    }
  }
  return { index, score };
}

export function findJumps(frames, factor = 2.4) {
  if (frames.length < 3) return [];
  const prints = frames.map((frame) => fingerprint(frame));
  const diffs = [];
  for (let i = 1; i < prints.length; i += 1) diffs.push(meanAbsDiff(prints[i - 1], prints[i]));
  const sorted = diffs.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)] || 1;
  const hits = [];
  diffs.forEach((diff, i) => {
    if (diff > Math.max(18, median * factor)) hits.push(i + 1);
  });
  return hits;
}

export function keepIndices(count, step) {
  const n = Math.max(1, step | 0);
  const keep = [];
  for (let i = 0; i < count; i += n) keep.push(i);
  if (count > 0 && keep[keep.length - 1] !== count - 1) keep.push(count - 1);
  return keep;
}

export function opaqueBounds(frame, alpha = 16) {
  let minX = frame.width;
  let minY = frame.height;
  let maxX = -1;
  let maxY = -1;
  const data = frame.data;
  for (let y = 0; y < frame.height; y += 1) {
    const row = y * frame.width;
    for (let x = 0; x < frame.width; x += 1) {
      if (data[(row + x) * 4 + 3] > alpha) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { minX, minY, maxX, maxY };
}

export function footPoint(frame, alpha = 16) {
  const bounds = opaqueBounds(frame, alpha);
  if (!bounds) return { x: (frame.width - 1) / 2, y: frame.height - 1, bounds: null };
  const y0 = Math.max(bounds.minY, bounds.maxY - 4);
  let sum = 0;
  let n = 0;
  for (let y = y0; y <= bounds.maxY; y += 1) {
    const row = y * frame.width;
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      if (frame.data[(row + x) * 4 + 3] > alpha) {
        sum += x;
        n += 1;
      }
    }
  }
  return {
    x: n ? sum / n : (bounds.minX + bounds.maxX) / 2,
    y: bounds.maxY,
    bounds,
  };
}

function samplePixel(frame, x, y, smooth) {
  if (x < -1 || y < -1 || x > frame.width || y > frame.height) return [0, 0, 0, 0];
  if (!smooth) {
    const ix = Math.min(frame.width - 1, Math.max(0, Math.round(x)));
    const iy = Math.min(frame.height - 1, Math.max(0, Math.round(y)));
    if (x < -0.5 || y < -0.5 || x > frame.width - 0.5 || y > frame.height - 0.5) return [0, 0, 0, 0];
    const i = (iy * frame.width + ix) * 4;
    return [frame.data[i], frame.data[i + 1], frame.data[i + 2], frame.data[i + 3]];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const pick = (px, py) => {
    if (px < 0 || py < 0 || px >= frame.width || py >= frame.height) return [0, 0, 0, 0];
    const i = (py * frame.width + px) * 4;
    return [frame.data[i], frame.data[i + 1], frame.data[i + 2], frame.data[i + 3]];
  };
  const a = pick(x0, y0);
  const b = pick(x0 + 1, y0);
  const c = pick(x0, y0 + 1);
  const d = pick(x0 + 1, y0 + 1);
  const mix = (k) => a[k] * (1 - tx) * (1 - ty) + b[k] * tx * (1 - ty) + c[k] * (1 - tx) * ty + d[k] * tx * ty;
  return [mix(0), mix(1), mix(2), mix(3)];
}

export function alignFrames(frames, width, height, options = {}) {
  const pad = Math.max(0, options.pad ?? 12);
  const smooth = options.smooth !== false;
  const feet = frames.map((frame) => footPoint(frame));
  let maxW = 1;
  let maxH = 1;
  feet.forEach((foot) => {
    if (!foot.bounds) return;
    maxW = Math.max(maxW, foot.bounds.maxX - foot.bounds.minX + 1);
    maxH = Math.max(maxH, foot.y - foot.bounds.minY + 1);
  });
  const availW = Math.max(1, width - pad * 2);
  const availH = Math.max(1, height - pad * 2);
  const scale = Math.min(availW / maxW, availH / maxH);
  const anchorX = Math.round(width / 2);
  const anchorY = height - pad;
  const aligned = frames.map((frame, index) => {
    const dest = blankFrame(width, height);
    const foot = feet[index];
    for (let y = 0; y < height; y += 1) {
      const sy = foot.y + (y - anchorY) / scale;
      for (let x = 0; x < width; x += 1) {
        const sx = foot.x + (x - anchorX) / scale;
        const pixel = samplePixel(frame, sx, sy, smooth);
        const i = (y * width + x) * 4;
        dest.data[i] = pixel[0];
        dest.data[i + 1] = pixel[1];
        dest.data[i + 2] = pixel[2];
        dest.data[i + 3] = pixel[3];
      }
    }
    return dest;
  });
  return { frames: aligned, anchor: [anchorX, anchorY], scale };
}

export function packSheet(frames, maxWidth = 4096) {
  if (!frames.length) throw new Error('没有画面');
  const fw = frames[0].width;
  const fh = frames[0].height;
  for (const frame of frames) {
    if (frame.width !== fw || frame.height !== fh) throw new Error('画面尺寸不一致，请先对齐脚底');
  }
  const columns = Math.max(1, Math.min(frames.length, Math.floor(maxWidth / fw)));
  const rows = Math.ceil(frames.length / columns);
  const sheet = blankFrame(columns * fw, rows * fh);
  frames.forEach((frame, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const ox = col * fw;
    const oy = row * fh;
    for (let y = 0; y < fh; y += 1) {
      const src = (y * fw) * 4;
      const dst = ((oy + y) * sheet.width + ox) * 4;
      sheet.data.set(frame.data.subarray(src, src + fw * 4), dst);
    }
  });
  return { sheet, columns, rows, frameWidth: fw, frameHeight: fh };
}

export function buildClipManifest(id, frames, packed, options) {
  return {
    version: 1,
    id,
    fps: options.fps,
    loop: Boolean(options.loop),
    frameCount: frames.length,
    frameWidth: packed.frameWidth,
    frameHeight: packed.frameHeight,
    columns: packed.columns,
    anchor: options.anchor,
  };
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i += 1) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

export function zipStore(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    const localBytes = new Uint8Array(local.buffer);
    locals.push(localBytes, name, data);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, data.length, true);
    central.setUint32(24, data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centrals.push(new Uint8Array(central.buffer), name);
    offset += localBytes.length + name.length + data.length;
  });
  const centralBytes = concatBytes(centrals);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralBytes.length, true);
  end.setUint32(16, offset, true);
  return concatBytes([...locals, centralBytes, new Uint8Array(end.buffer)]);
}
