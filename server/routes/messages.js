const express = require('express');
const router = express.Router();
const db = require('../database');
const { sendNotification } = require('../bot');

// Xabar yuborish: yuboruvchi o'zi bo'lishi shart (Admin istalgan foydalanuvchiga yoza oladi)
router.post('/send', async (req, res) => {
  try {
    const { to_user_id, text } = req.body;
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'Xabar bo\'sh' });

    const sender = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.tg.id);
    if (!sender) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const recipient = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(to_user_id));
    if (!recipient) return res.status(404).json({ error: 'Qabul qiluvchi topilmadi' });

    // Oddiy foydalanuvchilar faqat Adminga yoza oladi
    if (!req.tg.isAdmin && recipient.role !== 'admin') {
      return res.status(403).json({ error: 'Faqat Adminga yozish mumkin' });
    }

    db.prepare('INSERT INTO messages (from_user_id, to_user_id, text) VALUES (?, ?, ?)')
      .run(sender.id, recipient.id, String(text).trim());

    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const label = sender.role === 'admin' ? '👑 Administrator' : `${esc(sender.first_name || 'Foydalanuvchi')} (${esc(sender.role)})`;
    await sendNotification(recipient.telegram_id, `💬 <b>${label}dan yangi xabar:</b>\n\n"${esc(String(text).trim())}"`);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Suhbat tarixi: so'rovchi ishtirokchi bo'lishi shart (yoki Admin)
router.get('/:user1/:user2', (req, res) => {
  try {
    const u1 = Number(req.params.user1);
    const u2 = Number(req.params.user2);
    if (!req.tg.isAdmin) {
      const me = db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(req.tg.id);
      if (!me || (me.id !== u1 && me.id !== u2)) return res.status(403).json({ error: 'Ruxsat yo\'q' });
    }
    const msgs = db.prepare(`
      SELECT m.*, u.first_name, u.last_name, u.role
      FROM messages m LEFT JOIN users u ON m.from_user_id = u.id
      WHERE (m.from_user_id = ? AND m.to_user_id = ?) OR (m.from_user_id = ? AND m.to_user_id = ?)
      ORDER BY m.created_at ASC
    `).all(u1, u2, u2, u1);
    res.json(msgs);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
