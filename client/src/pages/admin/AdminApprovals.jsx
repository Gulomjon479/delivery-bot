import { useState, useEffect } from 'react';

export default function AdminApprovals({ telegramId }) {
  const [data, setData] = useState({ list: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // default shows pending requests
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [codes, setCodes] = useState({}); // reqId -> code string
  const [msg, setMsg] = useState('');

  const randomCode = () => String(Math.floor(100000 + Math.random() * 900000));

  const loadRequests = () => {
    fetch(`/api/admin/access-requests?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(res => {
        setData(res || { list: [], stats: { total: 0, pending: 0, approved: 0, rejected: 0 } });
        // Yangi kutilayotgan so'rovlar uchun boshlang'ich tasodifiy kodlar tayyorlaymiz
        if (res?.list) {
          setCodes(prev => {
            const next = { ...prev };
            res.list.forEach(item => {
              if (!next[item.id]) {
                next[item.id] = item.access_code || randomCode();
              }
            });
            return next;
          });
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 4000);
    return () => clearInterval(interval);
  }, [telegramId]);

  const handleApprove = async (id) => {
    const code = String(codes[id] || randomCode()).trim();
    if (!code) {
      alert('Iltimos, kirish kodini kiriting!');
      return;
    }

    if (!confirm(`Ushbu foydalanuvchini tasdiqlaysizmi?\n\n🔑 Kirish kodi: ${code}\nFoydalanuvchiga Telegram orqali xabar yuboriladi.`)) {
      return;
    }

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/approve?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ access_code: code })
      });
      const result = await res.json();
      if (res.ok) {
        setMsg(`✅ So'rov tasdiqlandi va ${code} kodi foydalanuvchiga Telegram orqali yuborildi!`);
        setTimeout(() => setMsg(''), 5000);
        loadRequests();
      } else {
        alert(result.error || 'Tasdiqlashda xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id) => {
    if (!confirm("Ushbu so'rovni bekor qilishni (rad etishni) xohlaysizmi?\n\nFoydalanuvchi faqat mijoz bo'lib qoladi va unga bekor qilingani haqida xabar boradi.")) {
      return;
    }

    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/access-requests/${id}/reject?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        }
      });
      const result = await res.json();
      if (res.ok) {
        setMsg(`❌ So'rov bekor qilindi.`);
        setTimeout(() => setMsg(''), 4000);
        loadRequests();
      } else {
        alert(result.error || 'Bekor qilishda xatolik yuz berdi');
      }
    } catch {
      alert('Tarmoq xatoligi');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Ushbu yozuvni ro'yxatdan butunlay o'chirib tashlaysizmi?")) return;
    try {
      await fetch(`/api/admin/access-requests/${id}?tid=${telegramId}`, {
        method: 'DELETE',
        headers: { 'x-telegram-id': String(telegramId) }
      });
      loadRequests();
    } catch {}
  };

  const regenerateCode = (id) => {
    setCodes(prev => ({ ...prev, [id]: randomCode() }));
  };

  const filteredList = (data.list || []).filter(item => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = `${item.first_name || ''} ${item.last_name || ''}`.toLowerCase().includes(q);
      const matchUser = (item.username || '').toLowerCase().includes(q);
      const matchPhone = (item.phone || '').includes(q);
      const matchTid = String(item.telegram_id).includes(q);
      const matchShop = (item.shop_name || '').toLowerCase().includes(q);
      return matchName || matchUser || matchPhone || matchTid || matchShop;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Sarlavha va tushuntirish */}
      <div className="card bg-gray-800/95 border border-orange-500/30 p-4 space-y-2 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <span>🔐</span> Ro'yxatdan O'tishni Tasdiqlash
            </h2>
            <p className="text-xs text-gray-300">
              Foydalanuvchilar to'g'ridan-to'g'ri faqat mijoz bo'ladi. Sotuvchi yoki Kuryer bo'lishi uchun shu yerdan tasdiqlab kod yuborasiz.
            </p>
          </div>
          <button
            onClick={loadRequests}
            className="btn-secondary text-xs px-2.5 py-1.5 flex items-center gap-1 shadow"
            title="Yangilash"
          >
            🔄 Yangilash
          </button>
        </div>

        {msg && (
          <div className="p-2.5 bg-green-950/80 border border-green-500 rounded-xl text-green-300 text-xs font-bold animate-slide-up flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg('')} className="text-gray-400 hover:text-white">✕</button>
          </div>
        )}

        {/* Statistika ko'rsatkichlari */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-gray-700/60 text-center">
          <div
            onClick={() => setFilter('pending')}
            className={`p-2 rounded-xl cursor-pointer border transition-all ${
              filter === 'pending'
                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300 font-bold'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-base block">⏳</span>
            <span className="text-xs block font-bold">{data.stats.pending || 0}</span>
            <span className="text-[10px] block text-gray-400">Kutilmoqda</span>
          </div>

          <div
            onClick={() => setFilter('approved')}
            className={`p-2 rounded-xl cursor-pointer border transition-all ${
              filter === 'approved'
                ? 'bg-green-500/20 border-green-500 text-green-300 font-bold'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-base block">✅</span>
            <span className="text-xs block font-bold">{data.stats.approved || 0}</span>
            <span className="text-[10px] block text-gray-400">Tasdiqlangan</span>
          </div>

          <div
            onClick={() => setFilter('rejected')}
            className={`p-2 rounded-xl cursor-pointer border transition-all ${
              filter === 'rejected'
                ? 'bg-red-500/20 border-red-500 text-red-300 font-bold'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-base block">❌</span>
            <span className="text-xs block font-bold">{data.stats.rejected || 0}</span>
            <span className="text-[10px] block text-gray-400">Bekor qilingan</span>
          </div>

          <div
            onClick={() => setFilter('all')}
            className={`p-2 rounded-xl cursor-pointer border transition-all ${
              filter === 'all'
                ? 'bg-orange-500/20 border-orange-500 text-orange-300 font-bold'
                : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
            }`}
          >
            <span className="text-base block">📋</span>
            <span className="text-xs block font-bold">{data.stats.total || 0}</span>
            <span className="text-[10px] block text-gray-400">Jami</span>
          </div>
        </div>
      </div>

      {/* Qidiruv */}
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Ism, username, telefon yoki ID bo'yicha qidirish..."
          className="input text-xs pl-8"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-white text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* So'rovlar ro'yxati */}
      {loading ? (
        <div className="text-center text-gray-400 py-10">⏳ So'rovlar yuklanmoqda...</div>
      ) : filteredList.length === 0 ? (
        <div className="card text-center py-12 text-gray-400 space-y-2">
          <span className="text-4xl block">📭</span>
          <p className="text-sm font-semibold">
            {filter === 'pending'
              ? 'Hozircha kutilayotgan yangi so\'rovlar yo\'q.'
              : filter === 'approved'
              ? 'Tasdiqlangan so\'rovlar mavjud emas.'
              : filter === 'rejected'
              ? 'Bekor qilingan so\'rovlar yo\'q.'
              : 'Hech qanday so\'rov topilmadi.'}
          </p>
          <p className="text-xs text-gray-500">
            Foydalanuvchilar ilovada Sotuvchi yoki Kuryer bo'lish so'rovini yuborganida shu yerda paydo bo'ladi.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((item) => {
            const isPending = item.status === 'pending';
            const isApproved = item.status === 'approved';
            const isRejected = item.status === 'rejected';
            const codeVal = codes[item.id] || item.access_code || '';

            return (
              <div
                key={item.id}
                className={`card p-4 space-y-3 border-2 transition-all shadow-md ${
                  isPending
                    ? 'bg-gray-800/90 border-yellow-500/60'
                    : isApproved
                    ? 'bg-gray-800/80 border-green-500/50'
                    : 'bg-gray-800/70 border-red-500/40 opacity-80'
                }`}
              >
                {/* Yuqori qism: Rol va Holat */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold flex items-center gap-1 ${
                      item.requested_role === 'seller'
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                    }`}>
                      <span>{item.requested_role === 'seller' ? '🏪' : '🚴'}</span>
                      <span>{item.requested_role === 'seller' ? 'SOTUVCHI' : 'KURYER'}</span>
                    </span>

                    <span className="text-[11px] font-mono text-gray-400">
                      ID: <b>{item.telegram_id}</b>
                    </span>
                  </div>

                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                    isPending
                      ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40'
                      : isApproved
                      ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                      : 'bg-red-500/20 text-red-300 border border-red-500/40'
                  }`}>
                    {isPending ? '⏳ Kutilmoqda' : isApproved ? '✅ Tasdiqlangan' : '❌ Bekor qilingan'}
                  </span>
                </div>

                {/* Foydalanuvchi ma'lumotlari */}
                <div className="bg-gray-900/90 rounded-xl p-3 border border-gray-700/80 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">
                      {item.first_name} {item.last_name || ''}
                    </span>
                    {item.username && (
                      <a
                        href={`https://t.me/${item.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline font-mono text-[11px]"
                      >
                        @{item.username}
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-gray-300 pt-1 border-t border-gray-800">
                    <div>
                      📞 <b>Telefon:</b>{' '}
                      {item.phone ? (
                        <a href={`tel:${item.phone}`} className="text-orange-400 underline font-mono">
                          {item.phone}
                        </a>
                      ) : (
                        <span className="text-gray-500">Ko'rsatilmagan</span>
                      )}
                    </div>

                    {item.shop_name && (
                      <div>
                        🏪 <b>Do'kon nomi:</b> <span className="text-white font-semibold">{item.shop_name}</span>
                      </div>
                    )}

                    {item.vehicle_type && (
                      <div>
                        🛵 <b>Transport:</b> <span className="text-white font-semibold">{item.vehicle_type}</span>
                      </div>
                    )}

                    <div className="text-[11px] text-gray-400">
                      🕒 <b>So'rov vaqti:</b> {item.created_at || 'Yaqinda'}
                    </div>
                  </div>
                </div>

                {/* Tasdiqlash / Kirish kodi boshqaruvi */}
                <div className="bg-gray-900/95 rounded-xl p-3 border border-gray-700/90 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-gray-200 flex items-center gap-1.5">
                      <span>🔑</span> Kirish kodi (Foydalanuvchiga yuboriladi):
                    </span>
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => regenerateCode(item.id)}
                        className="text-[11px] text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1"
                        title="Tasodifiy yangi kod yaratish"
                      >
                        🎲 Yangi kod
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={codeVal}
                      disabled={isApproved || actionLoading === item.id}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setCodes(prev => ({ ...prev, [item.id]: val }));
                      }}
                      placeholder="6 xonali kod (masalan: 749215)"
                      className="input font-mono text-center text-sm font-extrabold tracking-widest bg-gray-950 border-orange-500/40 text-orange-300 py-2"
                    />
                  </div>

                  {/* Amallar tugmalari */}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {/* 1. Tasdiqlash va Kod yuborish */}
                    <button
                      type="button"
                      onClick={() => handleApprove(item.id)}
                      disabled={actionLoading === item.id}
                      className="flex-1 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      {actionLoading === item.id ? (
                        '⏳ Yuborilmoqda...'
                      ) : (
                        <>
                          <span>✅</span>
                          <span>{isApproved ? 'Qayta kod yuborish' : 'Tasdiqlash & Kod yuborish'}</span>
                        </>
                      )}
                    </button>

                    {/* 2. Bekor qilish (Rad etish) */}
                    {!isRejected && (
                      <button
                        type="button"
                        onClick={() => handleReject(item.id)}
                        disabled={actionLoading === item.id}
                        className="bg-red-600/90 hover:bg-red-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 transition-all shadow active:scale-95 disabled:opacity-50"
                        title="Shunchaki bosib ko'rgan bo'lsa yoki bekor qilmoqchi bo'lsangiz"
                      >
                        <span>❌</span>
                        <span>Bekor qilish</span>
                      </button>
                    )}

                    {/* 3. O'chirish */}
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white py-2.5 px-2.5 rounded-xl text-xs transition-all border border-gray-700"
                      title="O'chirish"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
