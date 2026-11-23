/**
 * O'zbekiston Respublikasi qonunchiligiga muvofiq:
 * - Fuqarolik kodeksining 367-370 moddalari (Ommaviy oferta)
 * - 2019-yil 2-iyuldagi O'RQ-547-son "Shaxsiy ma'lumotlar to'g'risida"gi Qonuni
 * - "Elektron tijorat to'g'risida"gi va "Iste'molchilar huquqlarini himoya qilish to'g'risida"gi Qonunlar
 */

const OFERTA_TITLE = "OMMAVIY OFERTA (FOYDALANUVCHI SHARTNOMASI)";

const OFERTA_TEXT = `<b>OMMAVIY OFERTA (FOYDALANUVCHI SHARTNOMASI)</b>
<i>Oxirgi yangilanish: 2026-yil</i>

Mazkur hujjat Oʻzbekiston Respublikasi Fuqarolik kodeksining 367 va 369-moddalariga muvofiq rasmiy ommaviy oferta hisoblanadi va "Yetkazib Berish Xizmati" platformasi (@sorry1345ds_bot) orqali xarid qilish, buyurtma berish va xizmatlardan foydalanish tartibini belgilaydi.

<b>1. ASOSIY TUSHUNCHALAR</b>
1.1. <b>Platforma (Servis)</b> — Telegram bot (@sorry1345ds_bot) va unga ulangan veb-ilova (Mini App) orqali ishlovchi axborot-vositachilik tizimi.
1.2. <b>Mijoz (Foydalanuvchi)</b> — platformadan roʻyxatdan oʻtib, mahsulot va taomlarga buyurtma beruvchi jismoniy shaxs.
1.3. <b>Sotuvchi (Punkt / Restoran)</b> — platformada taom va tovarlarini joylashtirib, tayyorlab sotuvchi mustaqil tadbirkorlik subyekti.
1.4. <b>Kuryer</b> — tayyor buyurtmani sotuvchidan qabul qilib, mijozga eltib beruvchi mustaqil ijrochi.

<b>2. SHARTNOMANING PREDMETI</b>
2.1. Platforma mijozlarga sotuvchilarning taomnomalarini koʻrish, saralash, buyurtma berish, toʻlovni amalga oshirish va kuryer orqali yetkazib berish xizmatlarini tashkil qilish imkonini beradi.
2.2. Foydalanuvchi botda "Roziman va Qabul qilaman" tugmasini bosishi yoki ilovadan foydalanishni boshlashi bilan mazkur ofertani toʻliq va soʻzsiz (aksept) qabul qilgan hisoblanadi.

<b>3. BUYURTMA BERISH VA TOʻLOV TARTIBI</b>
3.1. Mijoz taomnomadan mahsulotlarni savatchaga qoʻshadi, yetkazib berish manzilini (va xaritada GPS nuqtasini) belgilaydi va toʻlov turini tanlaydi.
3.2. <b>Toʻlov turlari:</b>
  a) <i>Naqd pul</i> — mahsulot yetkazib berilganda bevosita kuryerga topshiriladi;
  b) <i>Karta orqali</i> — sotuvchi rekvizitlariga oʻtkaziladi va toʻlov cheki ilovaga yuklanadi.
3.3. Buyurtma sotuvchi tomonidan tasdiqlangach tayyorlashga tushadi.

<b>4. YETKAZIB BERISH VA QABUL QILISH</b>
4.1. Yetkazib berish muddati masofa, ob-havo va yoʻl holatiga bogʻliq boʻlib, buyurtma holati ilovada jonli kuzatiladi.
4.2. <b>Xavfsizlik PIN-kodi:</b> Har bir buyurtma uchun mijozga 4 xonali maxfiy PIN-kod beriladi. Mijoz taomni kuryerdan olayotganda ushbu kodni aytishi shart. PIN-kod kiritilishi buyurtma sifatli qabul qilinganini tasdiqlaydi.

<b>5. BEKOR QILISH VA MABLAGʻLARNI QAYTARISH</b>
5.1. Mijoz buyurtmani sotuvchi tayyorlashni boshlagunga qadar (adashib bosilganda) bekor qilish huquqiga ega.
5.2. Agar keltirilgan taom sifatsiz, yaroqsiz boʻlsa yoki buyurtma adashgan boʻlsa, mijoz darhol bot orqali Adminga murojaat qiladi.
5.3. Asosli eʼtirozlar boʻyicha toʻlangan mablagʻ 24 soat ichida mijozga toʻliq qaytariladi.

<b>6. MASʼULIYAT CHEGARALARI VA FORS-MAJOR</b>
6.1. Taomlarning sifati, yangiligi va sanitariya talablariga mosligi uchun bevosita Sotuvchi (tayyorlovchi) javobgar hisoblanadi.
6.2. Mijoz tomonidan manzil yoki telefon raqami notoʻgʻri koʻrsatilganligi oqibatida yetkazilmagan buyurtmalar uchun Platforma javobgar boʻlmaydi.
6.3. Tabiiy ofatlar, internet uzilishlari va boshqa yengib boʻlmas kuchlar (fors-major) taʼsirida yuzaga kelgan kechikishlar uchun tomonlar javobgarlikdan ozod qilinadi.

<b>7. NIZOLARNI HAL QILISH</b>
7.1. Barcha kelishmovchiliklar oʻzaro muzokaralar yoʻli bilan hal etiladi.
7.2. Kelishuvga erishilmagan taqdirda, nizolar Oʻzbekiston Respublikasining amaldagi qonunchiligi asosida sud tartibida koʻrib chiqiladi.`;

const PRIVACY_TITLE = "MAXFIYLIK SIYOSATI (SHAXSIY MAʼLUMOTLARNI HIMOYA QILISH)";

const PRIVACY_TEXT = `<b>MAXFIYLIK VA SHAXSIY MAʼLUMOTLARNI HIMOYA QILISH SIYOSATI</b>
<i>Oʻzbekiston Respublikasining "Shaxsiy maʼlumotlar toʻgʻrisida"gi OʻRQ-547-son Qonuniga muvofiq</i>

Mazkur Maxfiylik siyosati "Yetkazib Berish Xizmati" platformasi (@sorry1345ds_bot) foydalanuvchilarining shaxsiy maʼlumotlarini yigʻish, saqlash, qayta ishlash va himoya qilish qoidalarini belgilaydi.

<b>1. YIGʻILADIGAN SHAXSIY MAʼLUMOTLAR</b>
Platforma xizmat koʻrsatish uchun quyidagi maʼlumotlarni toʻplaydi:
1.1. <b>Identifikatsiya maʼlumotlari:</b> Telegram ID, ism, familiya, Telegram foydalanuvchi nomi (@username);
1.2. <b>Aloqa maʼlumotlari:</b> Telefon raqami (buyurtmani aniqlashtirish va kuryer bogʻlanishi uchun);
1.3. <b>Geolokatsiya va manzil:</b> Foydalanuvchi kiritgan yetkazib berish manzili hamda xaritadagi GPS koordinatalari (kuryer taomni tez va toʻgʻri eltib berishi uchun);
1.4. <b>Buyurtmalar tarixi:</b> Xarid qilingan taomlar, sanalar va toʻlov holati.

<b>2. MAʼLUMOTLARNI QAYTA ISHLASH MAQSADI</b>
Shaxsiy maʼlumotlar faqat quyidagi qonuniy maqsadlarda qayta ishlanadi:
2.1. Buyurtmalarni qabul qilish, rasmiylashtirish va ijroga topshirish;
2.2. Kuryer orqali taomni koʻrsatilgan manzilga aniq yetkazib berish;
2.3. Mijozga buyurtma holati boʻyicha xabarnomalar yuborish;
2.4. Toʻlov hisob-kitoblarini shaffof yuritish va eʼtirozlarni koʻrib chiqish.

<b>3. MAʼLUMOTLARNI SAQLASH VA XAVFSIZLIGI</b>
3.1. Foydalanuvchilar maʼlumotlari zamonaviy shifrlash texnologiyalari bilan himoyalangan serverlarda saqlanadi.
3.2. <b>Kafolat:</b> Shaxsiy maʼlumotlar uchinchi shaxslarga tijoriy, reklama yoki marketing maqsadlarida HECH QACHON sotilmaydi va ijaraga berilmaydi!
3.3. Kuryer va sotuvchiga faqat buyurtmani bajarish uchun zarur boʻlgan minimal maʼlumotlar (ism, manzil, telefon) taqdim etiladi.

<b>4. FOYDALANUVCHINING HUQUQLARI</b>
Oʻzbekiston Respublikasining "Shaxsiy maʼlumotlar toʻgʻrisida"gi Qonuniga muvofiq Siz:
4.1. Qayta ishlanayotgan shaxsiy maʼlumotlaringiz tarkibini bilish;
4.2. Maʼlumotlaringizni toʻldirish yoki oʻzgartirish (Profil boʻlimi orqali);
4.3. Shaxsiy maʼlumotlaringizni oʻchirib tashlashni talab qilish;
4.4. Istalgan paytda maʼlumotlarni qayta ishlashga bergan roziligingizni qaytarib olish huquqiga egasiz.

<b>5. ROZILIK BILDIRISH VA QABUL QILISH</b>
5.1. Botda "Roziman va Qabul qilaman" tugmasini bosish "Shaxsiy maʼlumotlar toʻgʻrisida"gi Qonunning 13-moddasiga asosan shaxsiy maʼlumotlarni yigʻish va qayta ishlashga berilgan toʻliq yozma/elektron rozilik hisoblanadi.
5.2. Rozilik bildirmagan foydalanuvchilar platformaning buyurtma berish xizmatlaridan foydalana olmaydi.`;

module.exports = {
  OFERTA_TITLE,
  OFERTA_TEXT,
  PRIVACY_TITLE,
  PRIVACY_TEXT
};
