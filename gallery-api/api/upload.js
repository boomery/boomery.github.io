// POST /api/upload
// Body: { password, imageData (base64 data URL), title, tag }

const { neon } = require('@neondatabase/serverless');
const cloudinary = require('cloudinary').v2;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { password, imageData, title, tag } = req.body || {};

  if (!password || password !== process.env.UPLOAD_PASSWORD) {
    return res.status(401).json({ error: '密码错误' });
  }
  if (!imageData) return res.status(400).json({ error: '缺少图片数据' });
  if (!title)     return res.status(400).json({ error: '缺少标题' });

  try {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uploaded = await cloudinary.uploader.upload(imageData, {
      folder: 'gallery',
      transformation: [{ width: 1200, crop: 'limit', quality: 'auto:good' }],
    });

    const sql = neon(process.env.DATABASE_URL);
    const [photo] = await sql`
      INSERT INTO gallery_photos (src, title, tag)
      VALUES (${uploaded.secure_url}, ${title.trim()}, ${(tag || '').trim()})
      RETURNING id, src, title, tag, created_at
    `;

    return res.status(200).json(photo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
