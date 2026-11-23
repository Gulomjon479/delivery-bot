const express = require('express');
const router = express.Router();
const db = require('../database');
const upload = require('../uploader');
const { sendNotification, notifyAdmins, notifyNearbyCouriers } = require('../bot');
const { OrderError, confirmOrderPayment, rejectOrderPayment, customerConfirmedText, customerRejectedText } = require('../orderService');
const { calculateCourierFee } = require('../geo');

const num = (v) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
const validCoords = (lat, lon) => lat !== null && lon !== null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
const me = (req) => db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(req.tg.id);

// GET seller profile
router.get('/profile/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi' });
    const adminUser = db.prepare("SELECT id, card_number, card_holder FROM users WHERE role = 'admin' ORDER BY CASE WHEN card_number IS NOT NULL AND card_number != '' THEN 0 ELSE 1 END, id ASC LIMIT 1").get();
    res.json({
      ...user,
      admin_id: adminUser?.id || 1,
      admin_card: adminUser?.card_number || '8600 0000 0000 0000',
      admin_card_holder: adminUser?.card_holder || 'ADMINISTRATOR'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update seller profile (faqat o'zining)
router.put('/profile/:telegramId', upload.single('photo'), (req, res) => {
  try {
    const targetTid = Number(req.params.telegramId) || (req.tg && Number(req.tg.id));
    const current = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(targetTid) || me(req);
    if (!current) return res.status(404).json({ error: 'User not found' });
    const { first_name, last_name, username, phone, point_name, card_number, card_holder, address, lat, lon } = req.body;
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;
    const nLat = num(lat), nLon = num(lon);

    db.prepare(`
      UPDATE users SET
        first_name = ?, last_name = ?, username = ?, phone = ?, point_name = ?,
        card_number = ?, card_holder = ?, address = ?, lat = ?, lon = ?,
        photo_url = COALESCE(?, photo_url)
      WHERE id = ?
    `).run(
      first_name !== undefined ? first_name : current.first_name,
      last_name !== undefined ? last_name : current.last_name,
      username !== undefined ? username : current.username,
      phone !== undefined ? phone : current.phone,
      point_name !== undefined ? point_name : current.point_name,
      card_number !== undefined ? card_number : current.card_number,
      card_holder !== undefined ? card_holder : current.card_holder,
      address !== undefined ? address : current.address,
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

const ORDER_SELECT = `
  SELECT o.*,
    p.name as product_name, p.price as product_price, p.photo_url as product_photo,
    cu.first_name as customer_name, cu.last_name as customer_lastname, cu.phone as customer_phone, cu.username as customer_username,
    cr.first_name as courier_name, cr.last_name as courier_lastname, cr.phone as courier_phone
  FROM orders o
  LEFT JOIN products p ON o.product_id = p.id
  LEFT JOIN users cu ON o.customer_id = cu.id
  LEFT JOIN users cr ON o.courier_id = cr.id
`;

function withItems(rows) {
  return rows.map(o => {
    let items = [];
    try { if (o.items_json) items = JSON.parse(o.items_json); } catch (e) {}
    // PIN-kod faqat mijozga ko'rinadi
    const { delivery_pin_code, ...rest } = o;
    return { ...rest, items };
  });
}

// GET seller orders (faqat o'zining; admin kuzatuvchisi ko'ra oladi)
router.get('/orders/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Not found' });

    let orders = db.prepare(`${ORDER_SELECT} WHERE o.seller_id = ? ORDER BY o.created_at DESC`).all(user.id);
    if (orders.length === 0 && req.tg.isAdmin) {
      orders = db.prepare(`${ORDER_SELECT} ORDER BY o.created_at DESC LIMIT 100`).all();
    }
    res.json(withItems(orders));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Buyurtma shu sotuvchiniki ekanini tekshiradi
function ownOrder(req, res) {
  const user = me(req);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(req.params.orderId));
  if (!order) { res.status(404).json({ error: 'Buyurtma topilmadi' }); return null; }
  if (!user || order.seller_id !== user.id) { res.status(403).json({ error: 'Bu buyurtma sizniki emas!' }); return null; }
  return { user, order };
}

// POST confirm customer receipt ("Qabul qilish") — logika orderService da (bot tugmasi bilan bir xil)
router.post('/orders/:orderId/confirm-payment', async (req, res) => {
  try {
    const result = confirmOrderPayment(req.params.orderId, { actorTelegramId: req.tg.id, isAdmin: false });
    if (result.customer?.telegram_id) {
      await sendNotification(result.customer.telegram_id, customerConfirmedText(result.order.id, result.pinCode, result.order.payment_method === 'cash', result.order));
    }
    notifyNearbyCouriers(result.order);
    res.json({ success: true, pin_code: result.pinCode });
  } catch (e) {
    res.status(e instanceof OrderError ? e.status : 500).json({ error: e.message });
  }
});

// POST rad etish (chek noto'g'ri)
router.post('/orders/:orderId/reject', async (req, res) => {
  try {
    const { order, customer } = rejectOrderPayment(req.params.orderId, { actorTelegramId: req.tg.id, isAdmin: false });
    if (customer?.telegram_id) {
      await sendNotification(customer.telegram_id, customerRejectedText(order.id));
    }
    res.json({ success: true });
  } catch (e) {
    res.status(e instanceof OrderError ? e.status : 500).json({ error: e.message });
  }
});

// POST mark ready (faqat o'z buyurtmasi, to'lov tasdiqlangan bo'lsa)
router.post('/orders/:orderId/ready', (req, res) => {
  try {
    const ctx = ownOrder(req, res);
    if (!ctx) return;
    if (ctx.order.status !== 'ready') {
      return res.status(400).json({ error: 'Avval to\'lovni tasdiqlang.' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Helper to deduct Admin % + Courier km fee from seller frozen balance and credit Seller net earnings
function processOrderFinancialSplit(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order || order.shares_deducted) return order;

  const rates = db.getCommissionRates ? db.getCommissionRates() : { adminPct: 5, sellerPct: 95, courierPricePerKm: 3000, totalCommissionPct: 5 };
  const totalPrice = Number(order.total_price) || 0;
  const calc = calculateCourierFee(order.seller_lat, order.seller_lon, order.customer_lat, order.customer_lon, rates.courierPricePerKm);
  const deliveryFee = order.delivery_fee != null && Number(order.delivery_fee) > 0
    ? Number(order.delivery_fee)
    : (order.courier_fee != null && Number(order.courier_fee) > 0 ? Number(order.courier_fee) : calc.courierFee);
  const productsPrice = order.products_price != null && Number(order.products_price) > 0
    ? Number(order.products_price)
    : Math.max(0, totalPrice - deliveryFee);

  const adminShare = order.admin_fee != null && Number(order.admin_fee) > 0
    ? Number(order.admin_fee)
    : Math.round(productsPrice * (rates.adminPct / 100));

  const courierShare = order.courier_fee != null && Number(order.courier_fee) > 0
    ? Number(order.courier_fee)
    : deliveryFee;

  const totalCommission = adminShare + courierShare;
  const sellerNetShare = order.seller_net != null && Number(order.seller_net) > 0
    ? Number(order.seller_net)
    : Math.max(0, productsPrice - adminShare);

  // Seller: frozen_balance dan komissiya yechiladi, total_earned ga sotuvchi ulushi qo'shiladi
  db.prepare(`
    UPDATE users
    SET frozen_balance = MAX(0, COALESCE(frozen_balance, 0) - ?),
        total_earned = COALESCE(total_earned, 0) + ?,
        total_orders = COALESCE(total_orders, 0) + 1
    WHERE id = ?
  `).run(totalCommission, sellerNetShare, order.seller_id);

  if (order.courier_id) {
    db.prepare(`
      UPDATE users
      SET unpaid_amount = COALESCE(unpaid_amount, 0) + ?,
          total_earned = COALESCE(total_earned, 0) + ?,
          total_orders = COALESCE(total_orders, 0) + 1
      WHERE id = ?
    `).run(courierShare, courierShare, order.courier_id);
  }

  db.prepare("UPDATE users SET admin_share = COALESCE(admin_share, 0) + ? WHERE role = 'admin'").run(adminShare);
  db.prepare('UPDATE orders SET shares_deducted = 1, admin_fee = ?, courier_fee = ?, seller_net = ? WHERE id = ?')
    .run(adminShare, courierShare, sellerNetShare, orderId);

  try {
    db.prepare("INSERT INTO transactions (user_id, order_id, type, amount, status) VALUES (?, ?, 'ORDER_COMMISSION_DEDUCTION', ?, 'confirmed')")
      .run(order.seller_id, orderId, totalCommission);
  } catch (e) {}

  return db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
}

// POST handover to courier (Kuryerga topshirdim) — faqat kuryer biriktirilgandan keyin
router.post('/orders/:orderId/handover', async (req, res) => {
  try {
    const ctx = ownOrder(req, res);
    if (!ctx) return;
    const { order } = ctx;
    if (order.status !== 'accepted' || !order.courier_id) {
      return res.status(400).json({ error: 'Topshirish uchun avval kuryer buyurtmani qabul qilishi kerak.' });
    }

    db.prepare("UPDATE orders SET status = 'delivering' WHERE id = ?").run(order.id);

    const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.customer_id);
    const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
    if (customer?.telegram_id) {
      await sendNotification(
        customer.telegram_id,
        `🚴 <b>Buyurtmangiz #${order.id} kuryerga topshirildi va yo'lga chiqdi!</b>\n` +
        `📍 Xaritada kuryer harakatini va kelish yo'nalishini jonli kuzatishingiz mumkin.`
      );
    }
    const courier = db.prepare('SELECT * FROM users WHERE id = ?').get(order.courier_id);
    if (courier?.telegram_id) {
      await sendNotification(
        courier.telegram_id,
        `📦 <b>Sotuvchi (${seller?.point_name || seller?.first_name || 'Punkt'}) buyurtma #${order.id} ni sizga topshirdi!</b>\n` +
        `🗺️ Kuryer panelida mijoz manziliga yo'nalish xaritada ochildi.`
      );
    }

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET categories with products
router.get('/categories/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Not found' });

    const cats = db.prepare('SELECT * FROM categories WHERE seller_id = ?').all(user.id);
    res.json(cats.map(c => ({
      ...c,
      products: db.prepare('SELECT * FROM products WHERE category_id = ?').all(c.id)
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create category
router.post('/categories', (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Kategoriya nomini kiriting' });

    const dup = db.prepare('SELECT id FROM categories WHERE seller_id = ? AND LOWER(name) = LOWER(?)').get(user.id, name);
    if (dup) return res.status(400).json({ error: 'Bunday kategoriya allaqachon mavjud' });

    // Sotuvchi do'koni va rolini faollashtirish
    db.prepare("UPDATE users SET is_open = 1 WHERE id = ?").run(user.id);
    if (user.role !== 'admin') {
      db.prepare("UPDATE users SET role = 'seller' WHERE id = ?").run(user.id);
    }
    if (!user.point_name) {
      db.prepare("UPDATE users SET point_name = ? WHERE id = ?").run((user.first_name || 'Mening') + ' Do\'koni', user.id);
    }

    const r = db.prepare('INSERT INTO categories (seller_id, name) VALUES (?, ?)').run(user.id, name);
    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update category name
router.put('/categories/:id', (req, res) => {
  try {
    const user = me(req);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
    if (!cat) return res.status(404).json({ error: 'Topilmadi' });
    if (!user || cat.seller_id !== user.id) return res.status(403).json({ error: 'Bu kategoriya sizniki emas!' });
    const name = String(req.body?.name || '').trim().slice(0, 60);
    if (!name) return res.status(400).json({ error: 'Kategoriya nomini kiriting' });

    db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, cat.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE category (faqat o'zining yoki admin)
router.delete('/categories/:id', (req, res) => {
  try {
    const user = me(req);
    const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(req.params.id));
    if (!cat) return res.status(404).json({ error: 'Topilmadi' });
    if (!user || (cat.seller_id !== user.id && !req.tg?.isAdmin)) return res.status(403).json({ error: 'Bu kategoriya sizniki emas!' });
    db.prepare('DELETE FROM products WHERE category_id = ?').run(cat.id);
    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST create product (nomi, narxi, og'irligi, rasmi, kategoriya)
router.post('/products', upload.single('photo'), (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });
    const { category_id, category_name, name, price, weight, stock } = req.body;

    let targetCatId = Number(category_id);
    if (!targetCatId && category_name) {
      const catName = String(category_name).trim();
      let existingCat = db.prepare('SELECT id FROM categories WHERE seller_id = ? AND name = ?').get(user.id, catName);
      if (!existingCat) {
        const cr = db.prepare('INSERT INTO categories (seller_id, name) VALUES (?, ?)').run(user.id, catName);
        targetCatId = Number(cr.lastInsertRowid);
      } else {
        targetCatId = existingCat.id;
      }
    }

    if (!targetCatId) {
      let defaultCat = db.prepare('SELECT id FROM categories WHERE seller_id = ? LIMIT 1').get(user.id);
      if (!defaultCat) {
        const cr = db.prepare('INSERT INTO categories (seller_id, name) VALUES (?, ?)').run(user.id, '🍽️ Asosiy Menyu');
        targetCatId = Number(cr.lastInsertRowid);
      } else {
        targetCatId = defaultCat.id;
      }
    }

    const cleanName = String(name || '').trim().slice(0, 100);
    const cleanPrice = Number(price);
    const cleanStock = stock !== undefined && stock !== '' ? Math.max(0, parseInt(stock) || 0) : 10;
    if (!cleanName) return res.status(400).json({ error: 'Mahsulot nomini kiriting' });
    if (!Number.isFinite(cleanPrice) || cleanPrice <= 0) return res.status(400).json({ error: 'Narx noto\'g\'ri' });
    const photo_url = req.file ? `/uploads/${req.file.filename}` : null;

    db.prepare("UPDATE users SET is_open = 1 WHERE id = ?").run(user.id);
    if (user.role !== 'admin') {
      db.prepare("UPDATE users SET role = 'seller' WHERE id = ?").run(user.id);
    }
    if (!user.point_name) {
      db.prepare("UPDATE users SET point_name = ? WHERE id = ?").run((user.first_name || 'Mening') + ' Do\'koni', user.id);
    }

    const r = db.prepare(`
      INSERT INTO products (category_id, seller_id, name, price, weight, stock, photo_url, is_available)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(targetCatId, user.id, cleanName, cleanPrice, String(weight || 'Standart').trim().slice(0, 40), cleanStock, photo_url, cleanStock > 0 ? 1 : 0);

    res.json({ success: true, id: Number(r.lastInsertRowid) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT update product (tahrirlash)
router.put('/products/:id', upload.single('photo'), (req, res) => {
  try {
    const p = ownProduct(req, res);
    if (!p) return;
    const { name, price, weight, stock, category_id } = req.body;
    const cleanName = name !== undefined ? String(name).trim() : p.name;
    const cleanPrice = price !== undefined ? Number(price) : p.price;
    const cleanWeight = weight !== undefined ? String(weight).trim() : p.weight;
    const cleanStock = stock !== undefined && stock !== '' ? Math.max(0, parseInt(stock) || 0) : (p.stock !== undefined ? p.stock : 10);
    const photo_url = req.file ? `/uploads/${req.file.filename}` : p.photo_url;
    const catId = category_id ? Number(category_id) : p.category_id;

    db.prepare(`
      UPDATE products SET
        name = ?, price = ?, weight = ?, stock = ?, photo_url = ?, category_id = ?,
        is_available = CASE WHEN ? <= 0 THEN 0 ELSE is_available END
      WHERE id = ?
    `).run(cleanName, cleanPrice, cleanWeight, cleanStock, photo_url, catId, cleanStock, p.id);

    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function ownProduct(req, res) {
  const user = me(req);
  const p = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));
  if (!p) { res.status(404).json({ error: 'Topilmadi' }); return null; }
  if (!user || (p.seller_id !== user.id && !req.tg?.isAdmin)) {
    res.status(403).json({ error: 'Bu mahsulot sizniki emas!' });
    return null;
  }
  return p;
}

// POST mahsulotni vaqtincha o'chirib/yoqib qo'yish (mavjud / tugagan)
router.post('/products/:id/toggle', (req, res) => {
  try {
    const p = ownProduct(req, res);
    if (!p) return;
    db.prepare('UPDATE products SET is_available = ? WHERE id = ?').run(p.is_available ? 0 : 1, p.id);
    res.json({ success: true, is_available: p.is_available ? 0 : 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE product (faqat o'zining yoki admin) - BUTUNLAY O'CHIRISH
router.delete('/products/:id', (req, res) => {
  try {
    const p = ownProduct(req, res);
    if (!p) return;

    try {
      db.prepare('DELETE FROM order_items WHERE product_id = ?').run(p.id);
      db.prepare('UPDATE orders SET product_id = NULL WHERE product_id = ?').run(p.id);
    } catch (e) {}

    // Bazadan butunlay o'chirish (Mavjud/Tugadi holatiga aloqasi yo'q)
    db.prepare('DELETE FROM products WHERE id = ?').run(p.id);

    res.json({ success: true, deleted_id: p.id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST toggle store open/close
router.post('/toggle-open', (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const newIsOpen = user.is_open ? 0 : 1;
    db.prepare('UPDATE users SET is_open = ? WHERE id = ?').run(newIsOpen, user.id);
    res.json({ success: true, is_open: newIsOpen });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET seller payments & balance info
router.get('/payments/:telegramId', (req, res) => {
  try {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.params.telegramId));
    if (!user) return res.status(404).json({ error: 'Not found' });

    const adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY CASE WHEN card_number IS NOT NULL AND card_number != '' THEN 0 ELSE 1 END, id ASC LIMIT 1").get();
    const payments = db.prepare(`
      SELECT * FROM payments WHERE from_user_id = ? AND type = 'seller_to_admin'
      ORDER BY created_at DESC
    `).all(user.id);

    const totalDeposited = payments.filter(p => p.status === 'confirmed').reduce((s, p) => s + (p.amount || 0), 0);
    const pendingAmount = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);

    const deductedOrders = db.prepare(`
      SELECT
        COUNT(*) as count,
        COALESCE(SUM(total_price), 0) as total_sales,
        COALESCE(SUM(COALESCE(NULLIF(products_price, 0), total_price)), 0) as products_sales,
        COALESCE(SUM(admin_fee), 0) as admin_total,
        COALESCE(SUM(courier_fee), 0) as courier_total,
        COALESCE(SUM(seller_net), 0) as seller_total
      FROM orders
      WHERE seller_id = ? AND (shares_deducted = 1 OR status = 'delivered')
    `).get(user.id);

    const rates = db.getCommissionRates ? db.getCommissionRates() : { adminPct: 5, sellerPct: 95, courierPricePerKm: 3000, totalCommissionPct: 5 };
    const productsSales = deductedOrders?.products_sales || deductedOrders?.total_sales || 0;
    const deductedAdmin = deductedOrders?.admin_total > 0 ? deductedOrders.admin_total : Math.round(productsSales * (rates.adminPct / 100));
    const deductedCourier = deductedOrders?.courier_total || 0;
    const sellerNet = deductedOrders?.seller_total > 0 ? deductedOrders.seller_total : Math.round(productsSales * (rates.sellerPct / 100));

    const deductionsHistory = db.prepare(`
      SELECT id, total_price, admin_fee, courier_fee, seller_net, created_at
      FROM orders
      WHERE seller_id = ? AND (shares_deducted = 1 OR status = 'delivered')
      ORDER BY created_at DESC LIMIT 30
    `).all(user.id);

    const cashStats = db.prepare(`
      SELECT 
        COUNT(*) as count,
        COALESCE(SUM(total_price), 0) as total_cash_sales,
        COALESCE(SUM(CASE WHEN cash_received_by_seller = 1 THEN total_price ELSE 0 END), 0) as delivered_cash,
        COALESCE(SUM(CASE WHEN (cash_received_by_seller = 0 OR cash_received_by_seller IS NULL) AND status NOT IN ('cancelled', 'rejected') THEN total_price ELSE 0 END), 0) as pending_cash
      FROM orders
      WHERE seller_id = ? AND payment_method = 'cash'
    `).get(user.id);

    const pendingCouriers = db.prepare(`
      SELECT 
        o.courier_id,
        COALESCE(u.first_name, 'Kuryer') as first_name,
        COALESCE(u.last_name, '') as last_name,
        u.phone,
        u.username,
        COUNT(o.id) as order_count,
        COALESCE(SUM(o.total_price), 0) as pending_amount,
        GROUP_CONCAT(o.id) as order_ids
      FROM orders o
      LEFT JOIN users u ON o.courier_id = u.id
      WHERE o.seller_id = ? 
        AND o.payment_method = 'cash' 
        AND (o.cash_received_by_seller = 0 OR o.cash_received_by_seller IS NULL)
        AND o.status NOT IN ('cancelled', 'rejected')
      GROUP BY o.courier_id, u.first_name, u.last_name, u.phone, u.username
    `).all(user.id);

    cashStats.couriers = pendingCouriers;

    const targetDeposit = 300000;
    const assignedDepositAmount = user.required_deposit_amount !== null && user.required_deposit_amount !== undefined
      ? Number(user.required_deposit_amount)
      : 300000;
    const requiredDeposit = (Number(user.seller_balance) || 0) < 200000 
      ? Math.max(0, targetDeposit - (Number(user.seller_balance) || 0))
      : 0;

    res.json({
      payments,
      seller_balance: Number(user.seller_balance) || 0,
      active_balance: Number(user.seller_balance) || 0,
      frozen_balance: Number(user.frozen_balance) || 0,
      total_earned: Number(user.total_earned) || sellerNet,
      total_deposited: totalDeposited,
      pending_amount: pendingAmount,
      deducted_admin_5: deductedAdmin,
      deducted_courier_15: deductedCourier,
      total_deducted_20: deductedAdmin + deductedCourier,
      seller_net_80: sellerNet,
      rates,
      deductions_history: deductionsHistory,
      cash_stats: cashStats,
      target_deposit: targetDeposit,
      required_deposit: requiredDeposit,
      assigned_deposit_amount: assignedDepositAmount,
      recommended_deposit: assignedDepositAmount > 0 ? assignedDepositAmount : (requiredDeposit > 0 ? requiredDeposit : 300000),
      admin_card: adminUser?.card_number || '8600 0000 0000 0000',
      admin_card_holder: adminUser?.card_holder || 'ADMINISTRATOR'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST upload deposit receipt (seller to admin)
router.post('/payments/upload-receipt', upload.single('receipt'), async (req, res) => {
  try {
    const user = me(req);
    if (!user) return res.status(404).json({ error: 'Not found' });
    if (!req.file) return res.status(400).json({ error: 'Chek rasmini yuklang' });

    const adminUser = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
    const receipt_url = `/uploads/${req.file.filename}`;

    // Admin tomonidan belgilangan summa - faqat shu summa qabul qilinadi
    const assignedDepositAmount = user.required_deposit_amount !== null && user.required_deposit_amount !== undefined
      ? Number(user.required_deposit_amount)
      : 300000;

    if (assignedDepositAmount <= 0) {
      return res.status(400).json({ error: "Admin hali siz uchun to'lov summasi belgilamagan!" });
    }

    const depositAmount = assignedDepositAmount;

    const r = db.prepare(`
      INSERT INTO payments (from_user_id, to_user_id, amount, receipt_url, status, type)
      VALUES (?, ?, ?, ?, 'pending', 'seller_to_admin')
    `).run(user.id, adminUser ? adminUser.id : 1, depositAmount, receipt_url);

    const paymentId = Number(r.lastInsertRowid);

    const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await notifyAdmins(
      `💳 <b>Sotuvchidan yangi depozit cheki keldi!</b>\n\n` +
      `🏪 Punkt: <b>${esc(user.point_name || user.first_name || 'Sotuvchi')}</b> (@${esc(user.username || 'yoq')})\n` +
      `💰 Summa: <b>${depositAmount.toLocaleString()} so'm</b>\n\n` +
      `Tasdiqlasangiz, ushbu summa sotuvchi balansiga tushadi:`,
      receipt_url,
      {
        inline_keyboard: [
          [{ text: '✅ Tasdiqlash (+Balansga tushirish)', callback_data: `admin_confirm_deposit_${paymentId}` }],
          [{ text: '❌ Rad etish', callback_data: `admin_reject_deposit_${paymentId}` }]
        ]
      }
    );

    res.json({ success: true, message: 'Chek Adminga yuborildi! Admin tasdiqlagach balansingizga tushadi.' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST confirm cash received by seller from courier (kuryer olib kelgan naqd pulni sotuvchi kassasiga qabul qilish)
router.post('/payments/collect-cash', (req, res) => {
  try {
    const user = me(req) || (req.body.telegramId ? db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(req.body.telegramId)) : null);
    if (!user) return res.status(404).json({ error: 'Sotuvchi topilmadi' });

    const { courier_id, order_id } = req.body;

    let sql = `
      UPDATE orders
      SET cash_received_by_seller = 1,
          cash_received_at = CURRENT_TIMESTAMP
      WHERE seller_id = ?
        AND payment_method = 'cash'
        AND (cash_received_by_seller = 0 OR cash_received_by_seller IS NULL)
        AND status NOT IN ('cancelled', 'rejected')
    `;
    const params = [user.id];

    if (order_id) {
      sql += ` AND id = ?`;
      params.push(Number(order_id));
    } else if (courier_id) {
      sql += ` AND courier_id = ?`;
      params.push(Number(courier_id));
    }

    const upd = db.prepare(sql).run(...params);
    res.json({
      success: true,
      updated_orders_count: upd.changes,
      message: 'Kuryerdan naqd pul muvaffaqiyatli qabul qilindi va kassaga kirim qilindi!'
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Alias for orders/collect-cash
router.post('/orders/collect-cash', (req, res) => {
  return res.redirect(307, '/api/seller/payments/collect-cash');
});

module.exports = router;
module.exports.processOrderFinancialSplit = processOrderFinancialSplit;
