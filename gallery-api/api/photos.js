// GET  /api/photos        → 返回图片列表
// DELETE /api/photos?id=xx&password=xx → 删除单张图片

const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const photos = await sql`
        SELECT id, src, title, tag, created_at
        FROM gallery_photos
        ORDER BY created_at DESC
      `;
      return res.status(200).json(photos);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const { id, password } = req.query;
    if (!password || password !== process.env.UPLOAD_PASSWORD) {
      return res.status(401).json({ error: '密码错误' });
    }
    if (!id) return res.status(400).json({ error: '缺少 id' });

    try {
      await sql`DELETE FROM gallery_photos WHERE id = ${Number(id)}`;
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
