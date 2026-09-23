const A4_W = 595.2755905511812;
const A4_H = 841.8897637795277;
const CONTENT_LIMIT = A4_H - 60;
const INDEXED = [
  '00000000', '00FFFFFF', '00FF0000', '0000FF00', '000000FF', '00FFFF00', '00FF00FF', '0000FFFF',
  '00000000', '00FFFFFF', '00FF0000', '0000FF00', '000000FF', '00FFFF00', '00FF00FF', '0000FFFF',
  '00800000', '00008000', '00000080', '00808000', '00800080', '00008080', '00C0C0C0', '00808080',
  '009999FF', '00993366', '00FFFFCC', '00CCFFFF', '00660066', '00FF8080', '000066CC', '00CCCCFF',
  '00000080', '00FF00FF', '00FFFF00', '0000FFFF', '00800080', '00800000', '00008080', '000000FF',
  '0000CCFF', '00CCFFFF', '00CCFFCC', '00FFFF99', '0099CCFF', '00FF99CC', '00CC99FF', '00FFCC99',
  '003366FF', '0033CCCC', '0099CC00', '00FFCC00', '00FF9900', '00FF6600', '00666699', '00969696',
  '00003366', '00339966', '00003300', '00333300', '00993300', '00993366', '00333399', '00333333',
];

const THEME_TAGS = ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'];
const DEFAULT_THEME = ['FFFFFF', '000000', 'EEECE1', '1F497D', '4F81BD', 'C0504D', '9BBB59', '8064A2', '4BACC6', 'F79646', '0000FF', '800080'].map(hexToRgb);

function hexToRgb(hex) {
  const h = String(hex).replace(/^#/, '').slice(-6);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function applyTint(rgb, tint) {
  if (!tint) return rgb;
  return rgb.map((channel) => {
    const value = channel * 255;
    const next = tint < 0 ? value * (1 + tint) : value * (1 - tint) + 255 * tint;
    return Math.min(255, Math.max(0, next)) / 255;
  });
}

function parseTheme(xml) {
  if (!xml) return DEFAULT_THEME;
  const scheme = xml.match(/<a:clrScheme[\s\S]*?<\/a:clrScheme>/);
  if (!scheme) return DEFAULT_THEME;
  const fileColors = THEME_TAGS.map((name) => {
    const block = scheme[0].match(new RegExp(`<a:${name}>([\\s\\S]*?)</a:${name}>`));
    const srgb = block && block[1].match(/srgbClr val="([0-9A-Fa-f]{6})"/);
    const last = block && block[1].match(/lastClr="([0-9A-Fa-f]{6})"/);
    return hexToRgb((srgb || last || [, '000000'])[1]);
  });
  const theme = fileColors.slice();
  [theme[0], theme[1]] = [theme[1], theme[0]];
  [theme[2], theme[3]] = [theme[3], theme[2]];
  return theme;
}

function colorOf(color, theme, fallback) {
  if (!color || color.auto) return fallback;
  if (color.argb && color.argb !== '00000000') return hexToRgb(color.argb);
  if (typeof color.indexed === 'number') {
    if (color.indexed === 64) return [0, 0, 0];
    if (color.indexed === 65) return [1, 1, 1];
    if (INDEXED[color.indexed]) return hexToRgb(INDEXED[color.indexed]);
  }
  if (typeof color.theme === 'number' && theme[color.theme]) {
    return applyTint(theme[color.theme], Number(color.tint) || 0);
  }
  return fallback;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDate(value, withTime) {
  const date = `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  if (!withTime) return date;
  return `${date} ${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
}

function cellText(value, withTime) {
  if (value == null) return '';
  if (value instanceof Date) return formatDate(value, withTime);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    if (Number.isInteger(value)) return String(value);
    return String(Math.round(value * 1e8) / 1e8);
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text || '').join('');
    if ('result' in value && value.result !== undefined) return cellText(value.result, withTime);
    if (value.text != null && (value.hyperlink != null || value.tooltip != null)) return cellText(value.text, withTime);
    if (value.error) return String(value.error);
    return '';
  }
  return String(value);
}

function textAlign(cell, ctx) {
  const align = cell.alignment && cell.alignment.horizontal;
  if (align === 'left' || align === 'right') return align;
  if (align === 'center' || align === 'centerContinuous') return 'center';
  if (ctx.notice || ctx.household) return 'center';
  const value = cell.value && typeof cell.value === 'object' && 'result' in cell.value ? cell.value.result : cell.value;
  return typeof value === 'number' ? 'right' : 'left';
}

function fontSizeOf(cell) {
  if (cell.font && cell.font.size) return Number(cell.font.size);
  const parts = cell.value && cell.value.richText;
  if (Array.isArray(parts)) {
    const found = parts.find((part) => part.font && part.font.size);
    if (found) return Number(found.font.size);
  }
  return 9;
}

function decodeAddr(addr) {
  const match = /^([A-Z]+)(\d+)$/i.exec(String(addr).trim());
  if (!match) return { col: 1, row: 1 };
  let col = 0;
  for (const ch of match[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col, row: Number(match[2]) };
}

function parseMerge(raw) {
  const [start, end] = String(raw).split(':');
  const a = decodeAddr(start);
  const b = decodeAddr(end || start);
  return {
    minRow: Math.min(a.row, b.row),
    maxRow: Math.max(a.row, b.row),
    minCol: Math.min(a.col, b.col),
    maxCol: Math.max(a.col, b.col),
  };
}

function range(start, end) {
  const rows = [];
  for (let row = start; row <= end; row += 1) rows.push(row);
  return rows;
}

function textWidth(font, text, size) {
  try {
    return font.widthOfTextAtSize(text, size);
  } catch (error) {
    return Array.from(text).length * size;
  }
}

function wrapText(text, font, size, width) {
  const lines = [];
  const limit = Math.max(4, width);
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of Array.from(para)) {
      if (line && textWidth(font, line + ch, size) > limit) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

function anchorCell(anchor) {
  if (!anchor) return { col: 0, row: 0 };
  const col = anchor.nativeCol != null ? anchor.nativeCol : anchor.col || 0;
  const row = anchor.nativeRow != null ? anchor.nativeRow : anchor.row || 0;
  return { col: Math.floor(col), row: Math.floor(row) };
}

function toBytes(buffer) {
  if (!buffer) return null;
  if (buffer instanceof Uint8Array) return buffer;
  return new Uint8Array(buffer);
}

function sheetImages(sheet) {
  try {
    return sheet.getImages() || [];
  } catch (error) {
    return [];
  }
}

function usedBounds(sheet, images) {
  let maxRow = 0;
  let maxCol = 0;
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      maxRow = Math.max(maxRow, rowNumber);
      maxCol = Math.max(maxCol, colNumber);
    });
  });
  for (const raw of sheet.model.merges || []) {
    const box = parseMerge(raw);
    maxRow = Math.max(maxRow, box.maxRow);
    maxCol = Math.max(maxCol, box.maxCol);
  }
  for (const image of images) {
    const tl = anchorCell(image.range && image.range.tl);
    const br = anchorCell(image.range && image.range.br);
    maxRow = Math.max(maxRow, tl.row + 1, br.row);
    maxCol = Math.max(maxCol, tl.col + 1, br.col);
  }
  const dimCol = sheet.columnCount || 0;
  if (dimCol > maxCol && dimCol <= Math.max(maxCol + 2, 30)) maxCol = dimCol;
  return { maxRow, maxCol };
}

function hasContent(sheet) {
  let found = false;
  sheet.eachRow({ includeEmpty: false }, (row) => {
    if (found) return;
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cellText(cell.value, false).trim()) found = true;
    });
  });
  return found || sheetImages(sheet).length > 0;
}

function selectSheets(workbook) {
  const visible = workbook.worksheets.filter((sheet) => sheet.state !== 'hidden' && sheet.state !== 'veryHidden');
  const pool = visible.length ? visible : workbook.worksheets.slice();
  const picked = pool.filter(hasContent);
  if (!picked.length) throw new Error('这个表格里没有可导出的内容');
  return picked;
}

function sheetHasText(sheet, needle, maxRow, maxCol) {
  for (let row = 1; row <= maxRow; row += 1) {
    const line = sheet.getRow(row);
    for (let col = 1; col <= maxCol; col += 1) {
      if (cellText(line.getCell(col).value, false).includes(needle)) return true;
    }
  }
  return false;
}

function noticeMarkers(sheet, maxRow) {
  const starts = [];
  for (let row = 1; row <= maxRow; row += 1) {
    if (cellText(sheet.getRow(row).getCell(2).value, true).startsWith('混凝土工程/')) starts.push(row);
  }
  return starts;
}

function contentEnd(sheet, maxRow, maxCol, boxes) {
  let last = 1;
  for (let row = 1; row <= maxRow; row += 1) {
    const line = sheet.getRow(row);
    line.eachCell({ includeEmpty: false }, (cell, col) => {
      if (col <= maxCol && cellText(cell.value, false).trim()) last = Math.max(last, row);
    });
  }
  for (const box of boxes) {
    if (box.minRow <= last) last = Math.max(last, box.maxRow);
  }
  return Math.min(maxRow, last);
}

function buildColumns(sheet, maxCol, household) {
  const fallback = sheet.properties.defaultColWidth || 8.43;
  const raw = [];
  for (let col = 1; col <= maxCol; col += 1) {
    const width = sheet.getColumn(col).width;
    raw.push(((width == null ? fallback : width) * 7 + 5) * 0.75);
  }
  const sum = raw.reduce((total, width) => total + width, 0) || 1;
  const widthScale = (A4_W - 40) / sum;
  const widths = raw.map((width) => width * widthScale);
  if (household && widths.length > 6 && widths.slice(6).every((width) => width > 4)) {
    widths[5] += 12;
    for (let index = 6; index < widths.length; index += 1) widths[index] -= 1;
  }
  const xs = [20];
  for (const width of widths) xs.push(xs[xs.length - 1] + width);
  return { widthScale, xs };
}

function rowsForBlock(start, end) {
  const raw = start === 1 ? range(start, end) : [...range(1, 4), ...range(start, end)];
  const seen = new Set();
  const rows = [];
  for (const row of raw) {
    if (seen.has(row) || row < 1) continue;
    seen.add(row);
    rows.push(row);
  }
  return rows;
}

function measure(ctx, rows) {
  const shrink = ctx.shrink == null ? 1 : ctx.shrink;
  const baseScale = (ctx.notice ? ctx.widthScale : 1) * shrink;
  const floor = shrink < 0.999 ? 6 : 8;
  const defaultRow = ctx.sheet.properties.defaultRowHeight || 15;
  const rowSet = new Set(rows);
  const heights = {};
  for (const row of rows) {
    heights[row] = (ctx.sheet.getRow(row).height || defaultRow) * baseScale;
  }
  const entries = [];
  for (const row of rows) {
    for (let col = 1; col <= ctx.maxCol; col += 1) {
      const key = `${row},${col}`;
      if (ctx.skip.has(key)) continue;
      const cell = ctx.sheet.getRow(row).getCell(col);
      const merge = ctx.merges.get(key);
      let endRow = merge ? merge.maxRow : row;
      let endCol = Math.min(merge ? merge.maxCol : col, ctx.maxCol);
      if (!rowSet.has(endRow)) {
        let clipped = row;
        for (let cursor = row; cursor <= endRow; cursor += 1) {
          if (rowSet.has(cursor)) clipped = cursor;
        }
        endRow = clipped;
      }
      const raw = cellText(cell.value, ctx.notice);
      const display = raw.trim().replaceAll('合格标准(mm)', '合格标准\n(mm)');
      let size = Math.max(floor, fontSizeOf(cell) * baseScale);
      const boxWidth = Math.max(4, ctx.xs[endCol] - ctx.xs[col - 1] - 4);
      let lines = display ? wrapText(display, ctx.font, size, boxWidth) : [];
      if (display && !display.includes('\n') && lines.length > 1) {
        const full = textWidth(ctx.font, display, size);
        const tight = Boolean(cell.alignment && cell.alignment.shrinkToFit) ? 2.4 : 1.2;
        if (full > boxWidth && full <= boxWidth * tight) {
          const fitted = Math.max(6, size * (boxWidth / full));
          if (textWidth(ctx.font, display, fitted) <= boxWidth + 0.4) {
            lines = [display];
            size = fitted;
          }
        }
      }
      if (raw && lines.length) {
        const need = lines.length * size * 1.2 + 5;
        let have = 0;
        for (let cursor = row; cursor <= endRow; cursor += 1) {
          if (heights[cursor] != null) have += heights[cursor];
        }
        if (have < need) heights[endRow] += need - have;
      }
      entries.push({ row, col, endRow, endCol, lines, size, display, cell });
    }
  }
  let total = 0;
  for (const row of rows) total += heights[row];
  return { heights, entries, total };
}

function clampToPage(spec, rows) {
  if (spec.total < CONTENT_LIMIT) return;
  const factor = (CONTENT_LIMIT - 8) / spec.total;
  for (const row of rows) spec.heights[row] *= factor;
  spec.total = CONTENT_LIMIT - 8;
}

function fitSpec(ctx, rows) {
  let shrink = 1;
  let spec = measure({ ...ctx, shrink }, rows);
  for (let attempt = 0; attempt < 8 && spec.total >= CONTENT_LIMIT; attempt += 1) {
    const next = Math.max(0.35, shrink * ((CONTENT_LIMIT - 6) / spec.total));
    if (next >= shrink - 0.0001) break;
    shrink = next;
    spec = measure({ ...ctx, shrink }, rows);
  }
  clampToPage(spec, rows);
  return spec;
}

function chunkRows(rows, heights, limit) {
  const chunks = [];
  let current = [];
  let used = 0;
  for (const row of rows) {
    const height = heights[row] || 15;
    if (current.length && used + height > limit) {
      chunks.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += height;
  }
  if (current.length) chunks.push(current);
  return chunks.length ? chunks : [rows];
}

function layoutBlock(ctx, rows) {
  const spec = measure({ ...ctx, shrink: 1 }, rows);
  if (spec.total < CONTENT_LIMIT) return [{ rows, spec }];
  if (ctx.notice || spec.total < CONTENT_LIMIT * 1.6) return [{ rows, spec: fitSpec(ctx, rows) }];
  return chunkRows(rows, spec.heights, CONTENT_LIMIT).map((chunk) => {
    const chunkSpec = measure({ ...ctx, shrink: 1 }, chunk);
    if (chunkSpec.total < CONTENT_LIMIT) return { rows: chunk, spec: chunkSpec };
    return { rows: chunk, spec: fitSpec(ctx, chunk) };
  });
}

function edgeLine(edge, x, y, width, height) {
  if (edge === 'left') return [{ x, y }, { x, y: y + height }];
  if (edge === 'right') return [{ x: x + width, y }, { x: x + width, y: y + height }];
  if (edge === 'top') return [{ x, y: y + height }, { x: x + width, y: y + height }];
  return [{ x, y }, { x: x + width, y }];
}

function drawPage(page, ctx, laid, rgb) {
  const tops = {};
  const bottoms = {};
  let cursor = A4_H - 20;
  for (const row of laid.rows) {
    tops[row] = cursor;
    cursor -= laid.spec.heights[row];
    bottoms[row] = cursor;
  }
  for (const entry of laid.spec.entries) {
    const x = ctx.xs[entry.col - 1];
    const bottom = bottoms[entry.endRow];
    const top = tops[entry.row];
    const width = ctx.xs[entry.endCol] - x;
    const height = top - bottom;
    if (!(width > 0) || !(height > 0) || bottom == null || top == null) continue;
    const fill = entry.cell.fill;
    if (fill && String(fill.pattern || '').toLowerCase() === 'solid') {
      const fillColor = colorOf(fill.fgColor, ctx.theme, [1, 1, 1]);
      page.drawRectangle({ x, y: bottom, width, height, color: rgb(...fillColor), borderWidth: 0 });
    }
    for (const edge of ['left', 'right', 'top', 'bottom']) {
      const border = entry.cell.border && entry.cell.border[edge];
      if (!border || !border.style) continue;
      const [start, end] = edgeLine(edge, x, bottom, width, height);
      const weight = border.style === 'medium' ? 1 : border.style === 'thick' ? 1.5 : 0.45;
      page.drawLine({
        start,
        end,
        thickness: weight,
        color: rgb(...colorOf(border.color, ctx.theme, [0, 0, 0])),
      });
    }
    if (!entry.display) continue;
    const paint = rgb(...colorOf(entry.cell.font && entry.cell.font.color, ctx.theme, [0, 0, 0]));
    const base = bottom + (height + entry.lines.length * entry.size * 1.2) / 2 - entry.size;
    const align = textAlign(entry.cell, ctx);
    entry.lines.forEach((line, index) => {
      if (!line) return;
      const y = base - index * entry.size * 1.2;
      const widthOfLine = textWidth(ctx.font, line, entry.size);
      let textX = x + (width - widthOfLine) / 2;
      if (align === 'left') textX = x + 2.5;
      if (align === 'right') textX = x + width - widthOfLine - 2.5;
      const draw = (dx) => page.drawText(line, { x: textX + dx, y, size: entry.size, font: ctx.font, color: paint });
      try {
        if (entry.cell.font && entry.cell.font.bold) draw(0.28);
        draw(0);
      } catch (error) {
        ctx.warnings.add('有少量字符这个字体写不出来，已跳过');
      }
    });
  }
  for (const image of ctx.images) {
    const tl = anchorCell(image.range && image.range.tl);
    const br = anchorCell(image.range && image.range.br);
    const topRow = tl.row + 1;
    if (topRow < laid.blockStart || topRow > laid.blockEnd || tops[topRow] == null) continue;
    const embedded = ctx.embedded.get(image.imageId);
    if (!embedded) continue;
    const x = ctx.xs[Math.max(0, Math.min(ctx.xs.length - 1, tl.col))];
    const right = ctx.xs[Math.max(0, Math.min(ctx.xs.length - 1, br.col))];
    const top = tops[topRow];
    const bottom = tops[br.row + 1] != null
      ? tops[br.row + 1]
      : (bottoms[br.row] != null ? bottoms[br.row] : bottoms[laid.rows[laid.rows.length - 1]]);
    const boxW = right - x;
    const boxH = top - bottom;
    if (boxW < 2 || boxH < 2) continue;
    const scale = Math.min(boxW / embedded.width, boxH / embedded.height);
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;
    page.drawImage(embedded, {
      x: x + (boxW - drawW) / 2,
      y: bottom + (boxH - drawH) / 2,
      width: drawW,
      height: drawH,
    });
    ctx.imageCount += 1;
  }
}

async function embedImages(pdfDoc, workbook, images, warnings) {
  const embedded = new Map();
  for (const image of images) {
    if (embedded.has(image.imageId)) continue;
    const media = workbook.getImage(image.imageId);
    const bytes = toBytes(media && media.buffer);
    if (!bytes) continue;
    const ext = String(media.extension || '').toLowerCase();
    const png = ext === 'png' || (bytes[0] === 0x89 && bytes[1] === 0x50);
    const jpg = ext === 'jpeg' || ext === 'jpg' || (bytes[0] === 0xff && bytes[1] === 0xd8);
    try {
      if (png) embedded.set(image.imageId, await pdfDoc.embedPng(bytes));
      else if (jpg) embedded.set(image.imageId, await pdfDoc.embedJpg(bytes));
      else warnings.add('有图片不是 PNG 或 JPEG，已跳过');
    } catch (error) {
      warnings.add('有图片无法写入 PDF，已跳过');
    }
  }
  return embedded;
}

export async function excelToPdf(fileBuffer, options) {
  const filename = options.filename || 'workbook.xlsx';
  const { ExcelJS, PDFDocument, rgb, fontkit, fontBytes } = options;
  if (!fontBytes) throw new Error('中文字体还没准备好');
  options.onProgress && options.onProgress('正在读取表格');
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(fileBuffer);
  } catch (error) {
    throw new Error('无法读取这个文件。请上传未加密的 .xlsx');
  }
  const sheets = selectSheets(workbook);
  options.onProgress && options.onProgress('正在排版');
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const font = await pdfDoc.embedFont(fontBytes, { subset: true });
  const theme = parseTheme(workbook.model && workbook.model.themes && workbook.model.themes.theme1);
  const warnings = new Set();
  const pages = [];
  const summary = [];
  const allImages = [];

  for (const sheet of sheets) {
    const images = sheetImages(sheet);
    allImages.push(...images);
    const { maxRow, maxCol } = usedBounds(sheet, images);
    if (!maxRow || !maxCol) continue;
    if (maxRow > 8000 || maxCol > 100 || maxRow * maxCol > 200000) {
      throw new Error(`「${sheet.name}」太大（${maxRow} 行 × ${maxCol} 列），请先拆分后再导出`);
    }
    const boxes = (sheet.model.merges || []).map(parseMerge);
    const merges = new Map();
    const skip = new Set();
    for (const box of boxes) {
      merges.set(`${box.minRow},${box.minCol}`, box);
      for (let row = box.minRow; row <= box.maxRow; row += 1) {
        for (let col = box.minCol; col <= box.maxCol; col += 1) {
          if (row !== box.minRow || col !== box.minCol) skip.add(`${row},${col}`);
        }
      }
    }
    const starts = noticeMarkers(sheet, maxRow);
    const notice = starts.length > 0 || filename.includes('整改通知单');
    const household = !starts.length && (filename.includes('一户一表') || sheetHasText(sheet, '一户一表', maxRow, maxCol));
    const { widthScale, xs } = buildColumns(sheet, maxCol, household);
    const blocks = starts.length
      ? starts.map((row, index) => [index === 0 ? 1 : row, index + 1 < starts.length ? starts[index + 1] - 1 : maxRow])
      : [[1, contentEnd(sheet, maxRow, maxCol, boxes)]];
    const ctx = { sheet, font, theme, merges, skip, maxCol, notice, household, widthScale, xs, images, warnings };
    const before = pages.length;
    for (const [start, end] of blocks) {
      const blockEnd = Math.max(start, end);
      const rows = rowsForBlock(start, blockEnd);
      if (!rows.length) continue;
      for (const laid of layoutBlock(ctx, rows)) {
        pages.push({ ...laid, blockStart: start, blockEnd, ctx });
      }
    }
    summary.push({ name: sheet.name, pages: pages.length - before });
  }

  if (!pages.length) throw new Error('这个表格里没有可导出的内容');
  options.onProgress && options.onProgress('正在生成 PDF');
  const embedded = await embedImages(pdfDoc, workbook, allImages, warnings);
  let imageCount = 0;
  const pdfPages = pages.map((laid) => {
    const page = pdfDoc.addPage([A4_W, A4_H]);
    const ctx = { ...laid.ctx, embedded, imageCount: 0 };
    drawPage(page, ctx, laid, rgb);
    imageCount += ctx.imageCount;
    return page;
  });
  pdfPages.forEach((page, index) => {
    const label = `第 ${index + 1} 页，共 ${pdfPages.length} 页`;
    page.drawText(label, {
      x: (A4_W - textWidth(font, label, 9)) / 2,
      y: 18,
      size: 9,
      font,
      color: rgb(0, 0, 0),
    });
  });
  pdfDoc.setTitle(filename.replace(/\.[^.]+$/, ''));
  pdfDoc.setCreator('boomery tools');
  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    pageCount: pdfPages.length,
    sheets: summary,
    imageCount,
    warnings: [...warnings],
  };
}
