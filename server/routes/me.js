const express = require('express');
const router = express.Router();
const db = require('../database');
const legal = require('../legalDocs');

const SELECTABLE = ['customer', 'seller', 'courier'];

// Joriy foydalanuvchi: rol serverda saqlanadi, URL orqali o'zgartirib bo'lmaydi
router.get('/', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.tg.id);
  if (!u) return res.status(404).json({ error: 'User not found' });
  const isSellerApproved = Boolean(req.tg.isAdmin || u.is_seller_approved || u.role === 'seller');
  const isCourierApproved = Boolean(req.tg.isAdmin || u.is_courier_approved || u.role === 'courier');
  const termsAccepted = Boolean(req.tg.isAdmin || u.terms_accepted);

  res.json({
    id: u.id,
    telegram_id: u.telegram_id,
    role: u.role,
    isAdmin: req.tg.isAdmin,
    first_name: u.first_name,
    last_name: u.last_name,
    username: u.username,
    is_seller_approved: isSellerApproved,
    is_courier_approved: isCourierApproved,
    terms_accepted: termsAccepted
  });
});

// Ommaviy oferta va Maxfiylik siyosatiga rozilik bildirish
router.post('/accept-terms', (req, res) => {
  try {
    const u = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.tg.id);
    if (!u) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    db.prepare('UPDATE users SET terms_accepted = 1, terms_accepted_at = CURRENT_TIMESTAMP WHERE id = ?').run(u.id);
    res.json({ success: true, terms_accepted: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Rasmiy yuridik hujjatlar matni
router.get('/terms', (req, res) => {
  res.json({
    oferta: {
      title: legal.OFERTA_TITLE,
      text: legal.OFERTA_TEXT
    },
    privacy: {
      title: legal.PRIVACY_TITLE,
      text: legal.PRIVACY_TEXT
    }
  });
});

// Rolni FAQAT bir marta (role = 'new' bo'lganda) tanlash mumkin. Keyin faqat Admin o'zgartiradi.
router.post('/role', (req, res) => {
  if (req.tg.isAdmin) return res.status(400).json({ error: 'Admin roli o\'zgarmaydi.' });
  const role = String(req.body?.role || '');
  if (!SELECTABLE.includes(role)) return res.status(400).json({ error: 'Noto\'g\'ri rol' });
  const u = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.tg.id);
  if (u.role !== 'new') {
    return res.status(409).json({ error: `Rolingiz allaqachon tanlangan: ${u.role}. O'zgartirish uchun Admin bilan bog'laning.`, role: u.role });
  }
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
  res.json({ success: true, role });
});

module.exports = router;
