import { useState, useEffect, useRef } from 'react'

function CourierModal({ courier, adminId, telegramId, onClose, onUpdated }) {
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [msgText, setMsgText] = useState('')
  const [showMsg, setShowMsg] = useState(false)
  const [messages, setMessages] = useState([])
  const receiptRef = useRef()

  const loadMessages = () => {
    fetch(`/api/admin/messages/${courier.id}/${adminId}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json()).then(setMessages).catch(() => {})
  }

  const handlePay = async () => {
    const file = receiptRef.current?.files[0]
    if (!file) return alert('Avval chekni yuklang!')
    setPaying(true)
    const fd = new FormData()
    fd.append('receipt', file)
    fd.append('admin_id', adminId)
    await fetch(`/api/admin/couriers/${courier.id}/pay?tid=${telegramId}`, {
      method: 'POST',
      headers: { 'x-telegram-id': String(telegramId) },
      body: fd
    })
    courier.unpaid_amount = 0
    setPaid(true)
    setPaying(false)
    onUpdated && onUpdated()
  }

  const handleBlock = async () => {
    setBlocking(true)
    const isBlocked = courier.is_blocked
    await fetch(`/api/admin/couriers/${courier.id}/${isBlocked ? 'unblock' : 'block'}?tid=${telegramId}`, {
      method: 'POST',
      headers: { 'x-telegram-id': String(telegramId) }
    })
    courier.is_blocked = isBlocked ? 0 : 1
    setBlocking(false)
    onUpdated && onUpdated()
  }

  const sendMsg = async () => {
    if (!msgText.trim()) return
    await fetch(`/api/admin/messages/send?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({ from_user_id: adminId, to_user_id: courier.id, text: msgText })
    })
    setMsgText('')
    loadMessages()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden border-2 border-orange-500 flex-shrink-0">
              {courier.photo_url
                ? <img src={courier.photo_url} className="w-full h-full object-cover" alt="" />
                : <span className="text-2xl">🚴</span>
              }
            </div>
            <div>
              <h3 className="text-white font-bold text-base">{courier.first_name} {courier.last_name}</h3>
              <p className="text-gray-400 text-xs">@{courier.username || 'username_yoq'} • ID: {courier.telegram_id}</p>
              <p className="text-gray-300 text-xs font-mono mt-0.5">📞 {courier.phone || 'Tel kiritilmagan'}</p>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 ${
                courier.is_online ? 'bg-green-950 text-green-300 border border-green-700' : 'bg-gray-800 text-gray-400 border border-gray-700'
              }`}>
                {courier.is_online ? '🟢 Smenada (Onlayn)' : '⚪ Oflayn'}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 text-2xl">✕</button>
        </div>

        {/* Block button */}
        <button
          onClick={handleBlock}
          disabled={blocking}
          className={courier.is_blocked ? 'btn-success w-full text-xs font-bold py-2.5' : 'btn-danger w-full text-xs font-bold py-2.5'}
        >
          {courier.is_blocked ? '🔓 Blokni ochish' : '🚫 Kuryerni bloklash'}
        </button>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="stat-card">
            <p className="text-gray-400 text-xs">Umumiy daromadi</p>
            <p className="text-green-400 font-bold text-lg">{(courier.total_earned || 0).toLocaleString()} so'm</p>
          </div>
          <div className="stat-card">
            <p className="text-gray-400 text-xs">Yetkazgan zakazlari</p>
            <p className="text-orange-400 font-bold text-lg">{courier.delivered_orders_count || courier.total_orders || 0} ta</p>
          </div>
        </div>

        {/* Unpaid amount & Pay Courier */}
        <div className="bg-yellow-950/40 border border-yellow-700/80 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-400 text-xs font-semibold uppercase">Admin to'lashi kerak (Kuryer ulushi):</p>
              <p className="text-white font-mono font-black text-2xl mt-0.5">
                {paid ? '0' : (courier.unpaid_amount || 0).toLocaleString()} so'm
              </p>
            </div>
            {courier.card_number && (
              <span className="text-[11px] font-mono bg-black/40 px-2 py-1 rounded text-orange-300 border border-orange-500/30">
                💳 {courier.card_number}
              </span>
            )}
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-gray-300 text-xs font-semibold block">To'lov chekini yuklash (Skrinshot):</label>
            <input type="file" ref={receiptRef} className="input text-xs" accept="image/*,.pdf" />
          </div>

          <button
            onClick={handlePay}
            disabled={paying || paid || (Number(courier.unpaid_amount) || 0) <= 0}
            className={`btn-success w-full text-xs font-bold py-3 flex items-center justify-center gap-2 ${
              (Number(courier.unpaid_amount) || 0) <= 0 && !paid ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {paying ? '⏳ To\'lov yuborilmoqda...' : paid ? '✅ To\'landi!' : '💸 Kuryerga to\'lash va hisobni 0 qilish'}
          </button>
        </div>

        {/* Kuryer buyurtmalari tarixi */}
        {courier.orders && courier.orders.length > 0 && (
          <div className="card bg-gray-900/90 p-3.5 space-y-2 border border-gray-700/80">
            <p className="text-gray-300 text-xs font-bold flex items-center gap-1">
              <span>🛵</span> Biriktirilgan buyurtmalar ({courier.orders.length})
            </p>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {courier.orders.map(o => (
                <div key={o.id} className="bg-gray-800 rounded-xl p-2.5 border border-gray-700 text-xs space-y-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-bold text-white">#{o.id} • {o.product_name}</span>
                      <p className="text-[10px] text-gray-400">🏪 {o.seller_point || o.seller_name || 'Punkt'}</p>
                    </div>
                    <span className="font-mono font-bold text-orange-300">{(o.total_price || 0).toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-gray-700/60 text-[10px]">
                    <span className={o.payment_method === 'cash' ? 'text-green-400 font-bold' : 'text-blue-400 font-bold'}>
                      {o.payment_method === 'cash' ? '💵 Naqd olingan' : '💳 Karta'}
                    </span>
                    <span className="text-gray-400">
                      {o.status === 'delivered' ? '✅ Yetkazilgan' : o.status === 'delivering' ? '🚴 Yo\'lda' : o.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Message */}
        <div>
          <button
            onClick={() => { setShowMsg(!showMsg); if (!showMsg) loadMessages() }}
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
                  placeholder="Xabar yozing..."
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

export default function AdminCouriers({ telegramId }) {
  const [couriers, setCouriers] = useState([])
  const [selected, setSelected] = useState(null)
  const [adminId, setAdminId] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadCouriers = () => {
    fetch(`/api/admin/couriers?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(data => {
        setCouriers(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetch(`/api/admin/profile/${telegramId}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(d => setAdminId(d.id))
      .catch(() => {})

    loadCouriers()
  }, [telegramId])

  const openCourier = async (c) => {
    try {
      const res = await fetch(`/api/admin/couriers/${c.id}?tid=${telegramId}`, {
        headers: { 'x-telegram-id': String(telegramId) }
      })
      const data = await res.json()
      setSelected(data)
    } catch {
      setSelected(c)
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Kuryerlar yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">🚴 Kuryerlar ro'yxati ({couriers.length})</h2>
          <p className="text-[11px] text-gray-400">Yetkazib beruvchilar va ularning hisob-kitoblari</p>
        </div>
        <button onClick={loadCouriers} className="text-xs text-orange-400 hover:underline flex items-center gap-1 font-semibold">
          🔄 Yangilash
        </button>
      </div>

      {couriers.length === 0 && (
        <div className="card text-center text-gray-400 py-10 space-y-2">
          <p className="text-4xl">🚴</p>
          <p className="font-semibold text-white">Hozircha kuryerlar ro'yxati bo'sh</p>
        </div>
      )}

      <div className="space-y-2.5">
        {couriers.map(courier => (
          <div
            key={courier.id}
            className="card flex items-start gap-3.5 cursor-pointer hover:bg-gray-700/80 transition-all border border-gray-700/80 shadow"
            onClick={() => openCourier(courier)}
          >
            <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center overflow-hidden flex-shrink-0 border-2 border-orange-500 mt-0.5">
              {courier.photo_url ? (
                <img src={courier.photo_url} className="w-full h-full object-cover" alt="" />
              ) : (
                <span className="text-2xl">🚴</span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-white font-bold text-sm truncate">
                  {courier.first_name || 'Kuryer'} {courier.last_name || ''}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  courier.is_online ? 'bg-green-950 text-green-400 border border-green-800' : 'bg-gray-800 text-gray-400 border border-gray-700'
                }`}>
                  {courier.is_online ? '🟢 Smenada' : '⚪ Oflayn'}
                </span>
              </div>

              <p className="text-gray-400 text-xs">
                @{courier.username || 'username_yoq'} • <span className="font-mono text-gray-400">ID: {courier.telegram_id}</span>
              </p>

              {courier.phone && (
                <p className="text-gray-300 text-xs font-mono mt-0.5">
                  📞 {courier.phone}
                </p>
              )}

              {courier.card_number && (
                <p className="text-orange-300 font-mono text-xs mt-0.5">
                  💳 {courier.card_number}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] pt-1.5 border-t border-gray-700/60">
                <span className="text-orange-300 font-semibold bg-gray-900 px-2 py-0.5 rounded-md">
                  📦 {courier.delivered_orders_count || courier.total_orders || 0} ta yetkazilgan
                </span>
                <span className="text-yellow-400 font-mono font-bold bg-gray-900 px-2 py-0.5 rounded-md">
                  💸 To'lanishi kerak: {(courier.unpaid_amount || 0).toLocaleString()} so'm
                </span>
                {Number(courier.total_cash_collected || 0) > 0 && (
                  <span className="text-amber-300 font-mono font-bold bg-gray-900 px-2 py-0.5 rounded-md">
                    💵 Naqd pul: {Number(courier.total_cash_collected).toLocaleString()} so'm
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <CourierModal
          courier={selected}
          adminId={adminId}
          telegramId={telegramId}
          onClose={() => setSelected(null)}
          onUpdated={loadCouriers}
        />
      )}
    </div>
  )
}
