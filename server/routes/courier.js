const express = require('express');
const router = express.Router();
const db = require('../database');
const upload = require('../uploader');
const { sendNotification } = require('../bot');
const { processOrderFinancialSplit } = require('./seller');
const { getDistanceKm, calculateCourierFee, MAX_COURIER_RADIUS_KM } = require('../geo');

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const validCoords = (lat, lon) => lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;

function me(req) {
  return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.tg.id);
}

// GET courier profile (also includes Admin card details)
router.get('/profile/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const adminUser = db.prepare("SELECT first_name, last_name, card_number, card_holder FROM users WHERE role = 'admin' ORDER BY CASE WHEN card_number IS NOT NULL AND card_number != '' THEN 0 ELSE 1 END, id ASC LIMIT 1").get();

    res.json({
      ...user,
      admin_card: adminUser?.card_number || '8600 0000 0000 0000',
      admin_card_holder: adminUser?.card_holder || 'ADMINISTRATOR',
      admin_name: adminUser ? `${adminUser.first_name || ''} ${adminUser.last_name || ''}`.trim() : 'Admin'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update courier profile (faqat o'zining)
router.put('/profile/:telegramId', upload.single('photo'), (req, res) => {
  try {
    const targetTid = Number(req.params.telegramId) || (req.tg && Number(req.tg.id));
    const current = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(targetTid) || me(req);
    if (!current) return res.status(404).json({ error: 'User not found' });
    const { first_name, last_name, username, phone, card_number, card_holder, lat, lon } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const nLat = num(lat), nLon = num(lon);

    db.prepare(`
      UPDATE users SET
        first_name = ?, last_name = ?, username = ?, phone = ?,
        card_number = ?, card_holder = ?, lat = ?, lon = ?,
        photo_url = COALESCE(?, photo_url)
      WHERE id = ?
    `).run(
      first_name !== undefined ? first_name : current.first_name,
      last_name !== undefined ? last_name : current.last_name,
      username !== undefined ? username : current.username,
      phone !== undefined ? phone : current.phone,
      card_number !== undefined ? card_number : current.card_number,
      card_holder !== undefined ? card_holder : current.card_holder,
      validCoords(nLat, nLon) ? nLat : current.lat,
      validCoords(nLat, nLon) ? nLon : current.lon,
      photo_url,
      current.id
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST update courier live GPS location
router.post('/location', (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const lat = num(req.body.lat), lon = num(req.body.lon);
    if (!validCoords(lat, lon)) return res.status(400).json({ error: 'Koordinata noto\'g\'ri' });

    db.prepare('UPDATE users SET lat = ?, lon = ? WHERE id = ?').run(lat, lon, user.id);
    // Faol buyurtmalardagi kuryer koordinatasi (mijoz jonli kuzatishi uchun)
    db.prepare("UPDATE orders SET courier_lat = ?, courier_lon = ? WHERE courier_id = ? AND status IN ('accepted', 'delivering')").run(lat, lon, user.id);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST toggle courier online/offline (Smenada)
router.post('/toggle-online', (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const currentOnline = user.is_online === null || user.is_online === undefined ? 1 : user.is_online;
    const newOnline = currentOnline ? 0 : 1;
    db.prepare('UPDATE users SET is_online = ? WHERE id = ?').run(newOnline, user.id);
    res.json({ success: true, is_online: newOnline });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET courier orders: tayyor (qabul qilinmagan) buyurtmalar (faqat <= 20 km) + o'zi qabul qilganlar
router.get('/orders/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Not found' });

    // Agar kuryer oflayn bo'lsa yangi buyurtmalarni ko'rmaydi
    const isOnline = user.is_online === null || user.is_online === undefined ? 1 : user.is_online;

    const courierLat = num(req.query.lat);
    const courierLon = num(req.query.lon);
    const activeLat = validCoords(courierLat, courierLon) ? courierLat : user.lat;
    const activeLon = validCoords(courierLat, courierLon) ? courierLon : user.lon;

    const rates = db.getCommissionRates();
    const rows = db.prepare(`
      SELECT o.*,
        p.name as product_name, p.price as product_price, p.photo_url as product_photo,
        cu.first_name as customer_name, cu.last_name as customer_lastname, cu.phone as customer_phone, cu.address as customer_address, cu.lat as cu_lat, cu.lon as cu_lon,
        s.first_name as seller_name, s.point_name as seller_point, s.address as seller_address, s.phone as seller_phone, s.lat as s_lat, s.lon as s_lon
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users cu ON o.customer_id = cu.id
      LEFT JOIN users s ON o.seller_id = s.id
      WHERE (o.status IN ('ready', 'pending', 'paid_waiting') AND o.courier_id IS NULL)
         OR (o.courier_id = ? AND o.status IN ('accepted', 'delivering'))
      ORDER BY o.created_at DESC
    `).all(user.id);

    const result = [];
    for (const o of rows) {
      // 1. Sotuvchi do'koni manzili (sotuvchi profilida saqlangan manzil, agar bo'lmasa buyurtmadagi)
      const sLat = o.s_lat ?? o.seller_lat;
      const sLon = o.s_lon ?? o.seller_lon;

      // 2. Mijoz manzili (mijoz ilovani ochganda yangilanadigan jonli joylashuv, agar bo'lmasa buyurtmadagi)
      const cLat = o.customer_lat ?? o.cu_lat;
      const cLon = o.customer_lon ?? o.cu_lon;

      const mine = o.courier_id === user.id;

      // Masofalar:
      // Kuryer -> Do'kon (olish punkti)
      const toPickup = getDistanceKm(activeLat, activeLon, sLat, sLon);
      // Kuryer -> Mijoz (jonli)
      const toCustomer = getDistanceKm(activeLat, activeLon, cLat, cLon);
      // Do'kon -> Mijoz
      const pickupToCustomer = getDistanceKm(sLat, sLon, cLat, cLon);

      // Agar buyurtma delivering (yetkazilmoqda) bo'lsa - mijozgacha masofa; aks holda - do'kongacha masofa
      const currentDistance = o.status === 'delivering' ? toCustomer : toPickup;

      // 20 KM RADIUS QOIDASI:
      // Agar buyurtma yangi bo'lsa (hali kuryer tomonidan qabul qilinmagan):
      if (!mine) {
        // 1. Oflayn kuryerga yangi buyurtmalar ko'rinmaydi
        if (!isOnline) continue;
        // 2. Kuryer koordinatasi yo'q bo'lsa yoki olish punkti 20 km dan uzoqda bo'lsa KELMAYDI!
        if (activeLat == null || activeLon == null || toPickup == null) continue;
        if (toPickup > MAX_COURIER_RADIUS_KM) continue;
      }

      let items = [];
      try { if (o.items_json) items = JSON.parse(o.items_json); } catch (e) {}

      const calc = calculateCourierFee(sLat, sLon, cLat, cLon, rates.courierPricePerKm);
      const fee = o.courier_fee != null && Number(o.courier_fee) > 0
        ? Number(o.courier_fee)
        : (o.delivery_fee != null && Number(o.delivery_fee) > 0 ? Number(o.delivery_fee) : calc.courierFee);

      const out = {
        ...o,
        courier_fee: fee,
        courier_price_per_km: rates.courierPricePerKm,
        delivery_distance_km: o.delivery_distance_km != null && Number(o.delivery_distance_km) > 0
          ? Number(o.delivery_distance_km)
          : (pickupToCustomer !== null ? Number(pickupToCustomer.toFixed(1)) : 1),
        delivery_pin_code: undefined, // PIN faqat mijozda — kuryer uni mijozdan olishi kerak
        items,
        seller_lat: sLat ?? null,
        seller_lon: sLon ?? null,
        customer_lat: cLat ?? null,
        customer_lon: cLon ?? null,
        distance_km: currentDistance !== null ? Number(currentDistance.toFixed(1)) : null,
        route_km: pickupToCustomer !== null ? Number(pickupToCustomer.toFixed(1)) : null,
        courier_lat: mine ? (activeLat ?? o.courier_lat) : null,
        courier_lon: mine ? (activeLon ?? o.courier_lon) : null
      };

      // Qabul qilinmaguncha mijozning shaxsiy ma'lumotlari yashirin
      if (!mine) {
        out.customer_phone = null;
        out.customer_name = 'Mijoz';
        out.customer_lastname = '';
        out.customer_address = null;
      }
      result.push(out);
    }

    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST accept order (atomik: bitta buyurtmani faqat bitta kuryer oladi, faqat 20 km radiusda)
router.post('/orders/:orderId/accept', async (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const orderId = Number(req.params.orderId);
    const lat = num(req.body.courier_lat), lon = num(req.body.courier_lon);
    const cLat = validCoords(lat, lon) ? lat : user.lat;
    const cLon = validCoords(lat, lon) ? lon : user.lon;

    const orderCheck = db.prepare(`
      SELECT o.*, s.lat as s_lat, s.lon as s_lon 
      FROM orders o 
      LEFT JOIN users s ON o.seller_id = s.id 
      WHERE o.id = ?
    `).get(orderId);
    if (!orderCheck) return res.status(404).json({ error: 'Buyurtma topilmadi' });

    const sLat = orderCheck.seller_lat ?? orderCheck.s_lat;
    const sLon = orderCheck.seller_lon ?? orderCheck.s_lon;
    const dist = getDistanceKm(cLat, cLon, sLat, sLon);
    if (dist !== null && dist > MAX_COURIER_RADIUS_KM) {
      return res.status(400).json({
        error: `Bu buyurtma 20 km radiusdan tashqarida (~${dist.toFixed(1)} km). Siz faqat 20 km gacha bo'lgan buyurtmalarni qabul qilishingiz mumkin.`
      });
    }

    const r = db.prepare("UPDATE orders SET courier_id = ?, status = 'accepted', courier_lat = ?, courier_lon = ? WHERE id = ? AND courier_id IS NULL AND status IN ('ready', 'pending', 'paid_waiting')")
      .run(user.id, cLat, cLon, orderId);
    if (!r.changes) {
      return res.status(400).json({ error: 'Bu buyurtmani qabul qilib bo\'lmaydi (boshqa kuryer olgan yoki hali tayyor emas).' });
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
    const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.customer_id);

    if (seller?.telegram_id) {
      await sendNotification(
        seller.telegram_id,
        `🚴 <b>Buyurtma #${order.id} uchun kuryer biriktirildi!</b>\n` +
        `👤 Kuryer: <b>${user.first_name || ''} ${user.last_name || ''}</b> (${user.phone || 'Tel kiritilmagan'})\n` +
        `Taomni kuryerga bergach, <b>"🤝 Kuryerga topshirdim"</b> tugmasini bosing.`
      );
    }
    if (customer?.telegram_id) {
      await sendNotification(
        customer.telegram_id,
        `🚴 <b>Buyurtmangiz #${order.id} kuryer tomonidan qabul qilindi!</b>\n` +
        `👤 Kuryer: <b>${user.first_name || ''} ${user.last_name || ''}</b>\n` +
        `Hozir kuryer savdo punktidan buyurtmangizni olmoqda.`
      );
    }

    if (user?.telegram_id) {
      const rates = db.getCommissionRates();
      const courierFee = Number(order.courier_fee || order.delivery_fee || rates.courierPricePerKm || 3000);
      const distKm = Number(order.delivery_distance_km || 0);
      const kmInfo = distKm > 0
        ? `\nℹ️ <i>Masofa: ~${distKm} km (1 km = ${(rates.courierPricePerKm || 3000).toLocaleString()} so'm). Yetkazib bergach hisobingizga +${courierFee.toLocaleString()} so'm qo'shiladi.</i>`
        : `\nℹ️ <i>Yetkazib bergach hisobingizga +${courierFee.toLocaleString()} so'm qo'shiladi.</i>`;

      await sendNotification(
        user.telegram_id,
        `🚴 <b>Buyurtma #${order.id}ni qabul qildingiz!</b>\n` +
        `💰 Kuryer ulushingiz: <b>+${courierFee.toLocaleString()} so'm</b>` +
        kmInfo
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST complete order delivery (faqat o'z buyurtmasi, faqat "delivering" holatida)
router.post('/orders/:orderId/deliver', async (req, res) => {
  try {
    const user = me(req);
    const orderId = Number(req.params.orderId);
    let order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (!user || order.courier_id !== user.id) return res.status(403).json({ error: 'Bu buyurtma sizniki emas!' });
    if (order.status !== 'delivering') {
      return res.status(400).json({ error: 'Avval sotuvchi buyurtmani sizga topshirishi kerak.' });
    }

    // 4 xonali PIN-kod tekshiruvi (mijoz taqdim etishi SHART — bo'sh PIN bilan o'tkazib yuborib bo'lmaydi)
    const pin = String(req.body?.pin_code ?? req.body?.pin ?? '').trim();
    if (order.delivery_pin_code && pin !== String(order.delivery_pin_code).trim()) {
      return res.status(400).json({ error: `Noto'g'ri PIN-kod! Mijoz bergan 4 xonali PIN-kodni kiriting.` });
    }

    const upd = db.prepare("UPDATE orders SET status = 'delivered' WHERE id = ? AND status = 'delivering'").run(orderId);
    if (!upd.changes) return res.status(400).json({ error: 'Buyurtma allaqachon yakunlangan.' });
    if (!order.shares_deducted) order = processOrderFinancialSplit(orderId);

    const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.customer_id);
    if (customer?.telegram_id) {
      await sendNotification(
        customer.telegram_id,
        `🏁 <b>Buyurtmangiz #${order.id} manzilga yetkazib berildi!</b>\nYoqimli ishtaha! Xizmatimizdan foydalanganingiz uchun rahmat 🍕`
      );
    }
    const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
    if (seller?.telegram_id) {
      const rates = db.getCommissionRates();
      await sendNotification(
        seller.telegram_id,
        `🏁 <b>Buyurtma #${order.id} muvaffaqiyatli yetkazildi!</b>\n` +
        `💰 ${rates.sellerPct}% sotuvchi ulushingiz hisobingizga o'tkazildi.`
      );
    }

    if (user?.telegram_id) {
      const rates = db.getCommissionRates();
      const courierEarned = Number(order.courier_fee || order.delivery_fee || rates.courierPricePerKm || 3000);
      await sendNotification(
        user.telegram_id,
        `🎉 <b>Buyurtma #${order.id} muvaffaqiyatli yetkazildi!</b>\n` +
        `💰 Kuryer hisobingizga: <b>+${courierEarned.toLocaleString()} so'm</b> qo'shildi!\n` +
        `ℹ️ <i>Kuryer xizmat haqi hisobingizga muvaffaqiyatli o'tkazildi.</i>`
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET courier payments
router.get('/payments/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Not found' });

    const payments = db.prepare(`
      SELECT * FROM payments WHERE to_user_id = ? AND type = 'admin_to_courier'
      ORDER BY created_at DESC
    `).all(user.id);

    const deliveredOrders = db.prepare(`
      SELECT o.*, p.name as product_name, s.point_name as seller_point
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users s ON o.seller_id = s.id
      WHERE o.courier_id = ? AND o.status IN ('delivering', 'delivered')
      ORDER BY o.created_at DESC
    `).all(user.id);

    const rates = db.getCommissionRates();

    res.json({
      payments,
      delivered_orders: deliveredOrders,
      unpaid_amount: user.unpaid_amount || 0,
      total_earned: user.total_earned || 0,
      total_orders: user.total_orders || 0,
      courier_price_per_km: rates.courierPricePerKm,
      rates
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
