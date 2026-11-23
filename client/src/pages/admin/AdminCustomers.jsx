import { useState, useEffect } from 'react'

const GIFTS = [
  { emoji: '🐻', name: 'Ayiqcha' },
  { emoji: '🌸', name: 'Atirgul' },
  { emoji: '⭐', name: 'Yulduz' },
  { emoji: '💎', name: 'Olmos' },
  { emoji: '🎁', name: 'Sovg\'a' },
  { emoji: '🌈', name: 'Kamalak' },
  { emoji: '🦋', name: 'Kapalak' },
  { emoji: '🎀', name: 'Bantik' },
  { emoji: '🍀', name: 'Omad bargi' },
  { emoji: '🌟', name: 'Oltin yulduz' },
  { emoji: '🎉', name: 'Bayram' },
  { emoji: '💐', name: 'Guldasta' }
]

function CustomerModal({ customer, adminId, telegramId, onClose, onUpdated }) {
  const [blocking, setBlocking] = useState(false)
  const [showGifts, setShowGifts] = useState(false)
  const [giftSent, setGiftSent] = useState(null)
  const [msgText, setMsgText] = useState('')
  const [showMsg, setShowMsg] = useState(false)
  const [messages, setMessages] = useState([])

  const loadMessages = () => {
    fetch(`/api/admin/messages/${customer.id}/${adminId || 1}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json()).then(setMessages).catch(() => {})
  }

  const handleBlock = async () => {
    setBlocking(true)
    await fetch(`/api/admin/customers/${customer.id}/block?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({ blocked: !customer.is_blocked })
    })
    customer.is_blocked = customer.is_blocked ? 0 : 1
    setBlocking(false)
    onUpdated && onUpdated()
  }

  const sendGift = async (gift) => {
    await fetch(`/api/admin/customers/${customer.id}/gift?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({ gift_emoji: gift.emoji, gift_name: gift.name, from_user_id: adminId || 1 })
    })
    setGiftSent(gift)
    customer.gifts = [{ gift_emoji: gift.emoji, gift_name: gift.name }, ...(customer.gifts || [])]
    setShowGifts(false)
    onUpdated && onUpdated()
    setTimeout(() => setGiftSent(null), 3000)
  }

  const sendMsg = async () => {
    if (!msgText.trim()) return
    await fetch(`/api/admin/messages/send?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({ from_user_id: adminId || 1, to_user_id: customer.id, text: msgText })
    })
    setMsgText('')
    loadMessages()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-orange-500 flex-shrink-0">
              {customer.photo_url
                ? <img src={customer.photo_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-2xl">👤</span>}
            </div>
            <div>
              <h3 className="text-white font-bold text-base">{customer.first_name} {customer.last_name}</h3>
              <p className="text-gray-400 text-xs">@{customer.username || 'username_yoq'} • ID: {customer.telegram_id}</p>
              <p className="text-gray-300 text-xs font-mono mt-0.5">📞 {customer.phone || 'Tel kiritilmagan'}</p>
              <p className="text-orange-400 text-xs mt-0.5">📍 {customer.address || 'Manzil kiritilmagan'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl">✕</button>
        </div>

        {/* Block */}
        <button onClick={handleBlock} disabled={blocking}
          className={customer.is_blocked ? 'btn-success w-full text-xs font-bold py-2.5' : 'btn-danger w-full text-xs font-bold py-2.5'}>
          {customer.is_blocked ? '🔓 Blokni ochish' : '🚫 Mijozni bloklash'}
        </button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="stat-card">
            <p className="text-gray-400 text-xs">Jami xaridlar</p>
            <p className="text-orange-400 font-bold text-lg">{customer.total_orders || 0} ta</p>
          </div>
          <div className="stat-card">
            <p className="text-gray-400 text-xs">Jami xarajat</p>
            <p className="text-green-400 font-bold text-lg">{(customer.total_spent || 0).toLocaleString()} so'm</p>
          </div>
        </div>

        {/* Buyurtmalar tarixi */}
        <div className="card bg-gray-900/90 p-3.5 space-y-2 border border-gray-700/80">
          <div className="flex justify-between items-center">
            <p className="text-gray-300 text-xs font-bold flex items-center gap-1">
              <span>🛍️</span> Xaridlar tarixi ({customer.orders?.length || 0})
            </p>
            <span className="text-xs text-green-400 font-mono font-bold">{(customer.total_spent || 0).toLocaleString()} so'm</span>
          </div>

          {(!customer.orders || customer.orders.length === 0) ? (
            <p className="text-xs text-gray-500 text-center py-2">Hali birorta buyurtma bermagan</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {customer.orders.map(o => (
                <div key={o.id} className="bg-gray-800 rounded-xl p-2.5 border border-gray-700 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-white">#{o.id} • {o.product_name}</span>
                      <p className="text-[10px] text-gray-400">🏪 {o.seller_point || o.seller_name || 'Restoran'}</p>
                    </div>
                    <span className="font-mono font-bold text-orange-300 whitespace-nowrap">{(o.total_price || 0).toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-gray-700/60 text-[10px]">
                    <span className={o.payment_method === 'cash' ? 'text-green-400 font-bold' : 'text-blue-400 font-bold'}>
                      {o.payment_method === 'cash' ? '💵 Naqd pul' : '💳 Karta'}
                    </span>
                    <span className="text-gray-400">
                      {o.status === 'delivered' ? '✅ Yetkazilgan' : o.status === 'delivering' ? '🚴 Yo\'lda' : o.status === 'cancelled' ? '❌ Bekor qilingan' : o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Received gifts */}
        {customer.gifts?.length > 0 && (
          <div className="card bg-gray-900 p-3">
            <p className="text-gray-400 text-xs mb-2">🎁 Mijozning sovg'alar qutisi:</p>
            <div className="flex flex-wrap gap-2">
              {customer.gifts.map((g, i) => (
                <span key={i} className="bg-gray-800 px-2.5 py-1 rounded-xl text-sm flex items-center gap-1 border border-pink-500/30" title={g.gift_name}>
                  <span>{g.gift_emoji}</span>
                  <span className="text-[10px] text-pink-300">{g.gift_name}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Complaints & Suggestions */}
        <div className="card bg-gray-900 p-3 space-y-2">
          <p className="text-gray-300 text-xs font-semibold">✍️ Shikoyat va Takliflari ({customer.complaints?.length || 0}):</p>
          {(!customer.complaints || customer.complaints.length === 0) ? (
            <p className="text-xs text-gray-500 text-center py-2">Mijoz hali shikoyat yoki taklif yozmagan</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {customer.complaints.map(c => (
                <div key={c.id} className="bg-gray-800 rounded-xl p-2.5 border border-gray-700">
                  <div className="flex justify-between items-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${c.type === 'complaint' ? 'bg-red-900/60 text-red-400' : 'bg-green-900/60 text-green-400'}`}>
                      {c.type === 'complaint' ? '⚠️ Shikoyat' : '💡 Taklif'}
                    </span>
                    <span className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-white text-xs mt-1.5">{c.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gift button */}
        <button onClick={() => setShowGifts(!showGifts)} className="btn-primary w-full text-xs font-bold py-2.5">
          🎁 Telegram virtual sovg'a yuborish {showGifts ? '▲' : '▼'}
        </button>

        {giftSent && (
          <div className="text-center py-3 bg-pink-900/40 border border-pink-700 rounded-xl animate-pulse">
            <p className="text-4xl mb-1">{giftSent.emoji}</p>
            <p className="text-pink-300 text-xs font-bold">{giftSent.name} mijozning sovg'alar qutisiga yuborildi!</p>
          </div>
        )}

        {showGifts && (
          <div className="card bg-gray-900 p-3 space-y-2">
            <p className="text-gray-400 text-xs">Yubormoqchi bo'lgan sovg'angizni tanlang:</p>
            <div className="grid grid-cols-4 gap-2">
              {GIFTS.map((g, i) => (
                <button
                  key={i}
                  onClick={() => sendGift(g)}
                  className="bg-gray-800 hover:bg-pink-950 p-2 rounded-xl text-center border border-gray-700 hover:border-pink-500 transition-all flex flex-col items-center gap-1"
                >
                  <span className="text-2xl">{g.emoji}</span>
                  <span className="text-[10px] text-gray-300 truncate w-full">{g.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message */}
        <button onClick={() => { setShowMsg(!showMsg); if (!showMsg) loadMessages(); }}
          className="btn-secondary w-full text-xs font-bold py-2.5">
          💬 Xabar yozish {showMsg ? '▲' : '▼'}
        </button>

        {showMsg && (
          <div className="space-y-2">
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
              <input className="input flex-1 text-xs" value={msgText} onChange={e => setMsgText(e.target.value)}
                placeholder="Mijozga xabar..." onKeyDown={e => e.key === 'Enter' && sendMsg()} />
              <button onClick={sendMsg} className="btn-primary px-4 text-xs font-bold">➤</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminCustomers({ telegramId }) {
  const [customers, setCustomers] = useState([])
  const [selected, setSelected] = useState(null)
  const [adminId, setAdminId] = useState(1)
  const [loading, setLoading] = useState(true)

  const loadCustomers = () => {
    fetch(`/api/admin/customers?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(data => {
        setCustomers(Array.isArray(data) ? data : [])
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

    loadCustomers()
  }, [telegramId])

  const openCustomer = async (c) => {
    try {
      const res = await fetch(`/api/admin/customers/${c.id}?tid=${telegramId}`, {
        headers: { 'x-telegram-id': String(telegramId) }
      })
      const data = await res.json()
      setSelected(data)
    } catch {
      setSelected(c)
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Mijozlar yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">👥 Mijozlar ro'yxati ({customers.length})</h2>
          <p className="text-[11px] text-gray-400">Tizimdan foydalangan barcha xaridorlar</p>
        </div>
        <button onClick={loadCustomers} className="text-xs text-orange-400 hover:underline flex items-center gap-1 font-semibold">
          🔄 Yangilash
        </button>
      </div>

      {customers.length === 0 && (
        <div className="card text-center text-gray-400 py-10 space-y-2">
          <p className="text-4xl">👥</p>
          <p className="font-semibold text-white">Hozircha mijozlar ro'yxati bo'sh</p>
        </div>
      )}

      <div className="space-y-2.5">
        {customers.map(customer => (
          <div
            key={customer.id}
            className="card flex items-start gap-3.5 cursor-pointer hover:bg-gray-700/80 transition-all border border-gray-700/80 shadow"
            onClick={() => openCustomer(customer)}
          >
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-orange-500 mt-0.5">
              {customer.photo_url ? (
                <img src={customer.photo_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-2xl">👤</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-white font-bold text-sm truncate">
                  {customer.first_name || 'Mijoz'} {customer.last_name || ''}
                </p>
                {customer.is_blocked ? (
                  <span className="text-[10px] bg-red-950 text-red-400 border border-red-800 px-2 py-0.5 rounded-full font-bold">
                    Bloklangan
                  </span>
                ) : (
                  <span className="text-[10px] bg-green-950 text-green-400 border border-green-800 px-2 py-0.5 rounded-full font-bold">
                    Faol
                  </span>
                )}
              </div>

              <p className="text-gray-400 text-xs">
                @{customer.username || 'username_yoq'} • <span className="font-mono text-gray-400">ID: {customer.telegram_id}</span>
              </p>

              {customer.phone && (
                <p className="text-gray-300 text-xs font-mono mt-0.5">
                  📞 {customer.phone}
                </p>
              )}

              {customer.address && (
                <p className="text-orange-400/90 text-xs truncate mt-0.5">
                  📍 {customer.address}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] pt-1.5 border-t border-gray-700/60">
                <span className="text-orange-300 font-semibold bg-gray-900 px-2 py-0.5 rounded-md">
                  🛍️ {customer.total_orders || 0} ta xarid
                </span>
                <span className="text-green-400 font-mono font-bold bg-gray-900 px-2 py-0.5 rounded-md">
                  💰 {(customer.total_spent || 0).toLocaleString()} so'm
                </span>
                {customer.complaints_count > 0 && (
                  <span className="bg-red-900/60 text-red-300 px-2 py-0.5 rounded-md">
                    💬 {customer.complaints_count} ta murojaat
                  </span>
                )}
                {customer.gifts_count > 0 && (
                  <span className="bg-pink-900/60 text-pink-300 px-2 py-0.5 rounded-md">
                    🎁 {customer.gifts_count} ta sovg'a
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <CustomerModal
          customer={selected}
          adminId={adminId}
          telegramId={telegramId}
          onClose={() => setSelected(null)}
          onUpdated={loadCustomers}
        />
      )}
    </div>
  )
}
