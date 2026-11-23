// aiService.js - Yetkazib berish ekotizimi uchun 24/7 LIMITSIZ AI Yordamchi
// Barcha savollarga, shu jumladan Depozit, Balans, Komissiyalar va Skrinshotlarga 100% to'liq javob beradi.

const BOT_USERNAME = '@sorry1345ds_bot';
const BOT_LINK = 'https://t.me/sorry1345ds_bot';

const DEPOSIT_EXPLANATION =
  `📊 <b>Sotuvchining "To'lovlar" va "Faol Depozit Balansi" bo'limi nima va nimaga kerak?</b>\n\n` +
  `Ushbu ekran — <b>Sotuvchi (Restoran / Do'kon)</b>ning tizim bilan moliyaviy hisob-kitob qilish bo'limidir.\n\n` +
  `1️⃣ <b>"Adminga o'tkazilishi shart bo'lgan summa" (Masalan: 250,000 so'm) nima?</b>\n` +
  `• Bu — Admin tomonidan har bir sotuvchi uchun belgilangan <b>kafolatli depozit summasi</b>.\n` +
  `• Sotuvchi tizimda uzluksiz buyurtma qabul qilishi uchun ushbu summani Admin kartasiga o'tkazib, chekini yuklaydi. Admin tasdiqlashi bilan pul to'liq sotuvchining <b>"Faol depozit balansi"</b>ga tushadi.\n\n` +
  `2️⃣ <b>"Faol depozit balansi" nimaga kerak va qanday ishlaydi?</b>\n` +
  `• Mijozlar taom buyurtma qilganda to'lovni <b>100% to'g'ridan-to'g'ri sotuvchiga</b> (sotuvchi kartasiga yoki kuryer orqali naqd) to'laydi.\n` +
  `• Platformada esa har bir buyurtmadan belgilangan komissiya yechiladi:\n` +
  `   👑 <b>Admin (5%) ulushi:</b> Platforma xizmati uchun\n` +
  `   🚴 <b>Kuryer (10%) ulushi:</b> Ovqatni yetkazib bergan kuryerning xizmat haqi\n` +
  `   💰 <b>Sotuvchining sof foydasi (85%):</b> Taomning sof qiymati\n` +
  `• Sotuvchi har bir mijozdan pul olgandan keyin alohida kuryer yoki adminga pul o'tkazib o'tirmasligi uchun, tizim ushbu <b>15% komissiyani (5% Admin + 10% Kuryer) avtomatik tarzda Sotuvchining Faol depozit balansidan yechib boradi</b>!\n\n` +
  `3️⃣ <b>Pastdagi hisobotlar nimani bildiradi?</b>\n` +
  `• <b>Admin (5%) ulushi:</b> Platforma xizmati uchun ushlab qolingan jami summa.\n` +
  `• <b>Kuryer (10%) ulushi:</b> Yetkazib bergan kuryerga avtomatik o'tkazilgan xizmat haqi.\n` +
  `• <b>Sof foydangiz (85%):</b> Sotuvchining o'zida to'liq qolgan sof foyda.\n\n` +
  `4️⃣ <b>Depozit tugab qolsa nima bo'ladi?</b>\n` +
  `• Agar depozit balansi 0 bo'lib qolsa, sotuvchi yangi buyurtmalarni qabul qila olmaydi. Shuning uchun "Depozit hisobi" tugmasini bosib, uni vaqtida to'ldirib turish kerak.`;

// Barcha savol mavzulari
const FAQ_PATTERNS = [
  // 0. Depozit balansi, To'lovlar ekrani, Adminga o'tkazilishi shart bo'lgan summa, "manashu qism nimaga kk"
  {
    regex: /(depozit|faol depozit|adminga o'tkazilishi|o'tkazilishi shart|boshqa summa to'lab|manashu qism|bu qism|nimaga kk|nimaga kerak|tushuntirib ber|to'lovlar bo'limi|tolovlar bolimi|skrinshot|rasmdagi)/i,
    answer: DEPOSIT_EXPLANATION
  },

  // 1. Kuryer bo'lish, ishlash, shartlar, daromad
  {
    regex: /(kuryer|kuriyer|dostavshik|yetkazuvchi|курьер|доставщик).*(qanday|qanaqa|bolish|boshlash|ishlash|qilmoqchiman|ishlamoqchiman|kerak|ariza|shart|pul|daromad|foiz|как стать|как работать)/i,
    answer:
      `🚴 <b>Kuryer bo'lib ishlash tartibi:</b>\n\n` +
      `1. <a href="${BOT_LINK}">${BOT_USERNAME}</a> ga kiring va <b>/start</b> bosing.\n` +
      `2. Yuqori menyudan <b>"🚴 Kuryer"</b> bo'limini tanlang.\n` +
      `3. Telefon raqamingiz va transport turini (Velosiped, Skuter, Moto, Avtomobil yoki Piyoda) kiritib ariza yuboring.\n` +
      `4. Administrator tasdiqlashi bilan sizga Telegram orqali <b>6 xonali maxsus kirish kodi</b> yuboriladi.\n` +
      `5. Kodni ilovaga kiritib, darhol buyurtmalarni qabul qilishni boshlaysiz!\n\n` +
      `💰 <b>Daromad:</b> Har bir yetkazilgan buyurtma summasining <b>15% sof daromadi</b> to'g'ridan-to'g'ri kuryerga tushadi.\n` +
      `📍 <b>Radius:</b> Siz turgan lokatsiyadan 20 km gacha bo'lgan barcha yangi buyurtmalar ilovangizda chiqadi.`
  },

  // 2. Sotuvchi (restoran, magazin, do'kon, oshxona) bo'lish
  {
    regex: /(sotuvchi|magazin|dokon|do'kon|restoran|kafe|oshxona|fastfud|lavashxona|продав|магазин|ресторан).*(qanday|qanaqa|bolish|boshlash|ishlash|ulanish|qoshilish|mahsulot|ovqat qo'shish|menyu|как стать|как подключить)/i,
    answer:
      `🏪 <b>Sotuvchi (Do'kon / Restoran) bo'lib ulanish:</b>\n\n` +
      `1. <a href="${BOT_LINK}">${BOT_USERNAME}</a> ga kiring va <b>/start</b> bosing.\n` +
      `2. Yuqoridagi <b>"🏪 Sotuvchi"</b> tugmasini bosing.\n` +
      `3. Do'kon yoki oshxonangiz nomi va telefon raqamingizni kiritib ariza yuboring.\n` +
      `4. Administrator tasdiqlagach, bot orqali sizga <b>6 xonali kirish kodi</b> beriladi.\n` +
      `5. Kabinetingizga kirib, taomlar va mahsulotlaringizni rasm, vazn va narxlari bilan menyuga qo'shasiz.\n\n` +
      `💵 <b>Daromad:</b> Savdo tushumining <b>80% to'g'ridan-to'g'ri sizga</b> (sotuvchiga) tegishli bo'ladi!`
  },

  // 3. Buyurtma berish, taom/ovqat xarid qilish
  {
    regex: /(buyurtma|zakaz|ovqat|taom|xarid|ovqat ol|taom ol|заказ|еда|купить).*(qanday|qilish|berish|mumkin|qilsam|qilamiz|как заказать)/i,
    answer:
      `🛍️ <b>Taom va mahsulot buyurtma berish:</b>\n\n` +
      `1. <a href="${BOT_LINK}">${BOT_USERNAME}</a> ga kiring va <b>"🚀 Ilovani ochish"</b> tugmasini bosing.\n` +
      `2. Taomnomadan o'zingizga yoqqan taomlarni savatga qo'shing.\n` +
      `3. Yetkazib berish manzilini xaritadan belgilang yoki yozing.\n` +
      `4. To'lov turini belgilang (Plastik karta orqali to'lov yoki naqd pul).\n` +
      `5. Kuryer buyurtmani olib kelganda ilovangizdagi <b>PIN-kod</b>ni aytib buyurtmani qabul qilib olasiz!`
  },

  // 4. PIN-kod nima
  {
    regex: /(pin|kod|pinkod|pin-kod|4 xonali|пин|пинкод).*(nima|qayerda|kerak|uchun|aytish|что такое)/i,
    answer:
      `🔑 <b>PIN-kod nima va nega kerak?</b>\n\n` +
      `Bu mijoz va kuryer o'rtasidagi 4 xonali xavfsizlik kodi!\n` +
      `• Mijoz buyurtma berganda ilovasida 4 xonali PIN-kod chiqadi.\n` +
      `• Kuryer taomni yetkazib berganida, mijozdan ushbu kodni so'raydi.\n` +
      `• Kuryer kodni o'z ilovasiga kiritgach, buyurtma muvaffaqiyatli topshirilgan deb qayd etiladi va pul mablag'lari kuryer balansiga o'tkaziladi.`
  },

  // 5. To'lov usullari (karta, naqd pul, chek)
  {
    regex: /(to'lov|tolov|oplata|payme|click|karta|naqd|plastik|chek|pul tolash|оплата|карта|наличные)/i,
    answer:
      `💳 <b>To'lov usullari:</b>\n\n` +
      `• <b>Plastik karta (Humo / Uzcard):</b> Ilovada ko'rsatilgan karta raqamiga to'lov qilinadi va chek skrinshoti ilovaga yuklanadi. Sotuvchi chekni tasdiqlashi bilan taom tayyorlanishga o'tadi.\n` +
      `• <b>Naqd pul:</b> Taom yetib kelganida kuryerga naqd to'lash mumkin.\n\n` +
      `Barcha to'lovlar 100% shaffof va tizimda saqlanadi.`
  },

  // 6. Tasdiqlash kodi, Admindan ruxsat olish
  {
    regex: /(ruxsat|tasdiq|admin tasdiq|kod kelmadi|kod bermadi|qachon tasdiqlaydi|tasdiqlash|одобрение|код доступа)/i,
    answer:
      `🔐 <b>Admindan ruxsat olish va tasdiqlash kodi:</b>\n\n` +
      `• <b>Sotuvchi</b> yoki <b>Kuryer</b> rejimiga kirish uchun ilovadan telefon raqamingiz bilan ariza yuboriladi.\n` +
      `• Administrator ko'rib chiqib tasdiqlashi bilan botimiz (@sorry1345ds_bot) sizga <b>6 xonali maxsus kirish kodi</b> yuboradi.\n` +
      `• Ilovaga ushbu kodni kiritishingiz bilan profilingiz to'liq faollashadi!`
  },

  // 7. Komissiya va ulushlar
  {
    regex: /(komissiya|ulush|foiz|qanchasi kuryerga|qanchasi sotuvchiga|admin ulushi|комиссия|процент)/i,
    answer:
      `📊 <b>Tizim komissiyalari va daromad:</b>\n\n` +
      `• 🏪 <b>Sotuvchi:</b> 80% (savdo summasi)\n` +
      `• 🚴 <b>Kuryer:</b> 15% (yetkazib berish haqi)\n` +
      `• 👑 <b>Platforma (Admin):</b> 5%\n\n` +
      `To'lovlar to'liq avtomatik va shaffof hisoblanadi.`
  },

  // 8. Bot nima, qanday ishlaydi, bot havolasi
  {
    regex: /(bot nima|bot qayerda|bot link|bot ssilka|botga qanday|ilovaga qanday|ochish|qanday ishlaydi|qanaqa bot|что за бот|как открыть)/i,
    answer:
      `📱 <b>Yetkazib berish ekotizimi boti:</b> @sorry1345ds_bot\n\n` +
      `Bu Telegram ichida to'g'ridan-to'g'ri ishlaydigan zamonaviy yetkazib berish dasturi (Yandex Eats uslubida).\n\n` +
      `👉 <b>Ilovani ishga tushirish uchun bosing:</b> <a href="${BOT_LINK}">@sorry1345ds_bot</a> (/start ni bosing)`
  },

  // 9. Administrator bilan bog'lanish / Shikoyat
  {
    regex: /(admin bilan|adminga yozish|kontakt|aloqa|shikoyat|savol bor|bog'lanish|tel raqam|администратор|связь)/i,
    answer:
      `👨‍💼 <b>Administrator bilan bog'lanish:</b>\n\n` +
      `• Ilova ichidagi <b>"Profil"</b> bo'limidan to'g'ridan-to'g'ri Adminga xabar yoki taklif yozishingiz mumkin.\n` +
      `• Shuningdek, ushbu guruhda savolingizni qoldirsangiz, AI va administrator sizga yordam beradi.`
  },

  // 10. Salomlashish
  {
    regex: /^(salom|assalomu alaykum|assalom|qalaysiz|qalesiz|privet|hi|hello|привет|здравствуйте)/i,
    answer:
      `Assalomu alaykum! Xush kelibsiz! 😊\n\n` +
      `Men <b>Yetkazib Berish Ekotizimi (@sorry1345ds_bot)</b> rasmiy AI yordamchisiman.\n` +
      `Bu guruhda botdan foydalanish, ovqat buyurtma berish, kuryer yoki sotuvchi bo'lib ishlash, to'lovlar va depozitlar bo'yicha savollaringizga doimiy javob beraman. Marhamat, savolingizni bering!`
  }
];

// Savolga mos javobni topish
function getAnswerForText(text, userName = 'Foydalanuvchi') {
  const clean = String(text || '').trim();
  if (!clean) return DEPOSIT_EXPLANATION;

  // Aniq mavzular bo'yicha tekshirish
  for (const item of FAQ_PATTERNS) {
    if (item.regex.test(clean)) {
      return item.answer;
    }
  }

  // Umumiy yo'naltiruvchi javob
  return (
    `Hurmatli <b>${userName}</b>! 😊\n\n` +
    `Savolingiz bo'yicha ma'lumot:\n\n` +
    `• 🏪 <b>Sotuvchilar uchun:</b> Do'kon ochish, depozit balansi va 85% sof foyda.\n` +
    `• 🚴 <b>Kuryerlar uchun:</b> 20 km radiusda 10-15% daromad bilan yetkazish.\n` +
    `• 🛍️ <b>Mijozlar uchun:</b> Taomnomadan tanlab buyurtma berish va PIN-kod orqali qabul qilish.\n\n` +
    `👉 <b>Ilovaga kirish:</b> <a href="${BOT_LINK}">@sorry1345ds_bot</a>`
  );
}

// Guruh xabari botga tegishli ekanligini aniqlash
function isMessageForBot(msg, botUser) {
  if (!msg) return false;
  const text = (msg.text || msg.caption || '').trim();

  // 1. Shaxsiy chat bo'lsa har doim javob beradi
  if (msg.chat.type === 'private') return true;

  // 2. Agar rasm yuborilgan bo'lsa (skrinshot)
  if (msg.photo && msg.photo.length > 0) return true;

  // 3. Botga reply (javob) qilingan bo'lsa
  if (msg.reply_to_message?.from?.id === botUser?.id) return true;

  // 4. Bot usernamei tilga olingan bo'lsa (@sorry1345ds_bot)
  if (text.includes('@sorry1345ds_bot') || (botUser?.username && text.includes(`@${botUser.username}`))) {
    return true;
  }

  // 5. Buyruq bilan boshlansa (/ai, /savol, /help, /start, /bot va h.k.)
  if (text.startsWith('/')) return true;

  // 6. Guruhdagi har qanday savol yoki murojaat:
  const isQuestion = text.includes('?') || /(qanday|qanaqa|nima|qayerda|nechpul|skolko|qachon|bormi|mumkinmi|boladimi|qiladimi|beradimi|kerakmi|kim|nimaga|kk|tushuntir|aytvor|как|что|где|сколько|можно)/i.test(text);
  const hasKeyword = /(bot|ilova|app|kuryer|kuriyer|dostavka|yetkaz|sotuvchi|dokon|do'kon|restoran|kafe|ovqat|taom|zakaz|buyurtma|ish|ishlash|admin|pul|tolov|to'lov|karta|pin|pinkod|kod|ariza|shart|foiz|komissiya|salom|depozit|balans|qism|summa|курьер|доставка|еда|заказ)/i.test(text);

  if (isQuestion || hasKeyword) {
    return true;
  }

  return false;
}

module.exports = {
  getAnswerForText,
  isMessageForBot,
  DEPOSIT_EXPLANATION
};
