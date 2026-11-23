import { useState, useEffect } from 'react';

export default function RoleGateScreen({ role, telegramId, onApproved, onBackToCustomer }) {
  const [loading, setLoading] = useState(true);
  const [statusData, setStatusData] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phone, setPhone] = useState('');
  const [shopName, setShopName] = useState('');
  const [vehicleType, setVehicleType] = useState('Velosiped');
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const isSeller = role === 'seller';
  const roleTitle = isSeller ? 'Sotuvchi' : 'Kuryer';
  const roleEmoji = isSeller ? '🏪' : '🚴';

  const checkStatus = () => {
    fetch(`/api/access-requests/status/${telegramId}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(d => {
        setStatusData(d);
        if (isSeller && d.is_seller_approved) {
          onApproved();
        } else if (!isSeller && d.is_courier_approved) {
          onApproved();
        }
        const existingReq = isSeller ? d.seller_request : d.courier_request;
        if (existingReq?.phone) setPhone(existingReq.phone);
        if (existingReq?.shop_name) setShopName(existingReq.shop_name);
        if (existingReq?.vehicle_type) setVehicleType(existingReq.vehicle_type);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    checkStatus();
    const timer = setInterval(checkStatus, 3000);
    return () => clearInterval(timer);
  }, [role, telegramId]);

  // So'rov yuborish
  const handleSubmitRequest = async (e) => {
    e?.preventDefault();
    if (!phone.trim() || phone.trim().length < 7) {
      setErrorMsg('Iltimos, telefon raqamingizni to\'liq kiriting!');
      return;
    }
    if (isSeller && !shopName.trim()) {
      setErrorMsg('Iltimos, do\'koningiz yoki savdo punktingiz nomini kiriting!');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/access-requests/submit?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({
          telegramId,
          requestedRole: role,
          phone: phone.trim(),
          shopName: isSeller ? shopName.trim() : null,
          vehicleType: !isSeller ? vehicleType : null
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(data.message || 'So\'rovingiz qabul qilindi! Admin tasdiqlab bot orqali kod yuboradi.');
        checkStatus();
      } else {
        setErrorMsg(data.error || 'So\'rov yuborishda xatolik yuz berdi');
      }
    } catch {
      setErrorMsg('Tarmoqqa ulanishda xatolik');
    } finally {
      setSubmitting(false);
    }
  };

  // Kirish kodini tekshirish
  const handleVerifyCode = async (e) => {
    e?.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) {
      setErrorMsg('Iltimos, 6 xonali kirish kodini kiriting!');
      return;
    }

    setVerifying(true);
    setErrorMsg('');
    try {
      const res = await fetch(`/api/access-requests/verify-code?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({
          telegramId,
          role,
          code: cleanCode
        })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg('🎉 Kodingiz tasdiqlandi! Kabinetga kirilmoqda...');
        setTimeout(() => {
          onApproved();
        }, 1000);
      } else {
        setErrorMsg(data.error || 'Kiritilgan kod noto\'g\'ri!');
      }
    } catch {
      setErrorMsg('Ulanishda xatolik yuz berdi');
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-10 h-10 rounded-full border-4 border-orange-500 border-t-transparent animate-spin" />
        <p className="text-gray-400 text-sm">Ruxsat holati tekshirilmoqda...</p>
      </div>
    );
  }

  const currentReq = isSeller ? statusData?.seller_request : statusData?.courier_request;
  const isPending = currentReq?.status === 'pending';
  const isRejected = currentReq?.status === 'rejected';

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 animate-slide-up pb-20">
      {/* Sarlavha kartasi */}
      <div className="card bg-gray-800/95 border-2 border-orange-500/50 p-5 text-center space-y-3 shadow-xl">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 border-2 border-orange-500/40 flex items-center justify-center text-3xl shadow-inner">
          {roleEmoji}
        </div>

        <div>
          <span className="text-[10px] uppercase font-extrabold tracking-widest text-orange-400 block mb-1">
            XAVFSIZLIK VA NAZORAT
          </span>
          <h2 className="text-lg font-extrabold text-white">
            {roleTitle} Kabinetiga Kirish Cheklangan
          </h2>
          <p className="text-xs text-gray-300 mt-1 leading-relaxed">
            Hamma foydalanuvchilar to'g'ridan-to'g'ri faqat mijoz bo'la oladi.{' '}
            <b>{roleTitle}</b> sifatida ishlash uchun Administrator tasdiqidan o'tishingiz va maxsus kirish kodiga ega bo'lishingiz shart.
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-950/80 border border-red-500 rounded-xl text-red-200 text-xs font-bold text-left animate-slide-up flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-gray-400 hover:text-white">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-green-950/80 border border-green-500 rounded-xl text-green-200 text-xs font-bold text-left animate-slide-up flex items-center justify-between">
            <span>✅ {successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-gray-400 hover:text-white">✕</button>
          </div>
        )}
      </div>

      {/* 1. Holat xabarnomasi: Agar so'rov yuborilgan bo'lsa */}
      {isPending && (
        <div className="card bg-yellow-950/50 border border-yellow-500/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-yellow-400 font-bold text-xs">
            <span className="text-lg">⏳</span>
            <span>Arizangiz Administrator ko'rib chiqishida!</span>
          </div>
          <p className="text-xs text-yellow-200/90 leading-relaxed">
            Admin arizangizni tasdiqlashi bilan Telegram Bot (<b>@sorry1345ds_bot</b>) orqali sizga <b>6 xonali maxsus kirish kodi</b> yuboriladi. Kodni olganingizdan so'ng pastdagi maydonga kiriting.
          </p>
          <div className="pt-1 text-[11px] text-gray-400 font-mono">
            Ariza vaqti: {currentReq.created_at || 'Yaqinda'}
          </div>
        </div>
      )}

      {isRejected && (
        <div className="card bg-red-950/60 border border-red-500/70 p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-400 font-bold text-xs">
            <span className="text-lg">❌</span>
            <span>Arizangiz Administrator tomonidan bekor qilingan</span>
          </div>
          <p className="text-xs text-red-200/90 leading-relaxed">
            Arizangiz tasdiqlanmadi. Siz buyurtma beruvchi mijoz sifatida to'liq xarid qilishingiz mumkin. Agar adashib bekor qilingan bo'lsa, qayta so'rov yuborishingiz mumkin.
          </p>
        </div>
      )}

      {/* 2. Kirish kodini kiritish bloki (Kodni olganlar uchun) */}
      <div className="card bg-gray-800 border border-gray-700 p-4 space-y-3 shadow-lg">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <span className="text-base">🔑</span>
          <span>Admin bergan kirish kodini kiritish:</span>
        </div>

        <form onSubmit={handleVerifyCode} className="space-y-2.5">
          <div>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Masalan: 749215"
              className="input text-center font-mono text-base font-extrabold tracking-widest bg-gray-900 border-orange-500/40 text-orange-400 py-3"
            />
          </div>

          <button
            type="submit"
            disabled={verifying || !code.trim()}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-extrabold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
          >
            {verifying ? '⏳ Tekshirilmoqda...' : '🔓 Kodni tasdiqlash va Kirish'}
          </button>
        </form>
      </div>

      {/* 3. Yangi so'rov yuborish formasi */}
      {(!currentReq || isRejected) && (
        <div className="card bg-gray-800 border border-gray-700 p-4 space-y-3 shadow-lg">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <span className="text-base">📝</span>
            <span>{roleTitle} bo'lish uchun ariza topshirish:</span>
          </div>

          <form onSubmit={handleSubmitRequest} className="space-y-3 text-xs">
            <div>
              <label className="text-gray-400 block mb-1 font-semibold">
                📞 Telefon raqamingiz (Admin bog'lanishi uchun):
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="input text-xs font-mono"
              />
            </div>

            {isSeller ? (
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">
                  🏪 Do'kon yoki Savdo punkti nomi:
                </label>
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Masalan: Jasur market, Rayhon milliy taomlar..."
                  className="input text-xs"
                />
              </div>
            ) : (
              <div>
                <label className="text-gray-400 block mb-1 font-semibold">
                  🛵 Yetkazib berish transport turi:
                </label>
                <select
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  className="input text-xs"
                >
                  <option value="Velosiped">🚲 Velosiped</option>
                  <option value="Skuter / Moped">🛵 Skuter / Moped</option>
                  <option value="Avtomobil">🚗 Avtomobil</option>
                  <option value="Piyoda">🚶 Piyoda</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-gray-600 active:scale-95 disabled:opacity-50"
            >
              {submitting ? '⏳ Yuborilmoqda...' : '📨 Administratorga So\'rov Yuborish'}
            </button>
          </form>
        </div>
      )}

      {/* Ortga qaytish tugmasi */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onBackToCustomer}
          className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-gray-900 border border-gray-800 flex items-center justify-center gap-1.5 transition-all"
        >
          <span>🛍️</span> Mijoz rejimiga qaytish
        </button>
      </div>
    </div>
  );
}
