require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { prepare } = require('./database');

const token = process.env.SELLER_BOT_TOKEN;
if (!token) throw new Error('SELLER_BOT_TOKEN not set');

const bot = new TelegramBot(token, { polling: true });
const MINI_APP_URL = process.env.MINI_APP_URL || 'http://localhost:5173';

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const firstName = msg.from.first_name || '';
  const lastName = msg.from.last_name || '';
  const username = msg.from.username || '';

  const existing = prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  if (!existing) {
    prepare(`
      INSERT INTO users (telegram_id, role, first_name, last_name, username)
      VALUES (?, 'seller', ?, ?, ?)
    `).run(telegramId, firstName, lastName, username);
  }

  bot.sendMessage(chatId, `🏪 Salom, ${firstName}!\n\nSotuvchi paneliga xush kelibsiz!`, {
    reply_markup: {
      inline_keyboard: [[
        {
          text: '🛍 Sotuvchi Panel',
          web_app: { url: `${MINI_APP_URL}?role=seller&telegramId=${telegramId}` }
        }
      ]]
    }
  });
});

const notifySeller = (sellerTelegramId, amount) => {
  bot.sendMessage(sellerTelegramId,
    `✅ To'lov tasdiqlandi!\n\n💰 Summa: ${amount} UZS`
  );
};

bot.on('polling_error', (error) => {
  console.error('Seller bot polling error:', error.message);
});

module.exports = { bot, notifySeller };
