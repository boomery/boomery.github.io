// GET  /api/night-saves?token=HXNY-XXXX-XXXX  → 取回该印信下的云存档
// PUT  /api/night-saves  Body: { token, active_slot, slots } → 覆盖写入

const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const MAX_BYTES = 800 * 1024;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function normalizeSeal(raw) {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/槐安/g, 'HXNY')
    .replace(/[\s　-]/g, '');
  if (s.startsWith('HXNY') && s.length === 12) {
    return `HXNY-${s.slice(4, 8)}-${s.slice(8, 12)}`;
  }
  if (s.length === 8) {
    return `HXNY-${s.slice(0, 4)}-${s.slice(4, 8)}`;
  }
  return String(raw || '').trim().toUpperCase();
}

function isValidSeal(seal) {
  const m = /^HXNY-([A-Z0-9]{4})-([A-Z0-9]{4})$/.exec(seal);
  if (!m) return false;
  const body = m[1] + m[2];
  for (const ch of body) {
    if (!ALPHABET.includes(ch)) return false;
  }
  return true;
}

function tokenHash(seal) {
  return crypto.createHash('sha256').update(`night-seal-v1:${seal}`).digest('hex');
}

function sanitizeSlots(slots) {
  if (typeof slots === 'string') {
    try {
      slots = JSON.parse(slots);
    } catch (err) {
      return null;
    }
  }
  if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return null;
  const out = {};
  for (const key of Object.keys(slots)) {
    const slot = Number(key);
    if (!Number.isInteger(slot) || slot < 1 || slot > 10) continue;
    const data = slots[key];
    if (data == null) continue;
    if (typeof data !== 'object' || Array.isArray(data)) return null;
    if (Number(data.version) !== 1) return null;
    out[String(slot)] = data;
  }
  return out;
}

async function ensureTable(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS night_seals (
      token_hash TEXT PRIMARY KEY,
      active_slot INTEGER NOT NULL DEFAULT 1,
      slots JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!process.env.DATABASE_URL) {
    return res.status(500).json({ ok: false, error: '未配置数据库' });
  }

  const sql = neon(process.env.DATABASE_URL);
  try {
    await ensureTable(sql);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  if (req.method === 'GET') {
    const seal = normalizeSeal(req.query.token);
    if (!isValidSeal(seal)) {
      return res.status(400).json({ ok: false, error: '印信格式不对' });
    }
    try {
      const rows = await sql`
        SELECT active_slot, slots
        FROM night_seals
        WHERE token_hash = ${tokenHash(seal)}
        LIMIT 1
      `;
      if (!rows.length) {
        return res.status(404).json({ ok: false, error: '云上没有这枚印信的存档' });
      }
      return res.status(200).json({
        ok: true,
        active_slot: rows[0].active_slot,
        slots: rows[0].slots || {},
      });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  if (req.method === 'PUT') {
    const body = req.body || {};
    const seal = normalizeSeal(body.token);
    if (!isValidSeal(seal)) {
      return res.status(400).json({ ok: false, error: '印信格式不对' });
    }
    const slots = sanitizeSlots(body.slots);
    if (!slots) {
      return res.status(400).json({ ok: false, error: '存档数据无效' });
    }
    const encoded = JSON.stringify(slots);
    if (Buffer.byteLength(encoded, 'utf8') > MAX_BYTES) {
      return res.status(413).json({ ok: false, error: '存档过大' });
    }
    const activeSlot = Math.min(10, Math.max(1, parseInt(body.active_slot, 10) || 1));
    try {
      await sql`
        INSERT INTO night_seals (token_hash, active_slot, slots, updated_at)
        VALUES (${tokenHash(seal)}, ${activeSlot}, ${encoded}::jsonb, now())
        ON CONFLICT (token_hash)
        DO UPDATE SET
          active_slot = EXCLUDED.active_slot,
          slots = EXCLUDED.slots,
          updated_at = now()
      `;
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' });
};
