// GET  /api/avatar — 返回当前头像 URL
// POST /api/avatar — Body: { password, imageData (base64) }，复用 UPLOAD_PASSWORD

const { neon } = require('@neondatabase/serverless');
const cloudinary = require('cloudinary').v2;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sql = neon(process.env.DATABASE_URL);

  if (req.method === 'GET') {
    try {
      const rows = await sql`SELECT src, updated_at FROM site_avatar WHERE id = 1`;
      if (!rows.length) return res.status(200).json({ src: null, updated_at: null });
      return res.status(200).json(rows[0]);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { password, imageData } = req.body || {};

    if (!password || password !== process.env.UPLOAD_PASSWORD) {
      return res.status(401).json({ error: '密码错误' });
    }
    if (!imageData) return res.status(400).json({ error: '缺少图片数据' });

    try {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key:    process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });

      const uploaded = await cloudinary.uploader.upload(imageData, {
        folder: 'avatar',
        transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'auto', quality: 'auto:good' }],
      });

      const [row] = await sql`
        INSERT INTO site_avatar (id, src, updated_at)
        VALUES (1, ${uploaded.secure_url}, NOW())
        ON CONFLICT (id) DO UPDATE
          SET src = EXCLUDED.src, updated_at = NOW()
        RETURNING src, updated_at
      `;

      return res.status(200).json(row);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
