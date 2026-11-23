const express = require('express');
const router = express.Router();
const db = require('../database');
const upload = require('../uploader');
const { sendNotification, sendPhotoNotification } = require('../bot');
const { confirmDeposit, rejectDeposit, OrderError } = require('../orderService');

// Check if current Telegram user is an admin (server tekshiradi, URL emas)
router.get('/check-access/:telegramId', (req, res) => {
  res.json({ isAdmin: req.tg.isAdmin, id: req.tg.id });
});

// GET admin profile
router.get('/profile/:telegramId', (req, res) => {
  try {
    const tid = req.tg.id;
    let user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
    if (!user) {
      db.prepare(`
        INSERT INTO users (telegram_id, role, first_name, last_name, username)
        VALUES (?, 'admin', 'Admin', '', '')
      `).run(tid);
      user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
    } else if (user.role !== 'admin') {
      db.prepare("UPDATE users SET role = 'admin' WHERE telegram_id = ?").run(tid);
      user.role = 'admin';
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update admin profile
router.put('/profile/:telegramId', upload.single('photo'), (req, res) => {
  try {
    const tid = req.tg.id;
    const { first_name, last_name, username, card_number, card_holder } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const current = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);

    if (!current) {
      return res.status(404).json({ error: 'User not found' });
    }

    db.prepare(`
      UPDATE users SET 
        first_name = ?, last_name = ?, username = ?, card_number = ?, card_holder = ?,
        photo_url = COALESCE(?, photo_url)
      WHERE telegram_id = ?
    `).run(
      first_name !== undefined ? first_name : current.first_name,
      last_name !== undefined ? last_name : current.last_name,
      username !== undefined ? username : current.username,
      card_number !== undefined ? card_number : current.card_number,
      card_holder !== undefined ? card_holder : current.card_holder,
      photo_url,
      tid
    );

    // Also sync card details across all admin records so sellers/couriers always see the updated admin card
    if (card_number) {
      db.prepare("UPDATE users SET card_number = ?, card_holder = ? WHERE role = 'admin'").run(
        card_number,
        card_holder || current.card_holder || 'ADMIN'
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Admin kuzatuvi uchun: rol bo'yicha foydalanuvchilar ro'yxati
router.get('/users', (req, res) => {
  const role = String(req.query.role || '');
  if (!['seller', 'courier', 'customer'].includes(role)) return res.status(400).json({ error: 'role noto\'g\'ri' });
  res.json(db.prepare('SELECT id, telegram_id, first_name, last_name, username, point_name FROM users WHERE role = ? ORDER BY created_at DESC').all(role));
});

// GET all couriers (barcha kuryerlik qilgan yoki kuryer roliga ega foydalanuvchilar)
router.get('/couriers', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.*,
        COALESCE((SELECT COUNT(*) FROM orders WHERE courier_id = u.id AND status = 'delivered'), 0) as delivered_orders_count,
        COALESCE((SELECT COUNT(*) FROM orders WHERE courier_id = u.id AND status IN ('accepted', 'delivering')), 0) as active_orders_count,
        COALESCE((SELECT SUM(total_price) FROM orders WHERE courier_id = u.id AND status = 'delivered' AND payment_method = 'cash'), 0) as total_cash_collected
      FROM users u
      WHERE u.role = 'courier'
         OR u.is_online = 1
         OR EXISTS (SELECT 1 FROM orders WHERE courier_id = u.id)
      ORDER BY u.created_at DESC
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET courier by id (kuryer tafsilotlari va buyurtmalari)
router.get('/couriers/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    const payments = db.prepare("SELECT * FROM payments WHERE to_user_id = ? AND type = 'admin_to_courier' ORDER BY created_at DESC").all(row.id);
    const orders = db.prepare(`
      SELECT o.*, p.name as product_name, s.point_name as seller_point, s.first_name as seller_name,
             c.first_name as customer_name, c.last_name as customer_lastname
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users s ON o.seller_id = s.id
      LEFT JOIN users c ON o.customer_id = c.id
      WHERE o.courier_id = ?
      ORDER BY o.created_at DESC LIMIT 20
    `).all(row.id);
    res.json({ ...row, payments, orders });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST pay courier (upload receipt -> send to courier bot -> unpaid_amount = 0)
router.post('/couriers/:id/pay', upload.single('receipt'), async (req, res) => {
  try {
    const courier = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!courier) return res.status(404).json({ error: 'Not found' });

    const amount = Number(courier.unpaid_amount) || 0;
    const receipt_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.prepare(`
      INSERT INTO payments (from_user_id, to_user_id, amount, receipt_url, status, type)
      VALUES (?, ?, ?, ?, 'confirmed', 'admin_to_courier')
    `).run((db.prepare('SELECT id FROM users WHERE telegram_id = ?').get(req.tg.id)?.id || 1), courier.id, amount, receipt_url);

    db.prepare('UPDATE users SET unpaid_amount = 0 WHERE id = ?').run(courier.id);

    // Send receipt photo and notification to Courier's Telegram Bot
    if (courier.telegram_id) {
      await sendPhotoNotification(
        courier.telegram_id,
        receipt_url,
        `💸 <b>Admin sizning kuryerlik hisobingizni to'lab berdi!</b>\n\n` +
        `💰 To'langan summa: <b>${amount.toLocaleString()} so'm</b>\n` +
        `💳 Karta: <code>${courier.card_number || 'Kiritilmagan'}</code>\n` +
        `✅ To'lanmagan balansingiz <b>0 so'm</b> ga tushirildi.`
      );
    }

    res.json({ success: true, paid_amount: amount, receipt_url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST block courier
router.post('/couriers/:id/block', (req, res) => {
  try {
    db.prepare('UPDATE users SET is_blocked = 1 WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true, blocked: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST unblock courier
router.post('/couriers/:id/unblock', (req, res) => {
  try {
    db.prepare('UPDATE users SET is_blocked = 0 WHERE id = ?').run(Number(req.params.id));
    res.json({ success: true, blocked: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET all sellers (with pending deposits, sales, products count)
router.get('/sellers', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.*,
        COALESCE((SELECT COUNT(*) FROM products WHERE seller_id = u.id), 0) as products_count,
        COALESCE((SELECT COUNT(*) FROM categories WHERE seller_id = u.id), 0) as categories_count,
        COALESCE((SELECT COUNT(*) FROM orders WHERE seller_id = u.id), 0) as orders_count,
        COALESCE((SELECT SUM(total_price) FROM orders WHERE seller_id = u.id AND status = 'delivered'), 0) as total_sales,
        COALESCE((SELECT SUM(total_price) FROM orders WHERE seller_id = u.id AND status = 'delivered' AND payment_method = 'cash'), 0) as cash_sales
      FROM users u
      WHERE u.role = 'seller'
         OR u.point_name IS NOT NULL
         OR EXISTS (SELECT 1 FROM products WHERE seller_id = u.id)
         OR EXISTS (SELECT 1 FROM categories WHERE seller_id = u.id)
      ORDER BY u.created_at DESC
    `).all();

    const enriched = rows.map(s => {
      const deposits = db.prepare("SELECT * FROM payments WHERE from_user_id = ? AND type = 'seller_to_admin' ORDER BY created_at DESC").all(s.id);
      const pendingDeposits = deposits.filter(d => d.status === 'pending');
      const curBalance = Number(s.seller_balance) || 0;
      const assignedAmount = s.required_deposit_amount !== null && s.required_deposit_amount !== undefined ? Number(s.required_deposit_amount) : 300000;
      const requiredDeposit = curBalance < 200000 ? Math.max(0, 300000 - curBalance) : 0;
      return {
        ...s,
        deposits,
        pending_deposits_count: pendingDeposits.length,
        required_deposit: requiredDeposit,
        required_deposit_amount: assignedAmount
      };
    });
    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET seller by id (sotuvchi to'liq ma'lumotlari, taomlari, kategoriyalari va depozitlari)
router.get('/sellers/:id', (req, res) => {
  try {
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Not found' });
    const deposits = db.prepare("SELECT * FROM payments WHERE from_user_id = ? AND type = 'seller_to_admin' ORDER BY created_at DESC").all(row.id);
    const products = db.prepare('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.seller_id = ? ORDER BY p.id DESC').all(row.id);
    const categories = db.prepare('SELECT * FROM categories WHERE seller_id = ? ORDER BY id DESC').all(row.id);
    const recentOrders = db.prepare(`
      SELECT o.*, p.name as product_name, c.first_name as customer_name, c.phone as customer_phone
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users c ON o.customer_id = c.id
      WHERE o.seller_id = ?
      ORDER BY o.created_at DESC LIMIT 15
    `).all(row.id);

    const curBalance = Number(row.seller_balance) || 0;
    const assignedAmount = row.required_deposit_amount !== null && row.required_deposit_amount !== undefined ? Number(row.required_deposit_amount) : 300000;
    const requiredDeposit = curBalance < 200000 ? Math.max(0, 300000 - curBalance) : 0;

    res.json({
      ...row,
      deposits,
      products,
      categories,
      orders: recentOrders,
      required_deposit: requiredDeposit,
      required_deposit_amount: assignedAmount
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST set required deposit amount for seller (Admin kiritgan to'lov summasi)
router.post('/sellers/:id/set-deposit-amount', async (req, res) => {
  try {
    const sellerId = Number(req.params.id);
    const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(sellerId);
    if (!seller) return res.status(404).json({ error: 'Sotuvchi topilmadi' });

    const newAmount = Math.max(0, Math.round(Number(req.body.amount) || 0));
    db.prepare('UPDATE users SET required_deposit_amount = ? WHERE id = ?').run(newAmount, sellerId);

    // Notify seller via bot
    if (seller.telegram_id) {
      const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      await sendNotification(
        seller.telegram_id,
        `🔔 <b>Admin to'lov summasini belgiladi!</b>\n\n` +
        `🏪 Punkt: <b>${esc(seller.point_name || seller.first_name || 'Sotuvchi')}</b>\n` +
        `💰 To'lanishi kerak bo'lgan summa: <b>${newAmount.toLocaleString()} so'm</b>\n\n` +
        `Iltimos, ushbu summani Admin kartasiga o'tkazib, ilovadan to'lov chekini yuklang!`
      ).catch(() => {});
    }

    res.json({ success: true, required_deposit_amount: newAmount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST confirm seller deposit receipt
router.post('/sellers/deposits/:paymentId/confirm', async (req, res) => {
  try {
    const paymentId = Number(req.params.paymentId);
    const existing = db.prepare('SELECT * FROM payments WHERE id = ?').get(paymentId);
    if (!existing) return res.status(404).json({ error: 'To\'lov topilmadi' });
    if (existing.status === 'confirmed') {
      return res.json({ success: true, alreadyConfirmed: true });
    }

    const { payment, seller } = confirmDeposit(paymentId, req.body?.amount);
    if (seller?.telegram_id) {
      const changed = Number(payment.requested_amount) !== Number(payment.amount)
        ? `\n<i>(Siz ${Number(payment.requested_amount || 0).toLocaleString()} so'm deb yozgansiz, Admin ${Number(payment.amount).toLocaleString()} so'm qabul qildi)</i>`
        : '';
      await sendNotification(
        seller.telegram_id,
        `✅ <b>Admin sizning ${Number(payment.amount).toLocaleString()} so'm depozit to'lovingizni tasdiqladi!</b>${changed}\n` +
        `💰 Joriy sotuvchi balansingiz: <b>${Number(seller.seller_balance).toLocaleString()} so'm</b>`
      );
    }

    res.json({ success: true, amount: payment.amount, new_balance: seller?.seller_balance || 0 });
  } catch (e) {
    res.status(e instanceof OrderError ? e.status : 500).json({ error: e.message });
  }
});

// POST reject seller deposit receipt
router.post('/sellers/deposits/:paymentId/reject', async (req, res) => {
  try {
    const { payment, seller } = rejectDeposit(Number(req.params.paymentId));
    if (seller?.telegram_id) {
      await sendNotification(
        seller.telegram_id,
        `❌ <b>Admin sizning ${Number(payment.amount).toLocaleString()} so'm depozit chekingizni rad etdi.</b>\nIltimos, to'g'ri chek yuklang yoki admin bilan bog'laning.`
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(e instanceof OrderError ? e.status : 500).json({ error: e.message });
  }
});

// GET seller categories + products
router.get('/sellers/:id/categories', (req, res) => {
  try {
    const cats = db.prepare('SELECT * FROM categories WHERE seller_id = ?').all(Number(req.params.id));
    const result = cats.map(cat => ({
      ...cat,
      products: db.prepare('SELECT * FROM products WHERE category_id = ?').all(cat.id)
    }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST block/unblock seller
router.post('/sellers/:id/block', (req, res) => {
  try {
    const { blocked } = req.body;
    db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET all customers (barcha xarid qilgan yoki mijoz sifatida kirgan foydalanuvchilar)
router.get('/customers', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT u.*,
        COALESCE((SELECT COUNT(*) FROM orders WHERE customer_id = u.id), 0) as orders_count,
        COALESCE((SELECT SUM(total_price) FROM orders WHERE customer_id = u.id AND status != 'cancelled'), 0) as total_spent,
        COALESCE((SELECT COUNT(*) FROM complaints WHERE customer_id = u.id), 0) as complaints_count,
        COALESCE((SELECT COUNT(*) FROM gifts WHERE to_user_id = u.id), 0) as gifts_count,
        COALESCE(u.phone, (SELECT phone FROM orders WHERE customer_id = u.id AND phone IS NOT NULL ORDER BY id DESC LIMIT 1)) as display_phone,
        COALESCE(u.address, (SELECT delivery_address FROM orders WHERE customer_id = u.id AND delivery_address IS NOT NULL ORDER BY id DESC LIMIT 1)) as display_address
      FROM users u
      WHERE u.role = 'customer'
         OR EXISTS (SELECT 1 FROM orders WHERE customer_id = u.id)
         OR (u.role != 'admin' AND u.telegram_id != 8354505239)
      ORDER BY u.created_at DESC
    `).all();

    const enriched = rows.map(c => ({
      ...c,
      phone: c.phone || c.display_phone || '',
      address: c.address || c.display_address || '',
      total_orders: c.orders_count || c.total_orders || 0
    }));

    res.json(enriched);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET customer by id (mijozning barcha buyurtmalari, shikoyatlari va sovg'alari)
router.get('/customers/:id', (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!customer) return res.status(404).json({ error: 'Not found' });
    const complaints = db.prepare('SELECT * FROM complaints WHERE customer_id = ? ORDER BY created_at DESC').all(customer.id);
    const gifts = db.prepare('SELECT * FROM gifts WHERE to_user_id = ? ORDER BY created_at DESC').all(customer.id);
    const orders = db.prepare(`
      SELECT o.*, p.name as product_name, s.point_name as seller_point, s.first_name as seller_name,
             cr.first_name as courier_name, cr.phone as courier_phone
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users s ON o.seller_id = s.id
      LEFT JOIN users cr ON o.courier_id = cr.id
      WHERE o.customer_id = ?
      ORDER BY o.created_at DESC LIMIT 30
    `).all(customer.id);

    const totalSpent = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + (Number(o.total_price) || 0), 0);

    res.json({
      ...customer,
      complaints,
      gifts,
      orders,
      total_orders: orders.length,
      total_spent: totalSpent
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST block customer
router.post('/customers/:id/block', (req, res) => {
  try {
    const { blocked } = req.body;
    db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked ? 1 : 0, Number(req.params.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST send gift to customer
router.post('/customers/:id/gift', async (req, res) => {
  try {
    const { gift_emoji, gift_name, from_user_id } = req.body;
    const customerId = Number(req.params.id);
    db.prepare(`
      INSERT INTO gifts (from_user_id, to_user_id, gift_emoji, gift_name)
      VALUES (?, ?, ?, ?)
    `).run(Number(from_user_id || 1), customerId, gift_emoji, gift_name);

    const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(customerId);
    if (customer?.telegram_id) {
      await sendNotification(
        customer.telegram_id,
        `🎁 <b>Admindan sizga maxsus sovg'a keldi!</b>\n\n` +
        `${gift_emoji} <b>${gift_name}</b>\n\n` +
        `<i>Doimiy mijozimiz bo'lganingiz uchun tashakkur! Sovg'angizni Mijoz profilidagi "Sovg'alar qutisi"da ko'rishingiz mumkin.</i>`
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET revenue & financial overview
router.get('/revenue/:telegramId', (req, res) => {
  try {
    const totalOrders = db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(total_price), 0) as total,
        COALESCE(SUM(COALESCE(NULLIF(products_price, 0), total_price)), 0) as products_total,
        COALESCE(SUM(admin_fee), 0) as admin_total,
        COALESCE(SUM(courier_fee), 0) as courier_total,
        COALESCE(SUM(seller_net), 0) as seller_total
      FROM orders
      WHERE status IN ('delivering', 'delivered') OR shares_deducted = 1
    `).get();
    const confirmedDeposits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE type = 'seller_to_admin' AND status = 'confirmed'").get();
    const pendingDeposits = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE type = 'seller_to_admin' AND status = 'pending'").get();
    const paidToCouriers = db.prepare("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE type = 'admin_to_courier' AND status = 'confirmed'").get();
    const unpaidToCouriers = db.prepare("SELECT COALESCE(SUM(unpaid_amount), 0) as total FROM users WHERE role = 'courier'").get();

    const grossTurnover = totalOrders?.total || 0;
    const productsTurnover = totalOrders?.products_total || grossTurnover;
    const rates = db.getCommissionRates();
    const adminEarned = totalOrders?.admin_total > 0 ? totalOrders.admin_total : Math.round(productsTurnover * (rates.adminPct / 100));
    const courierEarned = totalOrders?.courier_total || 0;
    const sellerEarned = totalOrders?.seller_total > 0 ? totalOrders.seller_total : Math.round(productsTurnover * (rates.sellerPct / 100));

    const totalDepositsReceived = confirmedDeposits?.total || 0;
    const totalPaidCouriers = paidToCouriers?.total || 0;

    res.json({
      total_revenue: grossTurnover,
      total_orders: totalOrders?.count || 0,
      admin_share: adminEarned,
      courier_share_total: courierEarned,
      seller_share_total: sellerEarned,
      rates,
      deposits_received: totalDepositsReceived,
      pending_deposits: pendingDeposits?.total || 0,
      paid_to_couriers: totalPaidCouriers,
      unpaid_to_couriers: unpaidToCouriers?.total || 0,
      current_balance: totalDepositsReceived - totalPaidCouriers,
      net_profit: adminEarned
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET tariff & commission settings
router.get('/settings', (req, res) => {
  try {
    const rates = db.getCommissionRates();
    res.json(rates);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST update tariff settings (Admin % + Seller % auto, Courier 1 km price)
router.post('/settings', (req, res) => {
  try {
    const parsedAdmin = Number(req.body.admin_fee_percent);
    const adminPct = Number.isFinite(parsedAdmin) ? Math.max(0, Math.min(99, parsedAdmin)) : 5;
    if (adminPct >= 100) {
      return res.status(400).json({ error: "Admin komissiyasi 100% dan kam bo'lishi kerak!" });
    }

    const parsedPerKm = Number(req.body.courier_price_per_km);
    const courierPricePerKm = Number.isFinite(parsedPerKm) ? Math.max(0, Math.round(parsedPerKm)) : 3000;

    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('admin_fee_percent', ?)").run(String(adminPct));
    db.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('courier_price_per_km', ?)").run(String(courierPricePerKm));

    const rates = db.getCommissionRates();
    res.json({ success: true, rates });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET access requests list with stats
router.get('/access-requests', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM access_requests ORDER BY id DESC').all();
    const pendingCount = list.filter(r => r.status === 'pending').length;
    const approvedCount = list.filter(r => r.status === 'approved').length;
    const rejectedCount = list.filter(r => r.status === 'rejected').length;

    res.json({
      list,
      stats: {
        total: list.length,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST approve access request and send access code to user via Telegram Bot
router.post('/access-requests/:id/approve', async (req, res) => {
  try {
    const reqId = Number(req.params.id);
    const item = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(reqId);
    if (!item) return res.status(404).json({ error: 'So\'rov topilmadi' });

    // Kodni olish yoki 6 xonali tasodifiy kod yaratish
    const code = String(req.body.access_code || Math.floor(100000 + Math.random() * 900000)).trim();

    db.prepare(`
      UPDATE access_requests SET
        status = 'approved',
        access_code = ?,
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(code, reqId);

    // Foydalanuvchiga ruxsat beramiz
    if (item.requested_role === 'seller') {
      db.prepare(`
        UPDATE users SET
          is_seller_approved = 1,
          seller_access_code = ?,
          role = CASE WHEN role = 'customer' THEN 'seller' ELSE role END
        WHERE telegram_id = ?
      `).run(code, item.telegram_id);
    } else {
      db.prepare(`
        UPDATE users SET
          is_courier_approved = 1,
          courier_access_code = ?,
          role = CASE WHEN role = 'customer' THEN 'courier' ELSE role END
        WHERE telegram_id = ?
      `).run(code, item.telegram_id);
    }

    // Foydalanuvchiga Telegram botdan xabar yuborish
    const roleBadge = item.requested_role === 'seller' ? '🏪 SOTUVCHI' : '🚴 KURYER';
    const notifyText =
      `🎉 <b>TABRIKLAYMIZ!</b>\n\n` +
      `Sizning <b>${roleBadge}</b> bo'lish arizangiz Administrator tomonidan tasdiqlandi!\n\n` +
      `🔑 <b>Sizning shaxsiy kirish kodingiz:</b> <code>${code}</code>\n\n` +
      `Ilovani oching va ushbu kodni kiritib o'z faoliyatingizni to'liq boshlashingiz mumkin. Omad!`;

    sendNotification(item.telegram_id, notifyText).catch(() => {});

    res.json({
      success: true,
      code,
      message: `So'rov tasdiqlandi va ${item.telegram_id} raqamli foydalanuvchiga Telegram orqali kod (${code}) yuborildi!`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST reject access request (Bekor qilish)
router.post('/access-requests/:id/reject', async (req, res) => {
  try {
    const reqId = Number(req.params.id);
    const item = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(reqId);
    if (!item) return res.status(404).json({ error: 'So\'rov topilmadi' });

    db.prepare(`
      UPDATE access_requests SET
        status = 'rejected',
        reviewed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(reqId);

    // Foydalanuvchiga rad etilgani haqida botdan xabar
    const roleBadge = item.requested_role === 'seller' ? '🏪 SOTUVCHI' : '🚴 KURYER';
    const rejectText =
      `ℹ️ <b>Hurmatli foydalanuvchi!</b>\n\n` +
      `Sizning <b>${roleBadge}</b> bo'lish arizangiz Administrator tomonidan <b>bekor qilindi</b>.\n` +
      `Siz tizimdan buyurtma beruvchi mijoz sifatida to'liq foydalanishingiz mumkin.`;

    sendNotification(item.telegram_id, rejectText).catch(() => {});

    res.json({
      success: true,
      message: `So'rov bekor qilindi va foydalanuvchiga xabar berildi.`
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE access request (butunlay tozalash)
router.delete('/access-requests/:id', (req, res) => {
  try {
    const reqId = Number(req.params.id);
    db.prepare('DELETE FROM access_requests WHERE id = ?').run(reqId);
    res.json({ success: true, message: 'So\'rov muvaffaqiyatli o\'chirildi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
