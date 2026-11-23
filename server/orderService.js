// Buyurtma to'lovini tasdiqlash / rad etish — bitta joyda.
// Ham Mini App (routes/seller.js), ham bot tugmalari (bot.js) shu funksiyalardan foydalanadi,
// shuning uchun komissiya ushlab qolish, PIN-kod va holat tekshiruvi hamma joyda bir xil ishlaydi.
const db = require('./database');
const { calculateCourierFee } = require('./geo');

class OrderError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function getRates() {
  return db.getCommissionRates ? db.getCommissionRates() : { adminPct: 5, sellerPct: 95, courierPricePerKm: 3000, totalCommissionPct: 5 };
}

/**
 * Sotuvchi mijoz chekini tasdiqlaydi.
 * @param {number} orderId
 * @param {{ actorTelegramId: number, isAdmin?: boolean }} actor - kim bosgani (sotuvchi yoki admin)
 * @returns {{ order, seller, customer, pinCode, requiredCommission }}
 */
function confirmOrderPayment(orderId, actor) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
  if (!order) throw new OrderError('Buyurtma topilmadi', 404);

  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
  if (!seller) throw new OrderError('Sotuvchi topilmadi', 404);
  if (!actor.isAdmin && Number(seller.telegram_id) !== Number(actor.actorTelegramId)) {
    throw new OrderError('Bu buyurtma sizniki emas!', 403);
  }
  if (order.status !== 'paid_waiting' && order.status !== 'pending') {
    throw new OrderError('Bu buyurtma allaqachon ko\'rib chiqilgan.');
  }

  const rates = getRates();
  const totalPrice = Number(order.total_price) || 0;
  const calc = calculateCourierFee(
    order.seller_lat ?? seller.lat,
    order.seller_lon ?? seller.lon,
    order.customer_lat,
    order.customer_lon,
    rates.courierPricePerKm
  );
  const deliveryFee = order.delivery_fee != null && Number(order.delivery_fee) > 0
    ? Number(order.delivery_fee)
    : (order.courier_fee != null && Number(order.courier_fee) > 0 ? Number(order.courier_fee) : calc.courierFee);
  const productsPrice = order.products_price != null && Number(order.products_price) > 0
    ? Number(order.products_price)
    : Math.max(0, totalPrice - deliveryFee);

  const adminFee = order.admin_fee != null && Number(order.admin_fee) > 0
    ? Number(order.admin_fee)
    : Math.round(productsPrice * (rates.adminPct / 100));

  const courierFee = order.courier_fee != null && Number(order.courier_fee) > 0
    ? Number(order.courier_fee)
    : deliveryFee;

  const sellerNet = order.seller_net != null && Number(order.seller_net) > 0
    ? Number(order.seller_net)
    : Math.max(0, productsPrice - adminFee);

  const requiredCommission = adminFee + courierFee;
  if ((Number(seller.seller_balance) || 0) < requiredCommission) {
    throw new OrderError(
      `Balansingiz yetarli emas! Zakazni qabul qilish uchun kamida ${requiredCommission.toLocaleString()} so'm komissiya balans bo'lishi kerak. Avval To'lovlar bo'limidan balansni to'ldiring.`
    );
  }

  const pinCode = String(Math.floor(1000 + Math.random() * 9000));

  db.exec('BEGIN IMMEDIATE');
  try {
    // Holatni atomik o'zgartiramiz: ikki marta bosilsa ham faqat bir marta ishlaydi
    const r = db.prepare(`
      UPDATE orders SET status = 'ready', delivery_pin_code = ?, admin_fee = ?, courier_fee = ?, seller_net = ?
      WHERE id = ? AND status IN ('paid_waiting', 'pending')
    `).run(pinCode, adminFee, courierFee, sellerNet, order.id);
    if (!r.changes) throw new OrderError('Bu buyurtma allaqachon ko\'rib chiqilgan.');

    // Komissiyani active_balance dan yechib frozen_balance (Hold/Escrow)ga o'tkazish
    db.prepare('UPDATE users SET seller_balance = COALESCE(seller_balance, 0) - ?, frozen_balance = COALESCE(frozen_balance, 0) + ? WHERE id = ?')
      .run(requiredCommission, requiredCommission, seller.id);
    db.prepare("UPDATE payments SET status = 'confirmed' WHERE order_id = ? AND type = 'customer_to_seller'").run(order.id);
    db.prepare("INSERT INTO transactions (user_id, order_id, type, amount, status) VALUES (?, ?, 'ORDER_COMMISSION_HOLD', ?, 'held')")
      .run(seller.id, order.id, requiredCommission);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.customer_id);
  return { order: { ...order, status: 'ready' }, seller, customer, pinCode, requiredCommission };
}

/** Sotuvchi chekni rad etadi. */
function rejectOrderPayment(orderId, actor) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
  if (!order) throw new OrderError('Buyurtma topilmadi', 404);
  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
  if (!actor.isAdmin && Number(seller?.telegram_id) !== Number(actor.actorTelegramId)) {
    throw new OrderError('Bu buyurtma sizniki emas!', 403);
  }
  const r = db.prepare("UPDATE orders SET status = 'rejected' WHERE id = ? AND status IN ('paid_waiting', 'pending')").run(order.id);
  if (!r.changes) throw new OrderError('Bu buyurtmani rad etib bo\'lmaydi.');
  db.prepare("UPDATE payments SET status = 'rejected' WHERE order_id = ? AND type = 'customer_to_seller'").run(order.id);

  // Bekor bo'lganda mahsulot qoldig'ini (stock) qaytarish
  try {
    if (order.items_json) {
      const items = JSON.parse(order.items_json);
      for (const it of items) {
        db.prepare('UPDATE products SET stock = stock + ?, is_available = 1 WHERE id = ?').run(it.quantity || 1, it.id);
      }
    }
  } catch (e) {}

  const customer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.customer_id);
  return { order, customer };
}

/**
 * Mijoz o'z buyurtmasini bekor qiladi (tasodifan yoki adashib bosilganda).
 * @param {number} orderId
 * @param {number} actorTelegramId
 */
function cancelOrderByCustomer(orderId, actorTelegramId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(Number(orderId));
  if (!order) throw new OrderError('Buyurtma topilmadi', 404);

  const customer = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(Number(actorTelegramId));
  if (!customer) throw new OrderError('Foydalanuvchi topilmadi', 404);

  if (Number(order.customer_id) !== Number(customer.id)) {
    throw new OrderError('Bu buyurtma sizniki emas!', 403);
  }

  // Faqat hali kuryer yetkazishga chiqmagan yoki yakunlanmagan buyurtmalarni bekor qila oladi
  if (['delivering', 'delivered'].includes(order.status)) {
    throw new OrderError('Buyurtma allaqachon kuryer tomonidan yo\'lga olingan yoki yetkazilgan! Uni bekor qilib bo\'lmaydi.', 400);
  }
  if (['cancelled', 'rejected'].includes(order.status)) {
    throw new OrderError('Ushbu buyurtma allaqachon bekor qilingan.', 400);
  }

  db.exec('BEGIN IMMEDIATE');
  try {
    const r = db.prepare(`
      UPDATE orders SET status = 'cancelled'
      WHERE id = ? AND status NOT IN ('delivering', 'delivered', 'cancelled', 'rejected')
    `).run(order.id);

    if (!r.changes) {
      throw new OrderError('Buyurtmani bekor qilib bo\'lmadi.');
    }

    // To'lovlar yozuvini ham bekor qilish
    db.prepare("UPDATE payments SET status = 'cancelled' WHERE order_id = ? AND type = 'customer_to_seller'").run(order.id);

    // Agar buyurtma 'ready' yoki 'accepted' holatida bo'lib sotuvchining komissiyasi hold/muzlatilgan bo'lsa, balansga qaytaramiz
    if (['ready', 'accepted'].includes(order.status)) {
      const rates = getRates();
      const requiredCommission = ((Number(order.admin_fee) || 0) + (Number(order.courier_fee) || 0)) || (Number(order.total_price || 0) * (rates.totalCommissionPct / 100));
      db.prepare(`
        UPDATE users 
        SET seller_balance = COALESCE(seller_balance, 0) + ?,
            frozen_balance = MAX(0, COALESCE(frozen_balance, 0) - ?)
        WHERE id = ?
      `).run(requiredCommission, requiredCommission, order.seller_id);
    }

    // Mahsulot qoldig'ini (stock) qaytarish
    if (order.items_json) {
      try {
        const items = JSON.parse(order.items_json);
        for (const it of items) {
          db.prepare('UPDATE products SET stock = stock + ?, is_available = 1 WHERE id = ?').run(Number(it.quantity) || 1, it.id);
        }
      } catch (e) {}
    } else if (order.product_id) {
      db.prepare('UPDATE products SET stock = stock + ?, is_available = 1 WHERE id = ?').run(Number(order.quantity) || 1, order.product_id);
    }

    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }

  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
  return { order: { ...order, status: 'cancelled' }, customer, seller };
}

function customerConfirmedText(orderId, pinCode, isCash = false, order = null) {
  const payInfo = isCash ? `💵 To'lov usuli: <b>Naqd pul (yetkazilganda to'lanadi)</b>\n` : `✅ <b>To'lovingiz tasdiqlandi!</b>\n`;
  const courierFee = Number(order?.courier_fee || order?.delivery_fee || 0);
  const distKm = Number(order?.delivery_distance_km || 0);
  const deliveryNote = courierFee > 0
    ? `🚴 Kuryer ulushi${distKm > 0 ? ` (~${distKm} km)` : ''}: <b>${courierFee.toLocaleString()} so'm</b>\n\n`
    : '';

  return `${payInfo}🎉 <b>Buyurtma #${orderId} qabul qilindi!</b>\n` +
    deliveryNote +
    `🧑‍🍳 Taomingiz tayyorlanmoqda va yaqin kuryerlarga xabar yuborildi.\n\n` +
    `🔑 <b>Yetkazib berish PIN-kodi: ${pinCode}</b>\n` +
    `<i>(Kuryer taomni topshirganda ushbu 4 xonali kodni unga ayting)</i>`;
}

function customerRejectedText(orderId) {
  return `⚠️ <b>Buyurtma #${orderId} bo'yicha to'lov cheki rad etildi.</b>\n` +
    `Iltimos, to'g'ri chekni ilovadagi "Buyurtmalar" bo'limidan qayta yuboring.`;
}

/** Depozit summasini tekshiradi: musbat butun son, 1 so'mdan 1 mlrd so'mgacha. */
function parseAmount(v) {
  const n = Math.round(Number(String(v ?? '').replace(/[\s,'_]/g, '')));
  return Number.isFinite(n) && n >= 1 && n <= 1000000000 ? n : null;
}

/**
 * Admin sotuvchi depozitini tasdiqlaydi (atomik: balans faqat bir marta qo'shiladi).
 * @param {number} paymentId
 * @param {number|string} [customAmount] - Admin haqiqatda qabul qilgan summa (bo'lmasa sotuvchi yozgan summa)
 */
function confirmDeposit(paymentId, customAmount) {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ? AND type = 'seller_to_admin'").get(Number(paymentId));
  if (!payment) throw new OrderError('To\'lov topilmadi', 404);
  let amount = Number(payment.amount) || 0;
  if (customAmount !== undefined && customAmount !== null && customAmount !== '') {
    amount = parseAmount(customAmount);
    if (!amount) throw new OrderError('Summa noto\'g\'ri. Musbat son kiriting (masalan: 1500000).');
  }
  if (amount <= 0) throw new OrderError('Summa ko\'rsatilmagan. Iltimos, summani kiriting.');
  db.exec('BEGIN IMMEDIATE');
  try {
    const r = db.prepare("UPDATE payments SET status = 'confirmed', amount = ? WHERE id = ? AND status = 'pending'").run(amount, payment.id);
    if (!r.changes) throw new OrderError(payment.status === 'confirmed' ? 'Allaqachon tasdiqlangan!' : 'Bu to\'lov allaqachon ko\'rib chiqilgan.');
    db.prepare('UPDATE users SET seller_balance = COALESCE(seller_balance, 0) + ? WHERE id = ?')
      .run(amount, payment.from_user_id);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(payment.from_user_id);
  return { payment: { ...payment, amount, requested_amount: payment.amount, status: 'confirmed' }, seller };
}

/** Admin sotuvchi depozit chekini rad etadi. */
function rejectDeposit(paymentId) {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ? AND type = 'seller_to_admin'").get(Number(paymentId));
  if (!payment) throw new OrderError('To\'lov topilmadi', 404);
  const r = db.prepare("UPDATE payments SET status = 'rejected' WHERE id = ? AND status = 'pending'").run(payment.id);
  if (!r.changes) throw new OrderError('Bu to\'lov allaqachon ko\'rib chiqilgan.');
  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(payment.from_user_id);
  return { payment, seller };
}

module.exports = {
  OrderError, confirmOrderPayment, rejectOrderPayment, cancelOrderByCustomer, confirmDeposit, rejectDeposit, parseAmount,
  customerConfirmedText, customerRejectedText
};
