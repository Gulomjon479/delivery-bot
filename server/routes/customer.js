const express = require('express');
const router = express.Router();
const db = require('../database');
const upload = require('../uploader');
const { sendNotification, sendPhotoNotification, notifyAdmins } = require('../bot');
const { cancelOrderByCustomer, OrderError } = require('../orderService');
const { calculateCourierFee } = require('../geo');

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const validCoords = (lat, lon) => lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
const me = (req) => db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.tg.id);
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// GET customer profile
router.get('/profile/:telegramId', (req, res) => {
  try {
    const tid = Number(req.params.telegramId);
    if (!tid) return res.status(400).json({ error: 'Telegram ID talab qilinadi' });

    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
    if (!user) {
      db.prepare(`
        INSERT INTO users (telegram_id, role, first_name, last_name, username)
        VALUES (?, 'customer', 'Mijoz', '', '')
      `).run(tid);
      user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
    }
    const gifts = db.prepare('SELECT * FROM gifts WHERE to_user_id = ? ORDER BY created_at DESC').all(user.id);
    const complaints = db.prepare('SELECT * FROM complaints WHERE customer_id = ? ORDER BY created_at DESC').all(user.id);
    const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE customer_id = ?').get(user.id)?.c || 0;
    res.json({ ...user, total_orders: orderCount, gifts, complaints });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST update customer live GPS location (Ilova ochilganda va harakatlanganda jonli yangilanadi)
router.post('/location', (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const lat = num(req.body.lat), lon = num(req.body.lon);
    if (!validCoords(lat, lon)) return res.status(400).json({ error: "Koordinata noto'g'ri" });

    db.prepare('UPDATE users SET lat = ?, lon = ? WHERE id = ?').run(lat, lon, user.id);

    // Mijozning faol buyurtmalarida kuryer ko'rishi uchun jonli koordinatani yangilaymiz
    db.prepare(`
      UPDATE orders SET customer_lat = ?, customer_lon = ? 
      WHERE customer_id = ? AND status IN ('pending', 'paid_waiting', 'ready', 'accepted', 'delivering')
    `).run(lat, lon, user.id);

    res.json({ success: true, lat, lon });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update customer profile (including delivery address & GPS)
router.put('/profile/:telegramId', upload.single('photo'), (req, res) => {
  try {
    const targetTid = Number(req.params.telegramId) || (req.tg && Number(req.tg.id));
    if (!targetTid) return res.status(400).json({ error: 'Telegram ID talab qilinadi' });

    let current = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(targetTid);
    if (!current) {
      db.prepare(`
        INSERT INTO users (telegram_id, role, first_name, last_name, username)
        VALUES (?, 'customer', '', '', '')
      `).run(targetTid);
      current = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(targetTid);
    }

    const { first_name, last_name, username, phone, address, lat, lon } = req.body || {};
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const nLat = num(lat), nLon = num(lon);

    db.prepare(`
      UPDATE users SET
        first_name = ?, last_name = ?, username = ?, phone = ?, address = ?, lat = ?, lon = ?,
        photo_url = COALESCE(?, photo_url)
      WHERE id = ?
    `).run(
      first_name !== undefined ? String(first_name).trim() : current.first_name,
      last_name !== undefined ? String(last_name).trim() : current.last_name,
      username !== undefined ? String(username).replace(/^@/, '').trim() : current.username,
      phone !== undefined ? String(phone).trim() : current.phone,
      address !== undefined ? String(address).trim() : current.address,
      validCoords(nLat, nLon) ? nLat : current.lat,
      validCoords(nLat, nLon) ? nLon : current.lon,
      photo_url,
      current.id
    );

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(current.id);
    const gifts = db.prepare('SELECT * FROM gifts WHERE to_user_id = ? ORDER BY created_at DESC').all(current.id);
    const orderCount = db.prepare('SELECT COUNT(*) as c FROM orders WHERE customer_id = ?').get(current.id)?.c || 0;
    res.json({ success: true, user: { ...updatedUser, total_orders: orderCount, gifts } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST add complaint or suggestion
router.post('/complaints', async (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const text = String(req.body?.text || '').trim().slice(0, 1000);
    const type = req.body?.type === 'suggestion' ? 'suggestion' : 'complaint';
    if (!text) return res.status(400).json({ error: 'Matn bo\'sh' });

    db.prepare('INSERT INTO complaints (customer_id, text, type) VALUES (?, ?, ?)').run(user.id, text, type);

    await notifyAdmins(
      `${type === 'complaint' ? '⚠️ <b>Yangi Shikoyat!</b>' : '💡 <b>Yangi Taklif!</b>'}\n\n` +
      `👤 Mijoz: <b>${esc(user.first_name)} ${esc(user.last_name)}</b> (@${esc(user.username || 'yoq')})\n` +
      `📝 Matn: <i>"${esc(text)}"</i>`
    );

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET full catalog (faol sotuvchilar -> kategoriyalar -> mavjud mahsulotlar). Maxfiy maydonlar yo'q.
router.get('/catalog', (req, res) => {
  try {
    const sellers = db.prepare(`
      SELECT DISTINCT u.id, u.first_name, u.last_name, u.point_name, u.photo_url, u.address, u.lat, u.lon, u.is_open, u.telegram_id
      FROM users u
      WHERE u.is_blocked = 0 AND (u.is_open IS NULL OR u.is_open = 1)
        AND (u.role != 'admin' OR u.point_name IS NOT NULL)
        AND (
          u.role = 'seller'
          OR EXISTS (SELECT 1 FROM products p WHERE p.seller_id = u.id AND (p.is_available = 1 OR p.is_available IS NULL))
          OR EXISTS (SELECT 1 FROM categories c WHERE c.seller_id = u.id)
        )
      ORDER BY CASE WHEN u.id = 2 THEN 0 ELSE 1 END, u.id ASC
    `).all();

    const result = sellers.map(seller => {
      const cats = db.prepare('SELECT * FROM categories WHERE seller_id = ?').all(seller.id);
      return {
        ...seller,
        categories: cats.map(cat => ({
          ...cat,
          products: db.prepare('SELECT * FROM products WHERE category_id = ? AND (is_available = 1 OR is_available IS NULL)').all(cat.id)
        }))
      };
    }).filter(s => s.categories.some(c => c.products.length > 0));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create order (bitta sotuvchidan; bitta mahsulot yoki savat)
router.post('/orders', (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const { product_id, quantity, items, delivery_address, customer_lat, customer_lon, payment_method } = req.body;
    const payMethod = payment_method === 'cash' ? 'cash' : 'card';
    const wanted = Array.isArray(items) && items.length > 0
      ? items.map(i => ({ id: Number(i.product_id || i.id), qty: Math.min(99, Math.max(1, Math.floor(Number(i.quantity)) || 1)) }))
      : [{ id: Number(product_id), qty: Math.min(99, Math.max(1, Math.floor(Number(quantity)) || 1)) }];

    let sellerId = null;
    let totalQuantity = 0;
    let productsPrice = 0;
    const itemsList = [];

    for (const w of wanted) {
      const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(w.id);
      if (!prod || !prod.is_available) return res.status(400).json({ error: 'Mahsulot topilmadi yoki hozir mavjud emas' });
      if (prod.stock !== null && prod.stock !== undefined && prod.stock < w.qty) {
        return res.status(400).json({
          error: `"${prod.name}" mahsulotidan atigi ${prod.stock} ta qolgan! Siz ${w.qty} ta buyurtma qilmoqchisiz.`
        });
      }
      if (sellerId && sellerId !== prod.seller_id) {
        return res.status(400).json({ error: 'Bitta buyurtmada faqat bitta sotuvchining mahsulotlari bo\'lishi mumkin' });
      }
      sellerId = prod.seller_id;
      totalQuantity += w.qty;
      productsPrice += (Number(prod.price) || 0) * w.qty;
      itemsList.push({ id: prod.id, name: prod.name, price: prod.price, weight: prod.weight, quantity: w.qty });
    }

    if (!sellerId || productsPrice <= 0) {
      return res.status(400).json({ error: 'Savatcha bo\'sh yoki mahsulot topilmadi' });
    }

    const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(sellerId);
    if (!seller || seller.is_blocked || (seller.is_open !== null && seller.is_open === 0)) {
      return res.status(400).json({ error: 'Sotuvchi hozir ishlamayapti yoki do\'kon yopiq' });
    }
    const nLat = num(customer_lat), nLon = num(customer_lon);
    if (!validCoords(nLat, nLon)) {
      return res.status(400).json({
        error: "Buyurtma berish uchun lokatsiyangizni yoqish (GPS) yoki xaritadan manzilni belgilash majburiy!"
      });
    }

    const cLat = nLat;
    const cLon = nLon;
    const addr = String(delivery_address || user.address || `GPS: ${cLat.toFixed(5)}, ${cLon.toFixed(5)}`).slice(0, 250);
    const sLat = seller.lat ?? null;
    const sLon = seller.lon ?? null;

    const rates = db.getCommissionRates();
    const pricePerKm = rates.courierPricePerKm ?? 3000;
    const { distanceKm, courierFee } = calculateCourierFee(sLat, sLon, cLat, cLon, pricePerKm);

    const deliveryFee = courierFee;
    const totalPrice = productsPrice + deliveryFee;

    const adminFee = Math.round(productsPrice * (rates.adminPct / 100));
    const sellerNet = Math.max(0, productsPrice - adminFee);

    const requiredCommission = adminFee + courierFee;
    if ((Number(seller.seller_balance) || 0) < requiredCommission) {
      return res.status(400).json({
        error: `Ushbu sotuvchi balansi yetarli emas (talab: ${requiredCommission.toLocaleString()} so'm). Sotuvchi balansini to'ldirgach buyurtma qabul qila oladi.`
      });
    }

    // Mijozning kiritgan koordinata va manzilini keyingi safar uchun ham profiliga saqlab qo'yamiz
    try {
      db.prepare('UPDATE users SET lat = ?, lon = ?, address = ? WHERE id = ?').run(cLat, cLon, addr, user.id);
    } catch (e) {}

    const r = db.prepare(`
      INSERT INTO orders (
        customer_id, seller_id, product_id, items_json, quantity, total_price,
        products_price, delivery_fee, delivery_distance_km,
        status, delivery_address, customer_lat, customer_lon, seller_lat, seller_lon,
        admin_fee, courier_fee, seller_net, payment_method
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user.id, sellerId, itemsList[0].id, JSON.stringify(itemsList), totalQuantity, totalPrice, productsPrice, deliveryFee, distanceKm, addr, cLat, cLon, sLat, sLon, adminFee, courierFee, sellerNet, payMethod);

    const orderId = Number(r.lastInsertRowid);
    for (const it of itemsList) {
      try {
        db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)').run(orderId, it.id, it.quantity, it.price);
        db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').run(it.quantity, it.id);
        db.prepare('UPDATE products SET is_available = 0 WHERE id = ? AND stock <= 0').run(it.id);
      } catch (e) {}
    }

    // Agar mijoz NAQD PUL bilan buyurtma bergan bo'lsa, sotuvchi va adminga darhol xabar yuboriladi
    if (payMethod === 'cash') {
      const itemsDesc = itemsList.map(i => `• ${esc(i.name)} × ${i.quantity} ta`).join('\n');
      const deliveryInfo =
        `📦 Mahsulotlar: <b>${productsPrice.toLocaleString()} so'm</b>\n` +
        `🚴 Kuryer ulushi (~${distanceKm} km × ${pricePerKm.toLocaleString()} so'm/km): <b>${deliveryFee.toLocaleString()} so'm</b>\n`;
      const caption =
        `💵 <b>Yangi NAQD PUL orqali buyurtma #${orderId}!</b>\n\n` +
        `👤 Mijoz: <b>${esc(user.first_name)} ${esc(user.last_name)}</b> (${esc(user.phone || 'Tel kiritilmagan')})\n` +
        `📍 Manzil: <b>${esc(addr)}</b>\n` +
        (itemsDesc ? `🍔 Buyurtma tarkibi:\n${itemsDesc}\n` : '') +
        deliveryInfo +
        `💰 Umumiy hisob: <b>${Number(totalPrice).toLocaleString()} so'm</b>\n` +
        `💵 <b>To'lov turi: NAQD PUL (Yetkazilganda olinadi)</b>\n\n` +
        `Buyurtmani qabul qilib tayyorlashni boshlash uchun tasdiqlang:`;

      const markup = {
        inline_keyboard: [[
          { text: '✅ Qabul qilish (Tayyorlash)', callback_data: `seller_confirm_order_${orderId}` },
          { text: '❌ Rad etish', callback_data: `seller_reject_order_${orderId}` }
        ]]
      };

      // Naqd pul buyurtmasi faqat sotuvchining o'ziga yuboriladi (barcha admin yoki boshqalarga tarqalmaydi)
      if (seller?.telegram_id && Number(seller.telegram_id) > 1000000) {
        sendNotification(seller.telegram_id, caption, { reply_markup: markup });
      }

      // Mijozning o'ziga buyurtmasi qabul qilingani haqida bot orqali xabar boradi
      if (user?.telegram_id && Number(user.telegram_id) > 1000000) {
        sendNotification(
          user.telegram_id,
          `🛍️ <b>Buyurtmangiz #${orderId} rasmiylashtirildi!</b>\n` +
          `📦 Mahsulotlar: <b>${productsPrice.toLocaleString()} so'm</b>\n` +
          `🚴 Kuryer ulushi (~${distanceKm} km): <b>${deliveryFee.toLocaleString()} so'm</b>\n` +
          `💰 Umumiy hisob: <b>${Number(totalPrice).toLocaleString()} so'm</b>\n` +
          `💵 To'lov usuli: <b>Naqd pul (yetkazilganda)</b>` +
          `\n\nSotuvchi taomni tayyorlashni boshlagach sizga xabar beramiz.`
        );
      }
    }

    res.json({
      success: true,
      order_id: orderId,
      total_price: totalPrice,
      products_price: productsPrice,
      delivery_fee: deliveryFee,
      courier_fee: courierFee,
      distance_km: distanceKm,
      summary: itemsList.map(i => `${i.name} (x${i.quantity})`).join(', ')
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET customer orders
router.get('/orders/:telegramId', (req, res) => {
  try {
    const targetTid = Number(req.params.telegramId) || (req.tg && Number(req.tg.id));
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(targetTid);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const activeOnly = req.query.active_only === 'true' || req.query.active === '1';
    const statusCondition = activeOnly ? "AND o.status NOT IN ('delivered', 'cancelled', 'rejected')" : "";

    const orders = db.prepare(`
      SELECT o.*,
        p.name as product_name, p.price as product_price, p.photo_url as product_photo,
        s.first_name as seller_name, s.point_name as seller_point, s.card_number as seller_card, s.card_holder as seller_card_holder, s.lat as s_lat, s.lon as s_lon,
        cr.first_name as courier_name, cr.last_name as courier_lastname, cr.phone as courier_phone, cr.telegram_id as courier_telegram_id, cr.lat as cr_lat, cr.lon as cr_lon
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users s ON o.seller_id = s.id
      LEFT JOIN users cr ON o.courier_id = cr.id
      WHERE o.customer_id = ? ${statusCondition}
      ORDER BY o.created_at DESC
    `).all(user.id);

    res.json(orders.map(o => {
      let parsedItems = [];
      try { if (o.items_json) parsedItems = JSON.parse(o.items_json); } catch (e) {}
      const displayTitle = parsedItems.length > 0
        ? parsedItems.map(i => `${i.name} ×${i.quantity}`).join(', ')
        : o.product_name;
      return {
        ...o,
        items: parsedItems,
        product_name: displayTitle || o.product_name,
        seller_lat: o.seller_lat ?? o.s_lat ?? null,
        seller_lon: o.seller_lon ?? o.s_lon ?? null,
        courier_lat: o.courier_lat ?? o.cr_lat ?? null,
        courier_lon: o.courier_lon ?? o.cr_lon ?? null
      };
    }));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST cancel order by customer (yanglishib yoki bilmasdan bosib yuborilganda)
router.post('/orders/:orderId/cancel', async (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });

    const { order, customer, seller } = cancelOrderByCustomer(req.params.orderId, req.tg.id);

    // Sotuvchiga va adminga darhol bildirishnoma yuborish
    const cancelMsg =
      `🚫 <b>Buyurtma #${order.id} mijoz tomonidan bekor qilindi.</b>\n\n` +
      `👤 Mijoz: <b>${esc(customer.first_name)} ${esc(customer.last_name)}</b>\n` +
      `💰 Summa: <b>${Number(order.total_price).toLocaleString()} so'm</b>\n` +
      `ℹ️ Sabab: Mijoz yanglishib yoki tasodifan bosib yuborgani sababli bekor qildi.`;

    if (seller?.telegram_id && Number(seller.telegram_id) > 1000000) {
      sendNotification(seller.telegram_id, cancelMsg);
    }
    notifyAdmins(cancelMsg);

    res.json({ success: true, message: 'Buyurtma bekor qilindi' });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// GET customer gifts
router.get('/gifts/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Not found' });
    res.json(db.prepare('SELECT * FROM gifts WHERE to_user_id = ? ORDER BY created_at DESC').all(user.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST upload receipt (Customer to Seller) — faqat o'z buyurtmasi uchun
router.post('/payments/upload-receipt', upload.single('receipt'), async (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.body.order_id));
    if (!order) return res.status(404).json({ error: 'Buyurtma topilmadi' });
    if (order.customer_id !== user.id) return res.status(403).json({ error: 'Bu buyurtma sizniki emas!' });
    if (!['pending', 'rejected', 'paid_waiting'].includes(order.status)) {
      return res.status(400).json({ error: 'Bu buyurtma uchun chek yuborib bo\'lmaydi.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Chek rasmini yuklang' });

    const receipt_url = `/uploads/${req.file.filename}`;
    const paidAmount = order.total_price;

    db.prepare(`
      INSERT INTO payments (from_user_id, to_user_id, order_id, amount, receipt_url, status, type)
      VALUES (?, ?, ?, ?, ?, 'pending', 'customer_to_seller')
    `).run(user.id, order.seller_id, order.id, paidAmount, receipt_url);

    db.prepare("UPDATE orders SET status = 'paid_waiting', receipt_url = ? WHERE id = ?").run(receipt_url, order.id);

    const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
    let itemsDesc = '';
    try {
      if (order.items_json) {
        itemsDesc = JSON.parse(order.items_json).map(i => `• ${esc(i.name)} × ${i.quantity} ta`).join('\n');
      }
    } catch (e) {}

    const caption =
      `🧾 <b>Yangi buyurtma #${order.id} uchun to'lov cheki keldi!</b>\n\n` +
      `👤 Mijoz: <b>${esc(user.first_name)} ${esc(user.last_name)}</b> (${esc(user.phone || 'Tel yoq')})\n` +
      `📍 Manzil: <b>${esc(order.delivery_address || user.address || 'Kiritilmagan')}</b>\n` +
      `💳 <b>To'lov turi: KARTA (Chek ilova qilindi)</b>\n` +
      (itemsDesc ? `🍔 Buyurtma tarkibi:\n${itemsDesc}\n` : '') +
      `💰 To'lov summasi: <b>${Number(paidAmount).toLocaleString()} so'm</b>\n\n` +
      `Chekni tekshirib, buyurtmani tasdiqlang:`;

    const markup = {
      inline_keyboard: [[
        { text: '✅ Qabul qilish (Tasdiqlash)', callback_data: `seller_confirm_order_${order.id}` },
        { text: '❌ Rad etish', callback_data: `seller_reject_order_${order.id}` }
      ]]
    };

    // Chek faqat ushbu do'kon egasiga (sotuvchiga) yuboriladi
    if (seller?.telegram_id && Number(seller.telegram_id) > 1000000) {
      await sendPhotoNotification(seller.telegram_id, receipt_url, caption, markup);
    }

    res.json({ success: true, message: 'To\'lov cheki sotuvchiga yuborildi! Sotuvchi tasdiqlashi bilan buyurtma tayyorlanadi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET dynamic delivery settings (for catalog banner & cart)
router.get('/delivery-settings', (req, res) => {
  try {
    const rates = db.getCommissionRates();
    res.json({
      courierPricePerKm: rates.courierPricePerKm ?? 3000,
      adminPct: rates.adminPct ?? 5,
      sellerPct: rates.sellerPct ?? 95
    });
  } catch (e) {
    res.json({ courierPricePerKm: 3000, adminPct: 5, sellerPct: 95 });
  }
});

module.exports = router;
