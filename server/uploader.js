const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const dir = path.join(__dirname, 'uploads');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const MIME_MAP = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/pjpeg': '.jpg',
  'image/png': '.png',
  'image/x-png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/bmp': '.bmp',
  'image/heic': '.heic',
  'image/heif': '.heif'
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) => {
    const ext = MIME_MAP[file.mimetype] || path.extname(file.originalname) || '.jpg';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext.toLowerCase()}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15 MB gacha telefon suratlari
  fileFilter: (req, file, cb) => {
    const isImageMime = file.mimetype && (file.mimetype.startsWith('image/') || MIME_MAP[file.mimetype]);
    const isImageExt = file.originalname && /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.originalname);
    if (isImageMime || isImageExt) {
      return cb(null, true);
    }
    cb(new Error('Faqat rasm fayllari (jpg, png, webp, gif) qabul qilinadi'));
  }
});

module.exports = upload;
