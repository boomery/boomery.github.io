import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIP_PRESETS,
  chromaKey,
  replaceWithTransparent,
  clearRect,
  sampleHue,
  clearHueBlobs,
  previewChroma,
  markDuplicates,
  findLoop,
  keepIndices,
  alignFrames,
  packSheet,
  zipStore,
  crc32,
  buildClipManifest,
} from '../myblog/source/tools/frames.mjs';
import {
  createEditSession,
  copyChangedPixels,
} from '../myblog/source/tools/frames-editor.mjs';

function frame(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = pixel[0];
      data[i + 1] = pixel[1];
      data[i + 2] = pixel[2];
      data[i + 3] = pixel[3];
    }
  }
  return { width, height, data };
}

test('色键去掉绿幕并洗掉绿边', () => {
  const shot = frame(2, 1, (x) => (x === 0 ? [0, 255, 0, 255] : [10, 200, 10, 255]));
  chromaKey(shot, { color: [0, 255, 0], tolerance: 40, softness: 0, despill: 1 });
  assert.equal(shot.data[3], 0);
  assert.equal(shot.data[7], 255);
  assert.ok(shot.data[5] < 40);
});

test('纯色背景不会把人物暗部抠穿', () => {
  const shot = frame(7, 7, (x, y) => {
    const inside = x >= 2 && x <= 4 && y >= 2 && y <= 4;
    if (!inside) return [12, 28, 14, 255];
    return [52, 28, 14, 255];
  });
  chromaKey(shot, { color: [12, 28, 14], tolerance: 80, softness: 21, despill: 0.85 });
  assert.equal(shot.data[3], 0);
  const cloth = (3 * 7 + 3) * 4;
  assert.equal(shot.data[cloth + 3], 255);
  assert.equal(shot.data[cloth], 52);
});

test('柔化边缘保留半透明', () => {
  const shot = frame(1, 1, () => [0, 215, 0, 255]);
  chromaKey(shot, { color: [0, 255, 0], tolerance: 40, softness: 10, despill: 0 });
  assert.equal(shot.data[3], 128);
});

test('重复帧、循环点和减帧', () => {
  const a = frame(4, 4, () => [20, 20, 20, 255]);
  const b = frame(4, 4, () => [20, 20, 20, 255]);
  const c = frame(4, 4, (x) => [x * 40, 10, 10, 255]);
  const back = frame(4, 4, () => [20, 20, 20, 255]);
  assert.deepEqual(markDuplicates([a, b, c], 8), [1]);
  const loop = findLoop([a, c, back]);
  assert.equal(loop.index, 2);
  assert.deepEqual(keepIndices(7, 2), [0, 2, 4, 6]);
});

test('脚底对齐后锚点落在画面中下', () => {
  const shot = frame(4, 4, (x, y) => (x === 1 && y === 3 ? [180, 40, 40, 255] : [0, 0, 0, 0]));
  const aligned = alignFrames([shot], 10, 10, { pad: 1, smooth: false });
  assert.deepEqual(aligned.anchor, [5, 9]);
  const i = (9 * 10 + 5) * 4;
  assert.ok(aligned.frames[0].data[i + 3] > 200);
});

test('精灵图和素材包清单', () => {
  const shots = [frame(2, 2, () => [1, 2, 3, 255]), frame(2, 2, () => [4, 5, 6, 255])];
  const packed = packSheet(shots, 8);
  assert.equal(packed.columns, 2);
  assert.equal(packed.sheet.width, 4);
  const manifest = buildClipManifest('shen_duanshui', shots, packed, { fps: 12, loop: false, anchor: [1, 1] });
  assert.equal(manifest.id, 'shen_duanshui');
  assert.equal(manifest.frameCount, 2);
  assert.ok(CLIP_PRESETS.some((item) => item.id === 'shen_duanshui'));
  assert.ok(CLIP_PRESETS.some((item) => item.id === 'yan_lueying' && item.loop === false));
});

test('透明替换去掉指定颜色，不要求连着边缘', () => {
  const shot = frame(3, 3, (x, y) => {
    if (x === 1 && y === 1) return [0, 250, 0, 255];
    if (x === 2 && y === 1) return [0, 230, 0, 255];
    return [180, 40, 40, 255];
  });
  replaceWithTransparent(shot, { color: [0, 255, 0], tolerance: 8, softness: 0 });
  assert.equal(shot.data[(1 * 3 + 1) * 4 + 3], 0);
  assert.equal(shot.data[(1 * 3 + 2) * 4 + 3], 255);
  assert.equal(shot.data[3], 255);
});

test('去色溢洗掉不贴边的头发绿', () => {
  const shot = frame(5, 5, (x, y) => {
    const edge = x === 0 || y === 0 || x === 4 || y === 4;
    if (edge) return [0, 255, 0, 255];
    if (x === 2 && y === 2) return [40, 160, 30, 255];
    return [90, 70, 50, 255];
  });
  chromaKey(shot, { color: [0, 255, 0], tolerance: 30, softness: 0, despill: 1 });
  const hair = (2 * 5 + 2) * 4;
  assert.equal(shot.data[hair + 3], 255);
  assert.ok(shot.data[hair + 1] <= 40);
  const skin = (1 * 5 + 1) * 4;
  assert.equal(shot.data[skin + 1], 70);
});

test('矩形遮罩把框住的区域变成透明', () => {
  const shot = frame(4, 4, () => [10, 20, 30, 255]);
  clearRect(shot, { x0: 2.2, y0: 1.1, x1: 3.8, y1: 2.9 });
  assert.equal(shot.data[(1 * 4 + 2) * 4 + 3], 0);
  assert.equal(shot.data[(2 * 4 + 3) * 4 + 3], 0);
  assert.equal(shot.data[3], 255);
});

test('圈选替换按色相去掉每一帧的整块，身体留着', () => {
  const paint = (greenAt) => frame(6, 6, (x, y) => {
    if (greenAt.some(([gx, gy]) => gx === x && gy === y)) return [40, 180, 50, 255];
    if (x === 5 && y === 1) return [150, 150, 150, 255];
    return [180, 120, 90, 255];
  });
  const current = paint([[4, 1], [4, 2], [5, 2]]);
  const other = paint([[1, 4], [1, 5]]);
  const loop = [
    { x: 3.2, y: 0.2 },
    { x: 5.8, y: 0.2 },
    { x: 5.8, y: 2.8 },
    { x: 3.2, y: 2.8 },
  ];
  const target = sampleHue(current, loop);
  assert.ok(target);
  clearHueBlobs(current, target);
  clearHueBlobs(other, target);
  assert.equal(current.data[(1 * 6 + 4) * 4 + 3], 0);
  assert.equal(current.data[(2 * 6 + 5) * 4 + 3], 0);
  assert.equal(current.data[(1 * 6 + 5) * 4 + 3], 255);
  assert.equal(current.data[(4 * 6 + 1) * 4 + 3], 255);
  assert.equal(other.data[(4 * 6 + 1) * 4 + 3], 0);
  assert.equal(other.data[(5 * 6 + 1) * 4 + 3], 0);
  assert.equal(other.data[(3 * 6 + 3) * 4 + 3], 255);
});

test('预览抠图时保留已经换成透明的像素', () => {
  const shot = frame(3, 3, (x, y) => {
    if (x === 1 && y === 1) return [200, 30, 30, 255];
    return [0, 255, 0, 255];
  });
  shot.original = new Uint8ClampedArray(shot.data);
  replaceWithTransparent(shot, { color: [200, 30, 30], tolerance: 0, softness: 0 });
  const preview = previewChroma(shot, { color: [0, 255, 0], tolerance: 8, softness: 0, despill: 0 });
  assert.equal(preview.data[(1 * 3 + 1) * 4 + 3], 0);
  assert.equal(preview.data[3], 0);
});

test('编辑帧可以涂、擦、填、误除，并且能撤销', () => {
  const session = createEditSession(4, 4, frame(4, 4, (x, y) => (x < 2 ? [0, 180, 0, 255] : [0, 0, 0, 0])).data);
  session.begin();
  session.eraseBrush(0.5, 0.5, 1, 255, null);
  assert.equal(session.pixels()[3], 0);
  session.restoreBrush(0.5, 0.5, 1, null);
  assert.equal(session.pixels()[3], 255);
  session.begin();
  session.paintBrush(3.5, 3.5, 1, [20, 40, 60, 255], null);
  assert.equal(session.pixels()[(3 * 4 + 3) * 4], 20);
  session.undo();
  assert.equal(session.pixels()[(3 * 4 + 3) * 4 + 3], 0);
  session.redo();
  assert.equal(session.pixels()[(3 * 4 + 3) * 4], 20);
  session.begin();
  session.fill(0, 0, [9, 9, 9, 255], { x: 0, y: 0, w: 2, h: 4 });
  assert.equal(session.pixels()[0], 9);
  assert.equal(session.pixels()[(0 * 4 + 2) * 4 + 3], 0);
  session.begin();
  session.rect(0, 0, 1, 1, [1, 2, 3, 255], null);
  session.ellipse(2, 2, 3.2, 3.2, [4, 5, 6, 255], null);
  assert.equal(session.pixels()[0], 1);
  assert.ok(session.pixels()[(3 * 4 + 3) * 4 + 3] > 0);
  const before = new Uint8ClampedArray(session.changedFromOpen().before);
  const after = session.pixels();
  const other = frame(4, 4, () => [7, 7, 7, 255]);
  const mismatch = frame(3, 3, () => [1, 1, 1, 255]);
  const copied = copyChangedPixels(before, after, 4, 4, [other, mismatch]);
  assert.equal(copied.applied, 1);
  assert.equal(copied.skipped, 1);
  assert.equal(other.data[0], after[0]);
  session.reset();
  assert.equal(session.isDirty(), false);
});

test('zip 能按原样装回文件', () => {
  const hello = new TextEncoder().encode('hello');
  assert.equal(crc32(hello), 0x3610a686);
  const zip = zipStore([{ name: 'clips/a.json', data: hello }]);
  assert.equal(zip[0], 0x50);
  assert.equal(zip[1], 0x4b);
  const nameAt = 30;
  const name = new TextDecoder().decode(zip.subarray(nameAt, nameAt + 'clips/a.json'.length));
  assert.equal(name, 'clips/a.json');
  const payload = zip.subarray(nameAt + name.length, nameAt + name.length + hello.length);
  assert.equal(new TextDecoder().decode(payload), 'hello');
});
