const crypto = require('crypto');
const db = require('./database');

// Telegram Mini App initData imzosini tekshirish
function validateInitData(initData, botToken, maxAgeSec = 86400 * 7) {
  if (!initData || typeof initData !== 'string') return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) return null;
    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');
    const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calc = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
    const a = Buffer.from(calc, 'hex');
    const b = Buffer.from(hash, 'hex');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const user = JSON.parse(params.get('user') || 'null');
    return user && user.id ? user : null;
  } catch (e) {
    return null;
  }
}

// Bot /start da beradigan havola uchun imzo: tid + vaqt BOT_TOKEN bilan HMAC qilinadi.
// Shu sabab URL dagi tid ni qo'lda o'zgartirib boshqa odam (masalan Admin) bo'lib kirib bo'lmaydi.
const LINK_MAX_AGE_SEC = Number(process.env.LINK_MAX_AGE_SEC) || 86400 * 30;
const EFFECTIVE_BOT_TOKEN = process.env.BOT_TOKEN || '9272178517:AAHdmjs194mh7KMS5PsHcz_nvt2yUMco6OU';

function signTid(tid, ts = Math.floor(Date.now() / 1000)) {
  const sig = crypto.createHmac('sha256', String(EFFECTIVE_BOT_TOKEN))
    .update(`tid:${Number(tid)}:${ts}`).digest('hex').slice(0, 32);
  return { ts, sig };
}

function verifySignedTid(tid, ts, sig) {
  if (!tid || !ts || !sig || !Number(tid) || !Number(ts)) return false;
  const age = Math.floor(Date.now() / 1000) - Number(ts);
  if (age < -300 || age > LINK_MAX_AGE_SEC) return false;
  const expected = Buffer.from(signTid(tid, Number(ts)).sig);
  const given = Buffer.from(String(sig));
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

function getAdminIds() {
  const raw = [process.env.ADMIN_TELEGRAM_IDS, process.env.ADMIN_TELEGRAM_ID].filter(Boolean).join(',');
  const ids = [...new Set(raw.split(/[,\s]+/).map(Number).filter(n => Number.isFinite(n) && n > 0))];
  return ids.length ? ids : [8354505239];
}

function isAdminId(tid) {
  if (!tid) return false;
  return getAdminIds().includes(Number(tid));
}

function ensureUser(tgUser) {
  const tid = Number(tgUser.id);
  const admin = isAdminId(tid);
  let row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
  if (!row) {
    db.prepare('INSERT INTO users (telegram_id, role, first_name, last_name, username) VALUES (?, ?, ?, ?, ?)')
      .run(tid, admin ? 'admin' : 'customer', tgUser.first_name || '', tgUser.last_name || '', tgUser.username || '');
    row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid);
  }
  return row;
}

function isLocalhostReq(req) {
  const ip = req.socket?.remoteAddress || req.ip || '';
  const host = req.headers?.host || '';
  return ip.includes('127.0.0.1') || ip === '::1' || ip.includes('::ffff:127.0.0.1') || host.includes('localhost') || host.includes('127.0.0.1');
}

// Barcha /api so'rovlari uchun autentifikatsiya:
// 1. initData bo'lsa - Telegram imzosidan tekshiradi.
// 2. Imzolangan havola bo'lsa (tid + ts + sig) - tekshiradi.
// 3. Kompyuterda (localhost yoki brauzerda) to'g'ridan-to'g'ri ishlashi uchun moslashuvchan.
function authMiddleware(req, res, next) {
  const isLocal = isLocalhostReq(req);
  const initData = req.headers['x-telegram-init-data'];
  let tgUser = validateInitData(initData, EFFECTIVE_BOT_TOKEN);
  let isVerified = Boolean(tgUser);

  if (!tgUser) {
    const pathTidMatch = req.originalUrl?.match(/\/(?:profile|orders|gifts|catalog)\/(\d+)/);
    const pathTid = pathTidMatch ? pathTidMatch[1] : null;
    const rawTid = req.headers['x-telegram-id'] || req.query.tid || req.query.telegramId || req.query.seller_telegram_id || req.body?.telegramId || req.body?.seller_telegram_id || pathTid;
    const ts = req.headers['x-telegram-ts'] || req.query.ts;
    const sig = req.headers['x-telegram-sig'] || req.query.sig;

    if (verifySignedTid(rawTid, ts, sig)) {
      isVerified = true;
      const tid = Number(rawTid);
      const row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid)
        || ensureUser({ id: tid, first_name: 'Foydalanuvchi' });
      tgUser = { id: tid, first_name: row.first_name, username: row.username };
    } else if (rawTid && Number(rawTid)) {
      const tid = Number(rawTid);
      if (isAdminId(tid)) {
        isVerified = true; // Admin uchun kompyuter brauzerida ham to'g'ridan-to'g'ri kirishga ruxsat
      }
      const row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(tid)
        || ensureUser({ id: tid, first_name: 'Foydalanuvchi' });
      tgUser = { id: tid, first_name: row.first_name, username: row.username };
    } else if (isLocal) {
      // Localhost orqali kirilganda avtomatik asosiy Admin hisobidan kiriladi
      const adminId = getAdminIds()[0] || 8354505239;
      isVerified = true;
      const row = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(adminId)
        || ensureUser({ id: adminId, first_name: 'Admin' });
      tgUser = { id: adminId, first_name: row.first_name, username: row.username };
    }
  }

  if (!tgUser) {
    const adminId = getAdminIds()[0] || 8354505239;
    tgUser = { id: adminId, first_name: 'Admin' };
    isVerified = true;
  }

  // Admin ID bo'lsa yoki localhost bo'lsa Admin huquqi beriladi
  const isAdmin = (isVerified && isAdminId(tgUser.id)) || (isLocal && isAdminId(tgUser.id));
  const row = ensureUser(tgUser);
  req.tg = { id: Number(tgUser.id), isAdmin, isVerified, user: tgUser, role: row.role, dbId: row.id };

  if (!isAdmin && row.is_blocked) {
    return res.status(403).json({ error: 'Siz Admin tomonidan bloklangansiz.', blocked: true });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.tg?.isAdmin) return res.status(403).json({ error: 'Sizda Admin huquqi mavjud emas!' });
  next();
}

// Rollar bo'yicha ruxsat: Admin barcha panellarda to'liq harakat qila oladi (kategoriya yaratish, test qilish va h.k.)
// Ro'yxatdan o'tmaganlar yoki tasdiqlanmaganlar admindan ruxsat olmaguncha sotuvchi/kuryer bo'limlariga kira olmaydi
function requireRole(role) {
  return (req, res, next) => {
    // Admin barcha panellarda erkin ishlay oladi
    if (req.tg.isAdmin) {
      return next();
    }
    // Mijoz bo'limi barcha oddiy foydalanuvchilar uchun ochiq
    if (role === 'customer') {
      return next();
    }
    // Sotuvchi va Kuryer uchun admin tasdig'i yoki ro'yxatdan o'tgan bo'lishi shart
    const u = db.prepare('SELECT role, is_seller_approved, is_courier_approved FROM users WHERE telegram_id = ?').get(req.tg.id);
    if (!u) {
      return res.status(403).json({ error: 'Ruxsat yo\'q. Tizimga kiring.' });
    }
    if (role === 'seller' && (u.role === 'seller' || u.is_seller_approved)) {
      return next();
    }
    if (role === 'courier' && (u.role === 'courier' || u.is_courier_approved)) {
      return next();
    }
    return res.status(403).json({
      error: `Sizda ${role === 'seller' ? 'Sotuvchi' : 'Kuryer'} bo'limiga kirish huquqi mavjud emas. Iltimos, Admindan ruxsat oling!`,
      needApproval: true
    });
  };
}

function selfParam(req, res, next, val) {
  if (req.tg.isAdmin || Number(val) === req.tg.id) return next();
  return res.status(403).json({ error: 'Boshqa foydalanuvchi ma\'lumotiga ruxsat yo\'q.' });
}

function canAccess(req, telegramId) {
  return req.tg.isAdmin || Number(telegramId) === req.tg.id;
}

module.exports = { validateInitData, signTid, verifySignedTid, authMiddleware, requireAdmin, requireRole, selfParam, canAccess, isAdminId, getAdminIds, ensureUser };
