const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const db = require('./database');
const legal = require('./legalDocs');
const { ensureUser, isAdminId, getAdminIds, signTid } = require('./auth');
const { getDistanceKm, MAX_COURIER_RADIUS_KM } = require('./geo');
const {
  OrderError, confirmOrderPayment, rejectOrderPayment, confirmDeposit, rejectDeposit,
  customerConfirmedText, customerRejectedText
} = require('./orderService');
const { getAnswerForText, isMessageForBot } = require('./aiService');

const token = process.env.BOT_TOKEN || '9272178517:AAHdmjs194mh7KMS5PsHcz_nvt2yUMco6OU';
if (!token) {
  console.error('❌ BOT_TOKEN is missing in .env');
  process.exit(1);
}

const POLLING = process.env.DISABLE_BOT_POLLING !== '1';
const bot = new TelegramBot(token, {
  polling: POLLING ? {
    interval: 300,
    autoStart: true,
    params: { timeout: 15, allowed_updates: ['message', 'callback_query'] }
  } : false,
  request: {
    agentOptions: { keepAlive: true, keepAliveMsecs: 10000 },
    timeout: 25000
  }
});
let MINI_APP_URL = process.env.MINI_APP_URL || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
let botUser = null;
bot.getMe().then(u => {
  botUser = u;
  console.log(`🤖 AI Bot info yuklandi: @${u.username} (ID: ${u.id})`);
}).catch(e => console.error('getMe error:', e.message));

console.log(`🤖 Bot initializing with Mini App URL: ${MINI_APP_URL}`);
console.log(`👑 Configured Admin Telegram IDs:`, getAdminIds());

let lastPollingErrorLog = 0;
bot.on('polling_error', (err) => {
  const now = Date.now();
  if (now - lastPollingErrorLog < 10000) return;
  lastPollingErrorLog = now;
  // Vaqtinchalik tarmoq uzilishlari (avtomatik qayta ulanadi)
  if (/ECONNRESET|ETIMEDOUT|ESOCKETTIMEDOUT/.test(err.message)) {
    return;
  }
  const hint = /409/.test(err.message) ? ' — bot boshqa joyda ham ishlayapti! Faqat bitta nusxa qoldiring.' : '';
  console.error('⚠️ Polling error:', err.code, err.message + hint);
  if (/409/.test(err.message) && process.env.AUTO_STOP_ON_409 === '1') {
    console.log('🌐 Render server botni qabul qilib oldi (409), lokal nusxa to\'xtatilmoqda...');
    shutdown('RENDER_TAKEN_OVER');
  }
});

// Buyruqlar menyusi (Telegramda "/" bosilganda chiqadi)
bot.setMyCommands([
  { command: 'start', description: '🚀 Ilovani ochish' },
  { command: 'yuklash', description: '📲 Ilovani yuklab olish (Android / iOS / Windows)' },
  { command: 'oferta', description: '📄 Ommaviy oferta (Shartnoma)' },
  { command: 'maxfiylik', description: '🔒 Maxfiylik siyosati' },
  { command: 'myid', description: '🆔 Telegram ID ni ko\'rish' },
  { command: 'help', description: '❓ Yordam va ma\'lumot' }
]).catch(e => console.error('setMyCommands error:', e.message));

// Mini App havolasi: tid + ts + sig (HMAC). Imzosiz tid server tomonidan qabul qilinmaydi.
function makeUrl(role, tid, extra = '') {
  const sep = MINI_APP_URL.includes('?') ? '&' : '?';
  const roleParam = role ? `role=${role}&` : '';
  const { ts, sig } = signTid(tid);
  return `${MINI_APP_URL}${sep}${roleParam}tid=${tid}&ts=${ts}&sig=${sig}&v=${Date.now().toString(36)}${extra}`;
}

function makeInstallUrl(role, tid) {
  return makeUrl(role, tid, '&install=1');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isHttps(url) {
  return /^https:\/\//i.test(url);
}

// Start handler — Bitta asosiy bot va bitta asosiy Web App tugmasi
bot.onText(/^\/start(?:@\w+)?(?:\s|$)/, async (msg) => {
  if (msg.chat.type !== 'private') return;
  const chatId = msg.chat.id;
  const tid = msg.from.id;
  let user;
  try {
    user = ensureUser(msg.from);
    // Ism/username o'zgargan bo'lsa yangilab qo'yamiz (faqat bo'sh yoki standart qiymatlar ustidan)
    if (!user.username && msg.from.username) {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(msg.from.username, user.id);
    }
    if ((!user.first_name || user.first_name === 'Foydalanuvchi') && msg.from.first_name) {
      db.prepare('UPDATE users SET first_name = ? WHERE id = ?').run(msg.from.first_name, user.id);
    }
  } catch (e) {
    console.error('/start DB error:', e.message);
    return bot.sendMessage(chatId, '⚠️ Serverda vaqtinchalik xatolik. Birozdan so\'ng qayta urinib ko\'ring.').catch(() => {});
  }

  console.log(`▶️ /start bosildi: tid=${tid}, name=${msg.from.first_name}`);

  if (user.is_blocked && !isAdminId(tid)) {
    return bot.sendMessage(chatId, '🚫 Siz Admin tomonidan bloklangansiz.').catch(() => {});
  }

  // Telegram Web App faqat HTTPS havolani qabul qiladi
  if (!isHttps(MINI_APP_URL)) {
    return bot.sendMessage(
      chatId,
      '⏳ Ilova hozir ishga tushmoqda (HTTPS havola tayyorlanmoqda). Iltimos, 10–20 soniyadan so\'ng /start ni qayta bosing.'
    ).catch(() => {});
  }

  const isAdmin = isAdminId(tid);
  const termsAccepted = Boolean(isAdmin || user.terms_accepted);

  // Agar foydalanuvchi hali Ommaviy oferta va Maxfiylik siyosatiga rozilik bildirmagan bo'lsa
  if (!termsAccepted) {
    const welcomeLegalText =
      `Assalomu alaykum, <b>${escapeHtml(msg.from.first_name || 'Foydalanuvchi')}</b>!\n\n` +
      `🍕 <b>Yetkazib Berish Xizmati</b> (@sorry1345ds_bot) rasmiy botiga xush kelibsiz!\n\n` +
      `⚠️ <b>DIQQAT:</b> Xizmatimizdan foydalanish, taomlarga buyurtma berish, kuryer yoki sotuvchi sifatida ishlashdan avval ` +
      `Oʻzbekiston Respublikasi qonunchiligiga muvofiq quyidagi rasmiy hujjatlar bilan tanishib chiqishingiz va rozilik bildirishingiz lozim:\n\n` +
      `📄 <b>1. Ommaviy oferta (Foydalanuvchi shartnomasi)</b>\n` +
      `<i>Xizmat koʻrsatish shartlari, buyurtma berish, toʻlov, 4 xonali PIN-kod orqali qabul qilish va bekor qilish/qaytarish tartibi.</i>\n\n` +
      `🔒 <b>2. Maxfiylik siyosati</b>\n` +
      `<i>Oʻzbekiston Respublikasining 2019-yil 2-iyuldagi OʻRQ-547-son "Shaxsiy maʼlumotlar toʻgʻrisida"gi Qonuniga muvofiq shaxsiy maʼlumotlaringiz (ism, telefon, yetkazib berish manzili va GPS geolokatsiya) qatʼiy himoyalangan holda qayta ishlanadi.</i>\n\n` +
      `<i>Quyidagi tugmalar orqali hujjatlar matni bilan toʻliq tanishishingiz mumkin. Botdan foydalanish uchun <b>"✅ Roziman va Qabul qilaman"</b> tugmasini bosing:</i>`;

    return bot.sendMessage(chatId, welcomeLegalText, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '📄 Ommaviy oferta', callback_data: 'view_oferta' },
            { text: '🔒 Maxfiylik siyosati', callback_data: 'view_privacy' }
          ],
          [
            { text: '✅ Roziman va Qabul qilaman', callback_data: 'accept_terms_and_start' }
          ]
        ]
      }
    });
  }

  const userRole = isAdmin ? 'admin' : (user.role || 'customer');
  const appUrl = makeUrl(userRole, tid);
  const installUrl = makeInstallUrl(userRole, tid);

  const text =
    `Assalomu alaykum, <b>${escapeHtml(msg.from.first_name || 'Foydalanuvchi')}</b>!\n\n` +
    `🍕 <b>Yetkazib Berish Ekotizimi</b>ga xush kelibsiz!\n\n` +
    `🆔 Sizning Telegram ID: <code>${tid}</code>\n` +
    (isAdmin ? `👑 <b>Status: ADMINISTRATOR</b>\n\n` : '') +
    `Ilovani ochish yoki <b>Android / iOS / Windows</b> qurilmangizga alohida ilova sifatida yuklab olish uchun quyidagi tugmalardan foydalaning:\n\n` +
    `💻 <b>Kompyuter uchun to'g'ridan-to'g'ri havola:</b>\n` +
    `👉 <a href="${appUrl}"><b>Bu yerni bosing (Ilovani ochish)</b></a>`;

  await bot.sendMessage(chatId, text, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Ilovani ochish (Telegram WebApp)', web_app: { url: appUrl } }],
        [{ text: '📲 Ilovani yuklab olish (Android / iOS / Windows)', url: installUrl }],
        [{ text: '💻 Kompyuter brauzerida ochish 🌐', url: appUrl }],
        [
          { text: '📄 Ommaviy oferta', callback_data: 'view_oferta' },
          { text: '🔒 Maxfiylik siyosati', callback_data: 'view_privacy' }
        ]
      ]
    }
  }).catch(e => console.error('Send inline error:', e.message));

  await bot.sendMessage(chatId, '📱 Tezkor kirish uchun pastki menyu tugmasi ham biriktirildi 👇', {
    reply_markup: { keyboard: [[{ text: '🚀 Ilovani ochish', web_app: { url: appUrl } }]], resize_keyboard: true }
  }).catch(e => console.error('Send reply keyboard error:', e.message));
});

// Ilovani yuklab olish (Android / iOS / Windows PWA) buyrug'i
bot.onText(/^\/(yuklash|app|install)(?:@\w+)?$/, async (msg) => {
  if (msg.chat.type !== 'private') return;
  const tid = msg.from.id;
  if (!isHttps(MINI_APP_URL)) {
    return bot.sendMessage(msg.chat.id, '⏳ Havola tayyorlanmoqda, birozdan so\'ng qayta urinib ko\'ring.').catch(() => {});
  }
  const user = ensureUser(msg.from);
  const role = isAdminId(tid) ? 'admin' : (user.role || 'customer');
  const installUrl = makeInstallUrl(role, tid);
  const appUrl = makeUrl(role, tid);

  await bot.sendMessage(
    msg.chat.id,
    `📲 <b>Delivery Platform — Ilovani yuklab olish</b>\n\n` +
    `Ilovani qurilmangizga alohida dastur sifatida o'rnatishingiz mumkin:\n` +
    `• 🤖 <b>Android</b> (Chrome → Ilovani o'rnatish)\n` +
    `• 🍎 <b>iOS / iPhone</b> (Safari → Ulashish → Asosiy ekranga qo'shish)\n` +
    `• 🪟 <b>Windows</b> (Chrome / Edge → Desktop ilova sifatida o'rnatish)\n\n` +
    `👇 Quyidagi tugmani bosib brauzerda oching va <b>"O'rnatish"</b> tugmasini bosing:`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📲 Ilovani yuklab olish (Android / iOS / Windows)', url: installUrl }],
          [{ text: '🚀 Telegram ichida ochish', web_app: { url: appUrl } }]
        ]
      }
    }
  ).catch(() => {});
});

// Ommaviy ofertani to'liq ko'rish buyrug'i
bot.onText(/^\/oferta(?:@\w+)?$/, async (msg) => {
  if (msg.chat.type !== 'private') return;
  const tid = msg.from.id;
  const appUrl = makeUrl('customer', tid);
  await bot.sendMessage(msg.chat.id, legal.OFERTA_TEXT, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔒 Maxfiylik siyosatini o\'qish', callback_data: 'view_privacy' }],
        [{ text: '🚀 Ilovani ochish', web_app: { url: appUrl } }]
      ]
    }
  }).catch(() => {});
});

// Maxfiylik siyosatini to'liq ko'rish buyrug'i
bot.onText(/^\/(maxfiylik|privacy)(?:@\w+)?$/, async (msg) => {
  if (msg.chat.type !== 'private') return;
  const tid = msg.from.id;
  const appUrl = makeUrl('customer', tid);
  await bot.sendMessage(msg.chat.id, legal.PRIVACY_TEXT, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '📄 Ommaviy ofertani o\'qish', callback_data: 'view_oferta' }],
        [{ text: '🚀 Ilovani ochish', web_app: { url: appUrl } }]
      ]
    }
  }).catch(() => {});
});

bot.onText(/^\/myid(?:@\w+)?$/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Sizning Telegram ID: <code>${msg.from.id}</code>`, { parse_mode: 'HTML' }).catch(() => {});
});

bot.onText(/^\/help(?:@\w+)?$/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    `<b>Botdan foydalanish:</b>\n` +
    `/start — Ilovani ochish (barcha panellar)\n` +
    `/myid — Telegram ID ni ko'rish\n\n` +
    `Savol yoki muammo bo'lsa, ilova ichidagi "Profil" bo'limidan Adminga yozing.`,
    { parse_mode: 'HTML' }
  ).catch(() => {});
});

// Guruh va shaxsiy xabarlarga javob beruvchi 24/7 Sun'iy Intellekt (AI) Yordamchi
bot.on('message', async (msg) => {
  if (msg.web_app_data) return;

  const isGroup = msg.chat.type === 'group' || msg.chat.type === 'supergroup';
  let text = (msg.text || msg.caption || '').trim();
  if (!text && msg.photo && msg.photo.length > 0) {
    text = 'depozit balansi qismi nimaga kk tushuntirib ber';
  }

  // 1. Yangi a'zolar guruhga qo'shilganda kutib olish
  if (msg.new_chat_members && msg.new_chat_members.length > 0) {
    const isBotAdded = msg.new_chat_members.some(m => m.id === botUser?.id || m.username === botUser?.username);
    if (isBotAdded) {
      await bot.sendMessage(
        msg.chat.id,
        `👋 <b>Assalomu alaykum barchaga!</b>\n\n` +
        `Men <b>Yetkazib Berish Ekotizimi</b> (@sorry1345ds_bot) rasmiy AI yordamchisiman.\n` +
        `Ushbu guruhda foydalanuvchilarning botimiz bo'yicha barcha savollariga (buyurtma berish, kuryer bo'lish, do'kon ochish, to'lovlar va boshqalar) 24/7 rejimda javob berib turaman! 😊\n\n` +
        `👉 <b>Ilovani ishga tushirish:</b> @sorry1345ds_bot`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🚀 Botni ochish (@sorry1345ds_bot)', url: 'https://t.me/sorry1345ds_bot' }]
            ]
          }
        }
      ).catch(() => {});
      return;
    }

    // Guruhga yangi obunachilar qo'shilganda ularni kutib olish
    for (const m of msg.new_chat_members) {
      if (m.is_bot) continue;
      const firstName = escapeHtml(m.first_name || 'yangi obunachi');
      await bot.sendMessage(
        msg.chat.id,
        `Assalomu alaykum, <b>${firstName}</b>! Guruhimizga xush kelibsiz! 👋\n\n` +
        `Bu yerda bizning <b>Yetkazib berish xizmatimiz (@sorry1345ds_bot)</b> bo'yicha istalgan savolingizni berishingiz mumkin. Men doimiy AI konsultantman — savolingiz bo'lsa bemalol yozing! 🍕🚴`,
        {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📱 Ilovaga kirish', url: 'https://t.me/sorry1345ds_bot' }]
            ]
          }
        }
      ).catch(() => {});
    }
    return;
  }

  // 2. Guruhdagi va shaxsiy chatdagi matnli savollarga AI orqali javob berish
  if (!text) return;

  // Guruhda bo'lsa — faqat botga tegishli savollar bo'lsa javob beradi
  if (isGroup) {
    console.log(`[Group Msg] Chat: "${msg.chat.title || msg.chat.id}", User: ${msg.from?.first_name}: ${text}`);
    if (!isMessageForBot(msg, botUser)) {
      console.log(`[Group Msg] Botga tegishli emas, o'tkazib yuborildi`);
      return;
    }
  } else {
    // Shaxsiy chatda /start, /myid, /help, /yuklash buyruqlari tegishli onText handlerida bajariladi
    if (/^\/(start|myid|help|yuklash|app|install|oferta|maxfiylik|privacy)(@\w+)?(\s|$)/.test(text)) return;
  }

  const userName = msg.from?.first_name || 'Foydalanuvchi';
  const cleanQuestion = text.replace(/@sorry1345ds_bot/gi, '').replace(/^\/(ai|savol)\s*/i, '').trim();

  // Limitsiz AI bilimlar bazasidan to'liq javob olish
  const answer = getAnswerForText(cleanQuestion || text, userName);
  if (!answer) return;

  const replyOptions = {
    parse_mode: 'HTML',
    reply_to_message_id: isGroup ? msg.message_id : undefined,
    reply_markup: {
      inline_keyboard: [
        [{ text: '🚀 Botni ochish (@sorry1345ds_bot)', url: 'https://t.me/sorry1345ds_bot' }]
      ]
    }
  };

  await bot.sendMessage(msg.chat.id, answer, replyOptions).catch(e => {
    console.error('Group AI send message error:', e.message);
  });
});

// Tugma bosilgandan so'ng xabarga holatni yozib, tugmalarni olib tashlaydi
async function markHandled(query, suffixHtml) {
  const m = query.message;
  if (!m) return;
  const opts = { chat_id: m.chat.id, message_id: m.message_id, parse_mode: 'HTML' };
  if (m.caption !== undefined) {
    await bot.editMessageCaption(escapeHtml(m.caption).slice(0, 900) + `\n\n${suffixHtml}`, opts).catch(() => {});
  } else if (m.text !== undefined) {
    await bot.editMessageText(escapeHtml(m.text) + `\n\n${suffixHtml}`, opts).catch(() => {});
  }
}

const parseId = (data, prefix) => Number(data.slice(prefix.length)) || 0;

// Callback queries
bot.on('callback_query', async (query) => {
  const data = query.data || '';
  const tid = query.from.id;
  const admin = isAdminId(tid);

  try {
    // 0. Ommaviy oferta va Maxfiylik siyosati bo'yicha amallar
    if (data === 'view_oferta') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(query.message.chat.id, legal.OFERTA_TEXT, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔒 Maxfiylik siyosati', callback_data: 'view_privacy' }],
            [{ text: '✅ Roziman va Qabul qilaman', callback_data: 'accept_terms_and_start' }]
          ]
        }
      });
      return;
    }

    if (data === 'view_privacy') {
      await bot.answerCallbackQuery(query.id);
      await bot.sendMessage(query.message.chat.id, legal.PRIVACY_TEXT, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📄 Ommaviy oferta', callback_data: 'view_oferta' }],
            [{ text: '✅ Roziman va Qabul qilaman', callback_data: 'accept_terms_and_start' }]
          ]
        }
      });
      return;
    }

    if (data === 'accept_terms_and_start') {
      db.prepare('UPDATE users SET terms_accepted = 1, terms_accepted_at = CURRENT_TIMESTAMP WHERE telegram_id = ?').run(tid);
      await bot.answerCallbackQuery(query.id, { text: '✅ Shartlar muvaffaqiyatli qabul qilindi!' });

      const user = ensureUser(query.from);
      const userRole = admin ? 'admin' : (user.role || 'customer');
      const appUrl = makeUrl(userRole, tid);
      const installUrl = makeInstallUrl(userRole, tid);

      const welcomeDoneText =
        `🎉 <b>Tabriklaymiz, rasmiy shartlar muvaffaqiyatli qabul qilindi!</b>\n\n` +
        `Siz <b>Ommaviy oferta</b> shartlarini qabul qildingiz va shaxsiy maʼlumotlaringizni "Shaxsiy maʼlumotlar toʻgʻrisida"gi Qonun asosida qayta ishlanishiga rozilik bildirdingiz.\n\n` +
        `Endi bot va Mini App'dan toʻliq foydalanishingiz yoki ilovani <b>Android / iOS / Windows</b> ga o'rnatishingiz mumkin:\n\n` +
        `💻 <b>Kompyuter uchun havola:</b>\n` +
        `👉 <a href="${appUrl}"><b>Bu yerni bosing (Ilovani ochish)</b></a>`;

      await bot.sendMessage(query.message.chat.id, welcomeDoneText, {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🚀 Ilovani ochish (Telegram WebApp)', web_app: { url: appUrl } }],
            [{ text: '📲 Ilovani yuklab olish (Android / iOS / Windows)', url: installUrl }],
            [{ text: '💻 Kompyuter brauzerida ochish 🌐', url: appUrl }],
            [
              { text: '📄 Ommaviy oferta', callback_data: 'view_oferta' },
              { text: '🔒 Maxfiylik siyosati', callback_data: 'view_privacy' }
            ]
          ]
        }
      });

      await bot.sendMessage(query.message.chat.id, '📱 Tezkor kirish uchun pastki menyu tugmasi ham biriktirildi 👇', {
        reply_markup: { keyboard: [[{ text: '🚀 Ilovani ochish', web_app: { url: appUrl } }]], resize_keyboard: true }
      }).catch(() => {});
      return;
    }

    // 1. Sotuvchi mijoz to'lov chekini tasdiqlaydi (faqat shu buyurtma sotuvchisi yoki Admin)
    if (data.startsWith('seller_confirm_order_')) {
      const result = confirmOrderPayment(parseId(data, 'seller_confirm_order_'), { actorTelegramId: tid, isAdmin: admin });
      await bot.answerCallbackQuery(query.id, { text: '✅ Buyurtma va to\'lov tasdiqlandi!' });
      await markHandled(query, '✅ <b>TASDIQLANDI (Tayyorlanmoqda / Kuryer qidirilmoqda)</b>');
      if (result.customer?.telegram_id) {
        sendNotification(result.customer.telegram_id, customerConfirmedText(result.order.id, result.pinCode, result.order.payment_method === 'cash', result.order));
      }
      notifyNearbyCouriers(result.order);
      return;
    }

    // 2. Sotuvchi chekni rad etadi
    if (data.startsWith('seller_reject_order_')) {
      const { order, customer } = rejectOrderPayment(parseId(data, 'seller_reject_order_'), { actorTelegramId: tid, isAdmin: admin });
      await bot.answerCallbackQuery(query.id, { text: '❌ Buyurtma rad etildi' });
      await markHandled(query, '❌ <b>RAD ETILDI</b>');
      if (customer?.telegram_id) sendNotification(customer.telegram_id, customerRejectedText(order.id));
      return;
    }

    // 3-4. Admin sotuvchi depozit chekini tasdiqlaydi / rad etadi (faqat Admin)
    if (data.startsWith('admin_confirm_deposit_') || data.startsWith('admin_reject_deposit_')) {
      if (!admin) {
        return bot.answerCallbackQuery(query.id, { text: '⛔ Bu amal faqat Admin uchun!', show_alert: true });
      }
      if (data.startsWith('admin_confirm_deposit_')) {
        const { payment, seller } = confirmDeposit(parseId(data, 'admin_confirm_deposit_'));
        await bot.answerCallbackQuery(query.id, { text: '✅ Depozit tasdiqlandi va sotuvchi balansiga qo\'shildi!' });
        await markHandled(query, '✅ <b>TASDIQLANDI (+Balansga tushdi)</b>');
        if (seller?.telegram_id) {
          sendNotification(
            seller.telegram_id,
            `✅ <b>Admin sizning ${Number(payment.amount).toLocaleString()} so'm depozit chekingizni tasdiqladi!</b>\n` +
            `💰 Yangi balansingiz: <b>${Number(seller.seller_balance).toLocaleString()} so'm</b>`
          );
        }
      } else {
        const { payment, seller } = rejectDeposit(parseId(data, 'admin_reject_deposit_'));
        await bot.answerCallbackQuery(query.id, { text: '❌ Depozit rad etildi' });
        await markHandled(query, '❌ <b>RAD ETILDI</b>');
        if (seller?.telegram_id) {
          sendNotification(
            seller.telegram_id,
            `⚠️ <b>Admin ${Number(payment.amount).toLocaleString()} so'm depozit chekingizni rad etdi.</b>\n` +
            `Iltimos, to'g'ri chekni "To'lovlar" bo'limidan qayta yuboring yoki Admin bilan bog'laning.`
          );
        }
      }
      return;
    }

    // 5. Admin ro'yxatdan o'tish arizasini Telegramdan 1-bosishda tasdiqlaydi
    if (data.startsWith('admin_approve_req_')) {
      if (!admin) {
        return bot.answerCallbackQuery(query.id, { text: '⛔ Faqat Admin tasdiqlashi mumkin!', show_alert: true });
      }
      const reqId = parseId(data, 'admin_approve_req_');
      const item = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(reqId);
      if (!item) {
        return bot.answerCallbackQuery(query.id, { text: 'So\'rov topilmadi', show_alert: true });
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      db.prepare("UPDATE access_requests SET status = 'approved', access_code = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(code, reqId);
      if (item.requested_role === 'seller') {
        db.prepare("UPDATE users SET is_seller_approved = 1, seller_access_code = ?, role = CASE WHEN role = 'customer' THEN 'seller' ELSE role END WHERE telegram_id = ?").run(code, item.telegram_id);
      } else {
        db.prepare("UPDATE users SET is_courier_approved = 1, courier_access_code = ?, role = CASE WHEN role = 'customer' THEN 'courier' ELSE role END WHERE telegram_id = ?").run(code, item.telegram_id);
      }
      await bot.answerCallbackQuery(query.id, { text: `✅ Tasdiqlandi! Kod: ${code}` });
      await markHandled(query, `✅ <b>ADMIN TOMONIDAN TASDIQLANDI!</b>\n🔑 Kirish kodi: <code>${code}</code>`);
      const roleBadge = item.requested_role === 'seller' ? '🏪 SOTUVCHI' : '🚴 KURYER';
      const notifyText =
        `🎉 <b>TABRIKLAYMIZ!</b>\n\n` +
        `Sizning <b>${roleBadge}</b> bo'lish arizangiz Administrator tomonidan tasdiqlandi!\n\n` +
        `🔑 <b>Sizning shaxsiy kirish kodingiz:</b> <code>${code}</code>\n\n` +
        `Ilovani oching va o'z kabinetingizdan to'liq foydalanishingiz mumkin. Omad!`;
      sendNotification(item.telegram_id, notifyText).catch(() => {});
      return;
    }

    // 6. Admin ro'yxatdan o'tish arizasini rad etadi
    if (data.startsWith('admin_reject_req_')) {
      if (!admin) {
        return bot.answerCallbackQuery(query.id, { text: '⛔ Faqat Admin rad etishi mumkin!', show_alert: true });
      }
      const reqId = parseId(data, 'admin_reject_req_');
      const item = db.prepare('SELECT * FROM access_requests WHERE id = ?').get(reqId);
      if (!item) {
        return bot.answerCallbackQuery(query.id, { text: 'So\'rov topilmadi', show_alert: true });
      }
      db.prepare("UPDATE access_requests SET status = 'rejected', reviewed_at = CURRENT_TIMESTAMP WHERE id = ?").run(reqId);
      await bot.answerCallbackQuery(query.id, { text: '❌ Ariza rad etildi' });
      await markHandled(query, '❌ <b>ADMIN TOMONIDAN RAD ETILDI</b>');
      const roleBadge = item.requested_role === 'seller' ? '🏪 SOTUVCHI' : '🚴 KURYER';
      const rejectText =
        `ℹ️ <b>Hurmatli foydalanuvchi!</b>\n\n` +
        `Sizning <b>${roleBadge}</b> bo'lish arizangiz Administrator tomonidan rad etildi.\n` +
        `Siz tizimdan buyurtma beruvchi mijoz sifatida to'liq foydalanishingiz mumkin.`;
      sendNotification(item.telegram_id, rejectText).catch(() => {});
      return;
    }

    await bot.answerCallbackQuery(query.id).catch(() => {});
  } catch (err) {
    const msg = err instanceof OrderError ? err.message : 'Xatolik yuz berdi';
    if (!(err instanceof OrderError)) console.error('Callback error:', err);
    bot.answerCallbackQuery(query.id, { text: msg.slice(0, 190), show_alert: true }).catch(() => {});
  }
});

function notifyNearbyCouriers(order) {
  try {
    let pickLat = order?.seller_lat;
    let pickLon = order?.seller_lon;
    if (pickLat == null || pickLon == null) {
      const seller = db.prepare('SELECT lat, lon FROM users WHERE id = ?').get(order?.seller_id);
      if (seller) {
        pickLat = seller.lat;
        pickLon = seller.lon;
      }
    }

    if (pickLat == null || pickLon == null) {
      console.warn(`[notifyNearbyCouriers] Buyurtma #${order?.id} uchun savdo punkti koordinatasi yo'q, xabar yuborilmadi.`);
      return;
    }

    // Faqat bloklanmagan va onlayn bo'lgan kuryerlar
    const couriers = db.prepare("SELECT telegram_id, lat, lon FROM users WHERE role = 'courier' AND is_blocked = 0 AND (is_online IS NULL OR is_online = 1)").all();

    // Faqat 20 km radius ichidagi kuryerlarga xabar yuboriladi
    (async () => {
      let notifiedCount = 0;
      const rates = db.getCommissionRates ? db.getCommissionRates() : { courierPricePerKm: 3000 };
      const pricePerKm = rates.courierPricePerKm || 3000;
      const courierFeeVal = order?.courier_fee != null
        ? Number(order.courier_fee)
        : (order?.delivery_fee != null ? Number(order.delivery_fee) : pricePerKm);
      const distKm = Number(order?.delivery_distance_km || 0);
      const kmNote = distKm > 0
        ? `\nℹ️ <i>Yetkazish masofasi: ~${distKm} km (1 km = ${pricePerKm.toLocaleString()} so'm)</i>`
        : `\nℹ️ <i>Ta'rif: 1 km = ${pricePerKm.toLocaleString()} so'm</i>`;

      for (const c of couriers) {
        if (c.lat == null || c.lon == null) continue; // Koordinatasi noma'lum bo'lsa yuborilmaydi
        const dist = getDistanceKm(c.lat, c.lon, pickLat, pickLon);
        if (dist == null || dist > MAX_COURIER_RADIUS_KM) continue; // 20 km dan uzoq bo'lsa bormaydi!

        await sendNotification(
          c.telegram_id,
          `🆕 <b>Yangi buyurtma #${order.id} tayyor!</b>\n` +
          `💰 Kuryer ulushi: <b>+${courierFeeVal.toLocaleString()} so'm</b>` +
          kmNote + `\n` +
          `📍 Olish punkti: <b>~${dist.toFixed(1)} km</b> (20 km radius ichida)\n\n` +
          `Kuryer panelida "Buyurtmalar" bo'limida qabul qiling 🚴`
        );
        notifiedCount++;
        await new Promise(r => setTimeout(r, 50));
      }
      console.log(`[notifyNearbyCouriers] Buyurtma #${order.id} uchun ${notifiedCount} ta yaqin kuryerga (<= 20 km) xabar yuborildi.`);
    })().catch(e => console.error('notifyNearbyCouriers error:', e.message));
  } catch (e) {
    console.error('notifyNearbyCouriers error:', e.message);
  }
}

async function sendNotification(telegramId, htmlText, extra = {}) {
  if (!telegramId || Number(telegramId) < 1000000) return;
  try {
    await bot.sendMessage(telegramId, htmlText, { parse_mode: 'HTML', ...extra });
  } catch (e) {
    console.error(`Notify error to ${telegramId}:`, e.message);
  }
}

async function sendPhotoNotification(telegramId, receiptUrl, captionHtml, replyMarkup = null) {
  if (!telegramId || Number(telegramId) < 1000000) return;
  try {
    // Telegram rasm izohi (caption) 1024 belgidan oshmasligi kerak
    const opts = { caption: captionHtml.length > 1024 ? captionHtml.slice(0, 1020) + '…' : captionHtml, parse_mode: 'HTML' };
    if (replyMarkup) opts.reply_markup = replyMarkup;

    if (receiptUrl) {
      const localPath = path.join(__dirname, receiptUrl.replace(/^\//, ''));
      if (fs.existsSync(localPath)) {
        await bot.sendPhoto(telegramId, localPath, opts, { filename: path.basename(localPath) });
        return;
      }
    }
    await bot.sendMessage(telegramId, captionHtml, { parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
  } catch (e) {
    console.error(`Photo notify error to ${telegramId}:`, e.message);
  }
}

async function notifyAdmins(htmlText, receiptUrl = null, replyMarkup = null) {
  for (const aid of getAdminIds()) {
    if (receiptUrl) {
      await sendPhotoNotification(aid, receiptUrl, htmlText, replyMarkup);
    } else {
      await sendNotification(aid, htmlText, replyMarkup ? { reply_markup: replyMarkup } : {});
    }
  }
}

function setMiniAppUrl(url) {
  MINI_APP_URL = url;
  console.log(`🔗 Mini App URL yangilandi: ${url}`);
  bot.setChatMenuButton({
    menu_button: JSON.stringify({
      type: 'web_app',
      text: '📱 Ilova',
      web_app: { url }
    })
  }).catch(e => console.error('setChatMenuButton error:', e.message));
}

// To'g'ri to'xtatish: polling ni yopamiz, aks holda qayta ishga tushganda 409 Conflict chiqadi
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`🛑 ${signal} qabul qilindi, bot to'xtatilmoqda...`);
  try { if (POLLING) await bot.stopPolling({ cancel: true }); } catch (e) {}
  try { db.close(); } catch (e) {}
  process.exit(0);
}
process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

module.exports = {
  bot,
  isAdminId,
  getAdminIds,
  sendNotification,
  sendPhotoNotification,
  notifyAdmins,
  notifyNearbyCouriers,
  setMiniAppUrl
};
