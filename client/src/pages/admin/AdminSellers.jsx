import { useState, useEffect } from 'react'

function SellerModal({ seller, adminId, telegramId, onClose, onUpdated }) {
  const [categories, setCategories] = useState([])
  const [blocking, setBlocking] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [showMsg, setShowMsg] = useState(false)
  const [messages, setMessages] = useState([])
  const [showCats, setShowCats] = useState(false)
  const [confirmingId, setConfirmingId] = useState(null)
  const [customAmounts, setCustomAmounts] = useState({})
  const [assignedAmountInput, setAssignedAmountInput] = useState(String(seller.required_deposit_amount !== undefined ? seller.required_deposit_amount : 300000))
  const [savingAssignedAmount, setSavingAssignedAmount] = useState(false)
  const [amountSavedMsg, setAmountSavedMsg] = useState('')

  const handleSaveAssignedAmount = async () => {
    const clean = Number(assignedAmountInput)
    if (isNaN(clean) || clean < 0) return alert("Iltimos, to'g'ri summa kiriting!")
    setSavingAssignedAmount(true)
    try {
      const res = await fetch(`/api/admin/sellers/${seller.id}/set-deposit-amount?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ amount: clean })
      })
      const data = await res.json()
      if (res.ok) {
        seller.required_deposit_amount = clean
        setAmountSavedMsg('✅ Summa belgilandi! Sotuvchiga to\'lov xabari yuborildi.')
        setTimeout(() => setAmountSavedMsg(''), 3500)
        onUpdated && onUpdated()
      } else {
        alert(data.error || 'Xatolik yuz berdi')
      }
    } catch {
      alert('Xatolik yuz berdi')
    } finally {
      setSavingAssignedAmount(false)
    }
  }

  useEffect(() => {
    if (showCats) {
      fetch(`/api/admin/sellers/${seller.id}/categories?tid=${telegramId}`, {
        headers: { 'x-telegram-id': String(telegramId) }
      })
        .then(r => r.json()).then(setCategories).catch(() => {})
    }
  }, [showCats, seller.id, telegramId])

  const loadMessages = () => {
    if (!adminId) return
    fetch(`/api/admin/messages/${seller.id}/${adminId}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(setMessages)
      .catch(() => {})
  }

  const handleBlock = async () => {
    setBlocking(true)
    await fetch(`/api/admin/sellers/${seller.id}/block?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({ blocked: !seller.is_blocked })
    })
    seller.is_blocked = seller.is_blocked ? 0 : 1
    setBlocking(false)
    onUpdated && onUpdated()
  }

  const handleConfirmDeposit = async (paymentId, defaultAmount) => {
    setConfirmingId(paymentId)
    const amountVal = customAmounts[paymentId] !== undefined ? customAmounts[paymentId] : defaultAmount
    try {
      const res = await fetch(`/api/admin/sellers/deposits/${paymentId}/confirm?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ amount: amountVal })
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Xatolik yuz berdi')
      } else {
        alert('✅ Depozit tasdiqlandi va sotuvchi balansiga qo\'shildi!')
        onUpdated && onUpdated()
      }
    } catch {
      alert('Xatolik yuz berdi')
    } finally {
      setConfirmingId(null)
    }
  }

  const handleRejectDeposit = async (paymentId) => {
    if (!confirm('Haqiqatan ham ushbu depozit chekini rad etasizmi?')) return
    setConfirmingId(paymentId)
    const res = await fetch(`/api/admin/sellers/deposits/${paymentId}/reject?tid=${telegramId}`, {
      method: 'POST',
      headers: { 'x-telegram-id': String(telegramId) }
    })
    if (res.ok) {
      onUpdated && onUpdated()
    }
    setConfirmingId(null)
  }

  const sendMsg = async () => {
    if (!msgText.trim()) return
    await fetch(`/api/admin/messages/send?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({ from_user_id: adminId || 1, to_user_id: seller.id, text: msgText })
    })
    setMsgText('')
    loadMessages()
  }

  const deposits = seller.deposits || []
  const requiredDeposit = seller.required_deposit || Math.max(0, 300000 - (Number(seller.seller_balance) || 0))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-orange-500 flex-shrink-0">
              {seller.photo_url
                ? <img src={seller.photo_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-2xl">🏪</span>
              }
            </div>
            <div>
              <h3 className="text-white font-bold text-base">{seller.first_name} {seller.last_name}</h3>
              <p className="text-gray-400 text-xs">@{seller.username || 'username_yoq'} • ID: {seller.telegram_id}</p>
              {seller.point_name && <p className="text-orange-400 text-xs font-bold mt-0.5">🏪 {seller.point_name}</p>}
              <p className="text-gray-300 text-xs font-mono mt-0.5">📞 {seller.phone || 'Tel kiritilmagan'}</p>
              {seller.address && <p className="text-gray-400 text-[11px] truncate mt-0.5">📍 {seller.address}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl">✕</button>
        </div>

        {/* Block */}
        <button onClick={handleBlock} disabled={blocking}
          className={seller.is_blocked ? 'btn-success w-full text-xs font-bold py-2.5' : 'btn-danger w-full text-xs font-bold py-2.5'}>
          {seller.is_blocked ? '🔓 Blokni ochish' : '🚫 Sotuvchini bloklash'}
        </button>

        {/* Stats & Seller Deposit Balance */}
        <div className="grid grid-cols-3 gap-2">
          <div className="stat-card">
            <p className="text-gray-400 text-[10px]">Faol Balansi</p>
            <p className={`font-bold text-xs ${(seller.seller_balance || 0) > 0 ? 'text-amber-400' : 'text-red-400'}`}>
              {(seller.seller_balance || 0).toLocaleString()} so'm
            </p>
          </div>
          <div className="stat-card">
            <p className="text-gray-400 text-[10px]">Sof Daromad</p>
            <p className="text-green-400 font-bold text-xs">{(seller.total_earned || 0).toLocaleString()} so'm</p>
          </div>
          <div className="stat-card">
            <p className="text-gray-400 text-[10px]">Zakazlar soni</p>
            <p className="text-orange-400 font-bold text-xs">{seller.orders_count || seller.total_orders || 0} ta</p>
          </div>
        </div>

        {/* Adminga tashlashi kerak bo'lgan summa */}
        <div className="card bg-gradient-to-r from-orange-950/60 via-amber-950/40 to-gray-900 border border-orange-500/50 p-3.5 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-xs text-orange-200 font-bold flex items-center gap-1.5">
              <span>💰</span> Joriy hisoblangan depozit kamomadi:
            </span>
            <span className="font-mono text-sm font-extrabold text-orange-400">
              {requiredDeposit > 0 ? `${requiredDeposit.toLocaleString()} so'm` : '✅ Yetarli'}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            Sotuvchi har bir zakaz uchun belgilangan komissiya (Admin + Kuryer) to'lashi shart.
          </p>
        </div>

        {/* 🔒 Admin tomonidan sotuvchiga belgilangan to'lov summasi */}
        <div className="card bg-gray-900 border-2 border-amber-500/60 p-3.5 space-y-2.5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">🔒</span>
              <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                Sotuvchiga to'lov summasini belgilash
              </h4>
            </div>
            <span className="text-[11px] font-mono font-bold text-white bg-black/50 px-2.5 py-0.5 rounded-lg border border-amber-500/40">
              {Number(seller.required_deposit_amount !== undefined ? seller.required_deposit_amount : 300000).toLocaleString()} so'm
            </span>
          </div>
          <p className="text-[11px] text-gray-300 leading-relaxed">
            Sotuvchi faqat <b>siz kiritgan</b> summani to'lay oladi (boshqa ixtiyoriy summa kiritish bloklangan).
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="number"
                className="input text-xs font-bold py-2 pr-12 font-mono text-amber-300 bg-gray-950 border-gray-600 focus:border-amber-400"
                value={assignedAmountInput}
                onChange={e => setAssignedAmountInput(e.target.value)}
                placeholder="Masalan: 300000"
              />
              <span className="absolute right-3 top-2 text-[10px] text-gray-400 font-bold">so'm</span>
            </div>
            <button
              onClick={handleSaveAssignedAmount}
              disabled={savingAssignedAmount}
              className="bg-amber-500 hover:bg-amber-600 text-gray-950 text-xs py-2 px-3.5 whitespace-nowrap font-extrabold rounded-xl shadow flex items-center gap-1 transition-all"
            >
              {savingAssignedAmount ? '⏳...' : '💾 Summani saqlash'}
            </button>
          </div>
          {/* Tezkor summalar tanlash */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-gray-400">Tezkor tanlash:</span>
            {[100000, 200000, 300000, 500000, 1000000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setAssignedAmountInput(String(val))}
                className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white px-2 py-0.5 rounded border border-gray-700 font-semibold transition-colors"
              >
                {val >= 1000000 ? `${val / 1000000} mln` : `${val / 1000}k`}
              </button>
            ))}
          </div>
          {amountSavedMsg && (
            <p className="text-xs text-emerald-300 bg-emerald-950/60 border border-emerald-700 p-2 rounded-xl text-center font-bold">
              {amountSavedMsg}
            </p>
          )}
        </div>

        {/* Card info */}
        <div className="card bg-gray-900 border border-gray-700 p-3 flex justify-between items-center text-xs">
          <div>
            <p className="text-gray-400 text-[10px]">Sotuvchi to'lov kartasi:</p>
            <p className="text-white font-mono font-bold">{seller.card_number || 'Kiritilmagan'}</p>
            {seller.card_holder && <p className="text-orange-300 text-[11px] font-semibold">{seller.card_holder}</p>}
          </div>
          <span className="text-xs text-gray-400">Mijozlar to'laydigan karta</span>
        </div>

        {/* Deposit Receipts Verification Section */}
        <div className="card bg-gray-900/90 border border-orange-500/30 p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-orange-400 uppercase tracking-wider">🧾 Depozit cheklari (Adminga to'lovlar)</h4>
            <span className="text-[11px] text-gray-400">{deposits.length} ta chek</span>
          </div>

          {deposits.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">Sotuvchi hali depozit cheki yubormagan</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {deposits.map(dep => (
                <div key={dep.id} className="bg-gray-800 rounded-xl p-2.5 border border-gray-700 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div>
                      <p className="text-white font-bold font-mono text-sm">+{Number(dep.amount || 0).toLocaleString()} so'm</p>
                      <p className="text-[10px] text-gray-400">{new Date(dep.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {dep.receipt_url && (
                        <a
                          href={dep.receipt_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs bg-gray-700 hover:bg-gray-600 text-orange-400 px-2.5 py-1 rounded-lg font-bold"
                        >
                          📄 Chekni ko'rish
                        </a>
                      )}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        dep.status === 'confirmed' ? 'bg-green-900/70 text-green-400 border border-green-700' :
                        dep.status === 'rejected' ? 'bg-red-900/70 text-red-400 border border-red-700' :
                        'bg-yellow-900/70 text-yellow-300 border border-yellow-700'
                      }`}>
                        {dep.status === 'confirmed' ? '✅ Tasdiqlangan' : dep.status === 'rejected' ? '❌ Rad etilgan' : '⏳ Kutilmoqda'}
                      </span>
                    </div>
                  </div>

                  {dep.status === 'pending' && (
                    <div className="pt-2 border-t border-gray-700/80 space-y-2">
                      <div className="flex items-center gap-2">
                        <label className="text-[11px] text-gray-400 whitespace-nowrap">Tasdiqlanadigan summa:</label>
                        <input
                          type="number"
                          className="input text-xs py-1 px-2 font-mono font-bold text-green-400"
                          defaultValue={dep.amount}
                          onChange={e => setCustomAmounts({ ...customAmounts, [dep.id]: Number(e.target.value) })}
                          placeholder={dep.amount}
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleConfirmDeposit(dep.id, dep.amount)}
                          disabled={confirmingId === dep.id}
                          className="flex-1 bg-green-600 hover:bg-green-500 text-white rounded-lg py-1.5 text-xs font-bold transition-colors"
                        >
                          {confirmingId === dep.id ? '⏳...' : '✅ Qabul qilish va Balansga qo\'shish'}
                        </button>
                        <button
                          onClick={() => handleRejectDeposit(dep.id)}
                          disabled={confirmingId === dep.id}
                          className="bg-red-600/30 hover:bg-red-600/50 text-red-300 border border-red-500/40 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
                        >
                          ❌ Rad etish
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Taomlar va Menyuni ko'rish */}
        <button
          onClick={() => setShowCats(!showCats)}
          className="btn-secondary w-full text-xs font-bold py-2.5 flex items-center justify-center gap-2"
        >
          <span>🍕</span>
          <span>Sotuvchining taomlari va menyusi {showCats ? '▲' : '▼'}</span>
        </button>

        {showCats && (
          <div className="card bg-gray-900 p-3 space-y-2">
            {categories.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-2">Kategoriyalar yoki mahsulotlar topilmadi</p>
            ) : (
              categories.map(c => (
                <div key={c.id} className="bg-gray-800 rounded-xl p-2.5 border border-gray-700 space-y-1.5">
                  <p className="text-white text-xs font-bold">📂 {c.name}</p>
                  <div className="space-y-1">
                    {(c.products || []).map(p => (
                      <div key={p.id} className="flex justify-between items-center text-[11px] text-gray-300 pl-2 border-l-2 border-orange-500">
                        <span>{p.name} {p.weight ? `(${p.weight})` : ''}</span>
                        <span className="font-mono text-orange-300 font-bold">{Number(p.price || 0).toLocaleString()} so'm</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Message */}
        <div>
          <button
            onClick={() => { setShowMsg(!showMsg); if (!showMsg) loadMessages(); }}
            className="btn-secondary w-full text-xs font-bold py-2.5"
          >
            💬 Xabar yozish {showMsg ? '▲' : '▼'}
          </button>
          {showMsg && (
            <div className="mt-2 space-y-2">
              <div className="bg-gray-800 rounded-xl p-3 max-h-40 overflow-y-auto space-y-2">
                {messages.length === 0 && <p className="text-gray-500 text-xs text-center">Xabarlar yo'q</p>}
                {messages.map(m => (
                  <div key={m.id} className={`text-xs p-2 rounded-lg ${m.from_user_id === Number(adminId) ? 'bg-orange-500/20 text-right' : 'bg-gray-700'}`}>
                    <p className="text-white">{m.text}</p>
                    <p className="text-gray-500 text-[10px]">{new Date(m.created_at).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  className="input flex-1 text-xs"
                  value={msgText}
                  onChange={e => setMsgText(e.target.value)}
                  placeholder="Sotuvchiga xabar..."
                  onKeyDown={e => e.key === 'Enter' && sendMsg()}
                />
                <button onClick={sendMsg} className="btn-primary px-4 text-xs font-bold">➤</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function AdminSellers({ telegramId }) {
  const [sellers, setSellers] = useState([])
  const [selected, setSelected] = useState(null)
  const [adminId, setAdminId] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadSellers = () => {
    fetch(`/api/admin/sellers?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setSellers(list)
        if (selected) {
          const updated = list.find(s => s.id === selected.id)
          if (updated) setSelected(updated)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetch(`/api/admin/profile/${telegramId}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(d => { if (d?.id) setAdminId(d.id) })
      .catch(() => {})

    loadSellers()
  }, [telegramId])

  const openSeller = async (s) => {
    try {
      const res = await fetch(`/api/admin/sellers/${s.id}?tid=${telegramId}`, {
        headers: { 'x-telegram-id': String(telegramId) }
      })
      const data = await res.json()
      setSelected(data)
    } catch {
      setSelected(s)
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Sotuvchilar yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">🏪 Sotuvchilar ro'yxati ({sellers.length})</h2>
          <p className="text-[11px] text-gray-400">Do'konlar, depozitlar va tovarlar hisoboti</p>
        </div>
        <button onClick={loadSellers} className="text-xs text-orange-400 hover:underline flex items-center gap-1 font-semibold">
          🔄 Yangilash
        </button>
      </div>

      {sellers.length === 0 && (
        <div className="card text-center text-gray-400 py-10 space-y-2">
          <p className="text-4xl">🏪</p>
          <p className="font-semibold text-white">Hozircha sotuvchilar yo'q</p>
        </div>
      )}

      <div className="space-y-2.5">
        {sellers.map(seller => {
          const reqDep = seller.required_deposit || Math.max(0, 300000 - (Number(seller.seller_balance) || 0))
          return (
            <div
              key={seller.id}
              className="card flex items-start gap-3.5 cursor-pointer hover:bg-gray-700/80 transition-all border border-gray-700/80 shadow"
              onClick={() => openSeller(seller)}
            >
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-orange-500 mt-0.5">
                {seller.photo_url ? (
                  <img src={seller.photo_url} className="w-full h-full object-cover" alt="" />
                ) : (
                  <span className="text-2xl">🏪</span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    <p className="text-white font-bold text-sm truncate">
                      {seller.point_name || `${seller.first_name || 'Sotuvchi'} do'koni`}
                    </p>
                    {seller.pending_deposits_count > 0 && (
                      <span className="bg-amber-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse flex-shrink-0">
                        +{seller.pending_deposits_count} ta yangi chek!
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${
                    seller.is_blocked ? 'bg-red-950 text-red-400 border border-red-800' : 'bg-green-950 text-green-400 border border-green-800'
                  }`}>
                    {seller.is_blocked ? 'Bloklangan' : 'Faol'}
                  </span>
                </div>

                <p className="text-gray-400 text-xs">
                  Mas'ul: {seller.first_name} {seller.last_name || ''} (@{seller.username || 'username_yoq'}) • <span className="font-mono">ID: {seller.telegram_id}</span>
                </p>

                {seller.phone && (
                  <p className="text-gray-300 text-xs font-mono mt-0.5">
                    📞 {seller.phone}
                  </p>
                )}

                {seller.address && (
                  <p className="text-orange-400/90 text-xs truncate mt-0.5">
                    📍 {seller.address}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] pt-1.5 border-t border-gray-700/60">
                  <span className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                    (Number(seller.seller_balance) || 0) > 0 ? 'bg-amber-950 text-amber-300' : 'bg-red-950 text-red-300'
                  }`}>
                    💰 Depozit: {(seller.seller_balance || 0).toLocaleString()} so'm
                  </span>

                  {reqDep > 0 ? (
                    <span className="bg-orange-950/80 text-orange-300 border border-orange-700/60 font-semibold px-2 py-0.5 rounded-md">
                      ⚠️ Kamomad: {reqDep.toLocaleString()} so'm
                    </span>
                  ) : (
                    <span className="bg-green-950 text-green-300 px-2 py-0.5 rounded-md">
                      ✅ Balans yetarli
                    </span>
                  )}

                  <span className="bg-amber-950/60 border border-amber-600/40 text-amber-300 font-mono font-bold px-2 py-0.5 rounded-md">
                    🔒 Belgilangan: {Number(seller.required_deposit_amount !== undefined ? seller.required_deposit_amount : 300000).toLocaleString()} so'm
                  </span>

                  <span className="text-gray-300 bg-gray-900 px-2 py-0.5 rounded-md">
                    🍕 {seller.products_count || 0} ta taom
                  </span>

                  <span className="text-green-400 font-mono font-bold bg-gray-900 px-2 py-0.5 rounded-md">
                    💸 Savdo: {(seller.total_sales || 0).toLocaleString()} so'm
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <SellerModal
          seller={selected}
          adminId={adminId}
          telegramId={telegramId}
          onClose={() => setSelected(null)}
          onUpdated={loadSellers}
        />
      )}
    </div>
  )
}
