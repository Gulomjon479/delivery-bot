const express = require('express');
const router = express.Router();
const db = require('../database');
const { notifyAdmins } = require('../bot');

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// GET status for a specific user
router.get('/status/:telegramId', (req, res) => {
  try {
    const tid = Number(req.params.telegramId) || req.tg.id;
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const sellerReq = db.prepare(
      "SELECT * FROM access_requests WHERE telegram_id = ? AND requested_role = 'seller' ORDER BY id DESC LIMIT 1"
    ).get(tid);

    const courierReq = db.prepare(
      "SELECT * FROM access_requests WHERE telegram_id = ? AND requested_role = 'courier' ORDER BY id DESC LIMIT 1"
    ).get(tid);

    res.json({
      is_seller_approved: Boolean(req.tg.isAdmin || user.is_seller_approved || user.role === 'seller'),
      is_courier_approved: Boolean(req.tg.isAdmin || user.is_courier_approved || user.role === 'courier'),
      seller_request: sellerReq || null,
      courier_request: courierReq || null
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST submit a new request
router.post('/submit', async (req, res) => {
  try {
    const tid = Number(req.body.telegramId) || req.tg.id;
    const { requestedRole, phone, shopName, vehicleType } = req.body;

    if (!requestedRole || !['seller', 'courier'].includes(requestedRole)) {
      return res.status(400).json({ error: 'Noto\'g\'ri rol tanlandi (faqat sotuvchi yoki kuryer)' });
    }

    const cleanPhone = String(phone || '').trim();
    if (!cleanPhone || cleanPhone.length < 7) {
      return res.status(400).json({ error: 'Iltimos, haqiqiy telefon raqamingizni kiriting!' });
    }

    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    // Agar foydalanuvchi allaqachon tasdiqlangan bo'lsa
    if (requestedRole === 'seller' && (user.is_seller_approved || user.role === 'seller')) {
      return res.json({ success: true, alreadyApproved: true, message: 'Siz allaqachon sotuvchi sifatida tasdiqlangansiz!' });
    }
    if (requestedRole === 'courier' && (user.is_courier_approved || user.role === 'courier')) {
      return res.json({ success: true, alreadyApproved: true, message: 'Siz allaqachon kuryer sifatida tasdiqlangansiz!' });
    }

    // Tekshirish: kutilayotgan so'rov bormi?
    const existing = db.prepare(
      "SELECT * FROM access_requests WHERE telegram_id = ? AND requested_role = ? AND status = 'pending' ORDER BY id DESC LIMIT 1"
    ).get(tid, requestedRole);

    let reqId;
    if (existing) {
      // Mavjud kutilayotgan so'rov ma'lumotlarini yangilaymiz
      db.prepare(`
        UPDATE access_requests SET
          phone = ?, shop_name = ?, vehicle_type = ?,
          first_name = ?, last_name = ?, username = ?,
          created_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        cleanPhone,
        shopName ? String(shopName).trim() : null,
        vehicleType ? String(vehicleType).trim() : null,
        user.first_name || '',
        user.last_name || '',
        user.username || '',
        existing.id
      );
      reqId = existing.id;
    } else {
      const ins = db.prepare(`
        INSERT INTO access_requests (
          telegram_id, requested_role, first_name, last_name, username,
          phone, shop_name, vehicle_type, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).run(
        tid,
        requestedRole,
        user.first_name || '',
        user.last_name || '',
        user.username || '',
        cleanPhone,
        shopName ? String(shopName).trim() : null,
        vehicleType ? String(vehicleType).trim() : null
      );
      reqId = Number(ins.lastInsertRowid);
    }

    // Telefon raqamini foydalanuvchi profiliga ham saqlab qo'yamiz
    try {
      db.prepare('UPDATE users SET phone = COALESCE(phone, ?) WHERE telegram_id = ?').run(cleanPhone, tid);
      if (shopName) {
        db.prepare('UPDATE users SET point_name = COALESCE(point_name, ?) WHERE telegram_id = ?').run(String(shopName).trim(), tid);
      }
    } catch (e) {}

    // Adminga darhol xabar yuborish (Telegram orqali 1-bosishda tasdiqlash tugmalari bilan)
    const roleBadge = requestedRole === 'seller' ? '🏪 SOTUVCHI' : '🚴 KURYER';
    const adminMsg =
      `🔔 <b>YANGI RO'YXATDAN O'TISH SO'ROVI!</b>\n\n` +
      `👤 <b>Foydalanuvchi:</b> ${escapeHtml(user.first_name)} ${escapeHtml(user.last_name || '')} (@${escapeHtml(user.username || 'username_yoq')})\n` +
      `🆔 <b>Telegram ID:</b> <code>${tid}</code>\n` +
      `📋 <b>So'ralgan rol:</b> <b>${roleBadge}</b>\n` +
      `📞 <b>Telefon:</b> <code>${escapeHtml(cleanPhone)}</code>\n` +
      (shopName ? `🏪 <b>Do'kon nomi:</b> ${escapeHtml(shopName)}\n` : '') +
      (vehicleType ? `🛵 <b>Transport:</b> ${escapeHtml(vehicleType)}\n` : '') +
      `\n<i>Quyidagi tugmalar orqali to'g'ridan-to'g'ri tasdiqlashingiz yoki rad etishingiz mumkin:</i>`;

    const adminKeyboard = {
      inline_keyboard: [
        [
          { text: '✅ Tasdiqlash (Kod yuborish)', callback_data: `admin_approve_req_${reqId}` },
          { text: '❌ Rad etish', callback_data: `admin_reject_req_${reqId}` }
        ]
      ]
    };

    notifyAdmins(adminMsg, null, adminKeyboard).catch(() => {});

    res.json({
      success: true,
      requestId: reqId,
      status: 'pending',
      message: 'So\'rovingiz muvaffaqiyatli qabul qilindi! Admin ko\'rib chiqqach, bot orqali maxsus kirish kodingizni yuboradi.'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST verify code and grant role access
router.post('/verify-code', (req, res) => {
  try {
    const tid = Number(req.body.telegramId) || req.tg.id;
    const { role, code } = req.body;

    if (!role || !['seller', 'courier'].includes(role)) {
      return res.status(400).json({ error: 'Noto\'g\'ri rol' });
    }

    const cleanCode = String(code || '').trim();
    if (!cleanCode) {
      return res.status(400).json({ error: 'Iltimos, 6 xonali kirish kodini kiriting!' });
    }

    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    // 1. Foydalanuvchining access_requests jadvalidagi tasdiqlangan kodi bilan tekshirish
    const validReq = db.prepare(`
      SELECT * FROM access_requests
      WHERE telegram_id = ? AND requested_role = ? AND access_code = ? AND status = 'approved'
      ORDER BY id DESC LIMIT 1
    `).get(tid, role, cleanCode);

    // 2. Yoki foydalanuvchi profilidagi saqlangan kod bilan tekshirish
    const userCode = role === 'seller' ? user.seller_access_code : user.courier_access_code;
    const isCodeMatch = Boolean(validReq) || (userCode && String(userCode).trim() === cleanCode);

    if (!isCodeMatch) {
      return res.status(400).json({
        error: 'Kiritilgan kod noto\'g\'ri yoki hali tasdiqlanmagan! Iltimos, Bot orqali kelgan kodni tekshiring.'
      });
    }

    // Kod to'g'ri -> foydalanuvchiga to'liq ruxsat beramiz
    if (role === 'seller') {
      db.prepare(`
        UPDATE users SET
          is_seller_approved = 1,
          role = CASE WHEN role = 'customer' THEN 'seller' ELSE role END
        WHERE telegram_id = ?
      `).run(tid);
    } else {
      db.prepare(`
        UPDATE users SET
          is_courier_approved = 1,
          role = CASE WHEN role = 'customer' THEN 'courier' ELSE role END
        WHERE telegram_id = ?
      `).run(tid);
    }

    res.json({
      success: true,
      message: 'Muvaffaqiyatli tasdiqlandi! Endi to\'liq kirishingiz mumkin.',
      role
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
