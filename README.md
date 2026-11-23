# 🍕 Yetkazib berish platformasi — Telegram Bot + Mini App (Yandex Eats Style)

Ushbu loyiha Yandex Taomlar (Yandex Eats) uslubidagi yetkazib berish xizmati uchun to'liq avtomatlashtirilgan Telegram Bot va Web Mini App tizimidir.

---

## 🛠 Texnologiyalar
- **Backend:** Node.js, Express, Multer, Cors
- **Baza:** Native `node:sqlite` (qo'shimcha C++ kompilyator yoki drayver talab qilmaydi)
- **Telegram Bot:** `node-telegram-bot-api` (Polling rejimida ishlaydi)
- **Frontend (Mini App):** React 18, Vite, Tailwind CSS (Dark tema, Apelsin rangli aktsentlar)

---

## 👥 4 ta Rol va ularning imkoniyatlari

### 1️⃣ 👑 Admin Paneli
- **Profil:** Ism, familiya, Telegram username, profil rasmini o'zgartirish, karta raqami va egasining ismi.
- **Kuryerlar:**
  - Ro'yxatdan o'tgan barcha kuryerlar ro'yxati (avatar, ism, daromad, zakazlar soni).
  - To'lanmagan summa hisoblagichi.
  - **💸 To'lash** tugmasi orqali to'lov chekini yuklash (chek kuryerga boradi va uning to'lanmagan summasi 0 ga tushadi).
  - **🚫 Bloklash / 🔓 Blokdan chiqarish** tugmasi.
  - **💬 Xabar yozish** qismi.
- **Sotuvchilar:**
  - Sotuvchilar ro'yxati va profili.
  - Sotuvchi kiritgan barcha taomlar va kategoriyalarni (narxi, og'irligi, rasmi) ko'rish.
  - Bloklash va xabar yozish.
- **Mijozlar:**
  - Mijozlar ro'yxati, xaridlar soni.
  - Mijozlar qoldirgan shikoyat va takliflar.
  - Bloklash imkoniyati.
  - **🎁 Sovg'alar yuborish:** Telegram sovg'alariga o'xshash (🐻 Ayiqcha, 🌸 Gul, ⭐ Yulduz, 💎 Olmos va h.k.).
- **Daromad bo'limi:**
  - Umumiy aylanma va admin ulushi (**10%**).
  - Kuryerga berilgan to'lovlar hisobi va joriy balans.
  - Ulushlar balansi: **Admin 10%**, **Kuryer 15%**, **Sotuvchi 75%**.

---

### 2️⃣ 🚴 Kuryer Paneli
- **Profil:** Ism, familiya, telefon raqam, karta raqami va karta egasi.
- **Buyurtmalar:**
  - Faqat buyurtma tushganda ko'rinadi.
  - **✅ Qabul qilish** tugmasi.
  - Olish punkti (sotuvchi restorani) nomi va manzili.
  - Sotuvchi topshirgandan so'ng kuryer va mijoz orasidagi masofa chizig'i va marshrut.
  - **📡 Lokatsiya tugmasi:** 20 km gacha bo'lgan masofadagi punkt va mijozlar bilan ishlash.
- **Hisobim (Admin To'lovi):**
  - Admin to'lashi kerak bo'lgan kuryer ulushi (15%).
  - Admin tashlagan cheklar va to'lovlar ro'yxati.

---

### 3️⃣ 🏪 Sotuvchi Paneli
- **Profil:** Ism, familiya, telegram username, savdo punkti (filial) nomi, karta raqami va admin bilan xabarlashuv.
- **Buyurtmalar:**
  - Mijozlar bergan buyurtmalar, miqdori va mijoz ma'lumotlari.
  - Taom tayyor bo'lgach **🤝 Kuryerga topshirdim** tugmasi (bosilganda kuryer va mijoz orasidagi harakat boshlanadi).
- **To'lovlar bo'limi:**
  - Adminga 500 000 so'm to'lov to'lash va chekni yuklash.
  - Admin chekni tasdiqlagach hisoblanadi va belgilangan 500 000 so'm miqdoridan kamayib boradi.
- **Mahsulotlar va Kategoriyalar:**
  - **➕ Kategoriya:** Alohida bo'limlar ochish (masalan: Pitsalar, Lavashlar, Ichimliklar).
  - Har bir bo'limga **➕ Mahsulot:** Mahsulot nomi, narxi, og'irligi/hajmi, rasmi.
  - Chiroyli kartochkalar ko'rinishi.

---

### 4️⃣ 🛍️ Mijoz Paneli
- **Profil:** Ism, familiya, xaridlar soni, adminga shikoyat va taklif yozish, admindan kelgan sovg'alar (🐻, 🌸, 💎) kolleksiyasi.
- **Taomnoma (Katalog):** Restoranlar va taomlarni tanlash, rasmi, narxi, vaznini ko'rish va buyurtma berish.
- **Buyurtmalar:** Buyurtma holati, kuryer ma'lumotlari va yetkazish harakati.
- **To'lov:** Savdogar kiritgan karta raqamiga pul o'tkazib, chekni yuklash.

---

## 🚀 Ishga tushirish yo'riqnomasi

### 1-qadam: Bot tokeni
`.env` faylida bot tokeningiz ko'rsatilgan:
```env
BOT_TOKEN=9143655513:AAGWto5jJmGpWC-a9lTAJfXikFIYh7J1vhM
PORT=3000
MINI_APP_URL=http://localhost:3000
```

### 2-qadam: Serverni ishga tushirish
Loyihaning ildiz papkasida `run.bat` faylini ikki marta bosing yoki terminalda:
```powershell
cd C:\Users\Xoliqulov\delivery-bot
node server/index.js
```

### 3-qadam: Botdan foydalanish
Telegramda [@BotName] botingizga kiring va **/start** buyrug'ini yuboring:
- Admin bo'lish uchun botga **/makeadmin** deb yozing.
- Shunda barcha bo'limlar: **👑 Admin**, **🛍️ Mijoz**, **🚴 Kuryer**, **🏪 Sotuvchi** tugmalari to'liq ochiladi!
