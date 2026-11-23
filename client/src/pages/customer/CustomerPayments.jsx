import { useState, useEffect, useRef } from 'react'

export default function CustomerPayments({ telegramId, initialOrderId, onPaid }) {
  const [orders, setOrders] = useState([])
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId || '')
  const [payTab, setPayTab] = useState(initialOrderId ? 'card' : 'cash')
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [previewUrl, setPreviewUrl] = useState(null)
  const [copiedCard, setCopiedCard] = useState(false)
  const receiptRef = useRef()

  const loadOrders = () => {
    fetch(`/api/customer/orders/${telegramId}?tid=${telegramId}`, {
      headers: {
        'x-telegram-id': String(telegramId)
      }
    })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setOrders(list)
        if (initialOrderId) {
          setSelectedOrderId(initialOrderId)
          const target = list.find(o => String(o.id) === String(initialOrderId))
          if (target && target.payment_method === 'cash') {
            setPayTab('cash')
          } else {
            setPayTab('card')
          }
        } else if (list.length > 0 && !selectedOrderId) {
          setSelectedOrderId(list[0].id)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadOrders()
  }, [telegramId, initialOrderId])

  // Naqd va Karta buyurtmalarini ajratish
  const cashOrders = orders.filter(o => o.payment_method === 'cash')
  const cardOrders = orders.filter(o => o.payment_method !== 'cash')

  const activeCashOrders = cashOrders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status))
  const deliveredCashOrders = cashOrders.filter(o => o.status === 'delivered')
  const totalActiveCash = activeCashOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0)

  const pendingCardOrders = cardOrders.filter(o => o.status === 'pending' || o.status === 'paid_waiting')
  const selectedOrder = cardOrders.find(o => String(o.id) === String(selectedOrderId)) || cardOrders[0]

  const handleCopyCard = (cardNumber) => {
    if (!cardNumber) return
    const clean = cardNumber.replace(/\s+/g, '')
    navigator.clipboard.writeText(clean).then(() => {
      setCopiedCard(true)
      setTimeout(() => setCopiedCard(false), 2000)
    }).catch(() => {})
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setPreviewUrl(URL.createObjectURL(file))
      setErrorMsg('')
    } else {
      setPreviewUrl(null)
    }
  }

  const handleUploadReceipt = async () => {
    setErrorMsg('')
    setMessage('')

    if (!selectedOrder) {
      setErrorMsg('Iltimos, avval to\'lov qilinadigan buyurtmani tanlang!')
      return
    }

    const file = receiptRef.current?.files[0]
    if (!file) {
      setErrorMsg('⚠️ Iltimos, avval to\'lov cheki rasmini (skrinshotini) tanlang!')
      return
    }

    setUploading(true)
    const fd = new FormData()
    fd.append('receipt', file)
    fd.append('telegramId', telegramId)
    fd.append('order_id', selectedOrder.id)
    fd.append('amount', selectedOrder.total_price)

    try {
      const res = await fetch(`/api/customer/payments/upload-receipt?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'x-telegram-id': String(telegramId)
        },
        body: fd
      })
      const data = await res.json()
      if (res.ok) {
        setMessage(data.message || 'Chek yuborildi!')
        setPreviewUrl(null)
        if (receiptRef.current) receiptRef.current.value = ''
        loadOrders()
        setTimeout(() => {
          onPaid && onPaid()
        }, 1800)
      } else {
        setErrorMsg(data.error || 'Xatolik yuz berdi')
      }
    } catch {
      setErrorMsg('Chek yuklashda xatolik yuz berdi. Internetni tekshiring!')
    } finally {
      setUploading(false)
    }
  }

  const formatDateTime = (dateStr) => {
    if (!dateStr) return ''
    try {
      const d = new Date(dateStr)
      return d.toLocaleString('uz-UZ', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateStr
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ To'lovlar yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">💰 To'lovlar va Hisob-kitob</h2>
          <p className="text-[11px] text-gray-400">Naqd to'lanadigan summalar va karta cheklari</p>
        </div>
        <button onClick={loadOrders} className="text-xs text-orange-400 hover:underline flex items-center gap-1 font-semibold">
          🔄 Yangilash
        </button>
      </div>

      {/* 2 ta Asosiy Bo'lim: Naqd to'lovlar va Karta orqali to'lovlar */}
      <div className="flex gap-2 p-1.5 bg-gray-800/90 rounded-2xl border border-gray-700">
        <button
          type="button"
          onClick={() => setPayTab('cash')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            payTab === 'cash'
              ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white shadow-lg shadow-green-900/40 ring-1 ring-green-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span className="text-base">💵</span>
          <span>Naqd to'lovlar</span>
          {activeCashOrders.length > 0 && (
            <span className="bg-white/25 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {activeCashOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setPayTab('card')}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
            payTab === 'card'
              ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-900/40 ring-1 ring-orange-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <span className="text-base">💳</span>
          <span>Karta orqali</span>
          {pendingCardOrders.length > 0 && (
            <span className="bg-white/25 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
              {pendingCardOrders.length}
            </span>
          )}
        </button>
      </div>

      {/* ===================== 1. NAQD TO'LOVLAR BO'LIMI ===================== */}
      {payTab === 'cash' && (
        <div className="space-y-4">
          {/* Asosiy ko'rsatkich kartasi */}
          <div className="bg-gradient-to-br from-emerald-800 via-green-800 to-teal-900 rounded-2xl p-5 shadow-xl border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-emerald-200 text-xs uppercase tracking-wider font-bold flex items-center gap-1.5">
                <span>💵</span> Kuryerga berilishi kerak bo'lgan naqd pul
              </span>
              <span className="text-[11px] bg-black/30 text-emerald-300 border border-emerald-400/30 px-2.5 py-0.5 rounded-full font-semibold">
                {activeCashOrders.length} ta faol buyurtma
              </span>
            </div>

            <div className="flex items-baseline justify-between pt-1">
              <div>
                <p className="text-3xl font-extrabold text-white font-mono tracking-tight">
                  {totalActiveCash.toLocaleString()} <span className="text-lg font-normal text-emerald-200">so'm</span>
                </p>
                <p className="text-[11px] text-emerald-100/90 mt-1">
                  Kuryer taomni yetkazib berganda to'g'ridan-to'g'ri naqd shaklda to'laysiz
                </p>
              </div>
            </div>

            <div className="bg-black/25 rounded-xl p-2.5 text-xs text-emerald-100 flex items-start gap-2 border border-white/10">
              <span className="text-base">💡</span>
              <span className="text-[11px] leading-relaxed">
                Kuryer kelganda vaqtni tejash uchun yuqoridagi <b>aniq summani mayda pulda</b> tayyorlab qo'yishingizni tavsiya qilamiz!
              </span>
            </div>
          </div>

          {/* Faol naqd buyurtmalar ro'yxati */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>📋 To'lanishi kerak bo'lgan buyurtmalar</span>
              <span className="text-xs text-gray-400 font-normal">Jami: {activeCashOrders.length} ta</span>
            </h3>

            {activeCashOrders.length === 0 ? (
              <div className="card text-center text-gray-400 py-10 space-y-2 bg-gray-900/60 border border-gray-800">
                <p className="text-4xl">🛵</p>
                <p className="font-semibold text-white text-sm">Hozircha naqd to'lanadigan faol buyurtmangiz yo'q</p>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  Taomnoma bo'limidan buyurtma berishda to'lov turi sifatida "💵 Naqd pul" ni tanlasangiz, buyurtma bu yerda paydo bo'ladi.
                </p>
              </div>
            ) : (
              activeCashOrders.map(order => {
                let itemsList = []
                if (order.items && Array.isArray(order.items)) {
                  itemsList = order.items
                } else if (order.items_json) {
                  try {
                    itemsList = JSON.parse(order.items_json)
                  } catch {}
                }

                return (
                  <div
                    key={order.id}
                    className="card space-y-3 border-l-4 border-emerald-500 bg-gray-800/90 shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs text-emerald-400 font-bold">Buyurtma #{order.id}</span>
                          <span className="text-[11px] text-gray-400">• {formatDateTime(order.created_at)}</span>
                        </div>
                        <h4 className="text-sm font-bold text-white mt-0.5">
                          {order.seller_point || order.seller_name || 'Restoran'}
                        </h4>
                        <p className="text-xs text-gray-400">
                          📍 {order.delivery_address || 'Manzil kiritilmagan'}
                        </p>
                      </div>

                      <span className="text-xs px-2.5 py-1 rounded-full font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-700 whitespace-nowrap">
                        {order.status === 'delivering' ? '🚴 Yo\'lda (Yetkazilmoqda)' :
                         order.status === 'accepted' ? '📦 Kuryerga berilmoqda' :
                         order.status === 'ready' ? '🧑‍🍳 Oshxonada tayyor' :
                         '⏳ Tasdiqlanmoqda'}
                      </span>
                    </div>

                    {/* Taomlar */}
                    <div className="bg-gray-900/80 rounded-xl p-2.5 text-xs text-gray-300 space-y-1 border border-gray-700/60">
                      {itemsList.length > 0 ? (
                        itemsList.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="truncate pr-2">
                              • {item.name || item.product_name} <span className="text-emerald-400 font-bold">x{item.quantity || 1}</span>
                            </span>
                            <span className="font-mono text-gray-300 whitespace-nowrap">
                              {((item.price || 0) * (item.quantity || 1)).toLocaleString()} so'm
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="flex justify-between items-center text-[11px]">
                          <span>• {order.product_name} x{order.quantity || 1}</span>
                          <span className="font-mono text-gray-300">{(order.total_price || 0).toLocaleString()} so'm</span>
                        </div>
                      )}
                    </div>

                    {/* ANIQ TO'LANADIGAN NAQD SUMMA (KATALASHTIRILGAN BLOK) */}
                    <div className="bg-gradient-to-r from-emerald-950/70 via-gray-900 to-emerald-950/70 rounded-xl p-3 border border-emerald-500/50 flex items-center justify-between shadow">
                      <div>
                        <span className="text-[11px] text-gray-400 block font-medium">Kuryerga to'lanadigan aniq summa:</span>
                        <span className="text-xs text-emerald-300 font-bold flex items-center gap-1">
                          <span>💵</span> Naqd pul
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xl font-extrabold text-emerald-400 font-mono tracking-tight block">
                          {(order.total_price || 0).toLocaleString()} <span className="text-xs font-normal">so'm</span>
                        </span>
                      </div>
                    </div>

                    {/* Kuryer ma'lumotlari va PIN-kod */}
                    {order.courier_name && (
                      <div className="bg-gray-900/90 rounded-xl p-2.5 text-xs border border-gray-700 flex items-center justify-between">
                        <div>
                          <p className="text-gray-400 text-[10px]">Yetkazib beruvchi kuryer:</p>
                          <p className="text-white font-bold">{order.courier_name} {order.courier_lastname || ''}</p>
                        </div>
                        {order.courier_phone && (
                          <a
                            href={`tel:${order.courier_phone}`}
                            className="bg-green-600/30 text-green-300 border border-green-500/40 px-2.5 py-1 rounded-lg font-mono font-bold text-xs"
                          >
                            📞 {order.courier_phone}
                          </a>
                        )}
                      </div>
                    )}

                    {order.delivery_pin_code && ['ready', 'accepted', 'delivering'].includes(order.status) && (
                      <div className="bg-orange-500/10 border border-orange-500/40 rounded-xl p-2.5 flex items-center justify-between">
                        <span className="text-xs text-orange-200">🔑 Kuryerga aytiladigan PIN-kod:</span>
                        <span className="font-mono text-base font-extrabold text-orange-300 bg-black/40 px-2.5 py-0.5 rounded border border-orange-500/50">
                          {order.delivery_pin_code}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Avval yetkazib berilgan va naqd to'langan buyurtmalar tarixi */}
          {deliveredCashOrders.length > 0 && (
            <div className="space-y-2 pt-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                <span>🏁</span> Oldin naqd to'langan xaridlar tarixi ({deliveredCashOrders.length})
              </h4>
              <div className="space-y-1.5">
                {deliveredCashOrders.slice(0, 5).map(o => (
                  <div key={o.id} className="bg-gray-900/80 rounded-xl p-2.5 flex items-center justify-between text-xs border border-gray-800">
                    <div>
                      <span className="text-white font-bold">#{o.id} • {o.seller_point || o.seller_name || 'Do\'kon'}</span>
                      <p className="text-[10px] text-gray-400">{formatDateTime(o.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-green-400">{(o.total_price || 0).toLocaleString()} so'm</span>
                      <span className="text-[10px] text-gray-400 block">✅ Naqd to'langan</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== 2. KARTA ORQALI TO'LOVLAR BO'LIMI ===================== */}
      {payTab === 'card' && (
        <div className="space-y-4">
          {cardOrders.length === 0 ? (
            <div className="card text-center text-gray-400 py-12 space-y-2">
              <p className="text-4xl">💳</p>
              <p className="font-semibold text-white">Karta orqali to'lanadigan buyurtmalar yo'q</p>
              <p className="text-xs text-gray-500">
                Agar karta orqali buyurtma bersangiz, sotuvchi kartasi va to'lov cheki yuklash oynasi shu yerda chiqadi.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Buyurtmani tanlash */}
              <div className="card space-y-2">
                <label className="text-xs text-gray-400 block font-semibold">Buyurtmani tanlang:</label>
                <select
                  className="input text-xs font-semibold"
                  value={selectedOrder?.id || ''}
                  onChange={e => setSelectedOrderId(e.target.value)}
                >
                  {cardOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      Buyurtma #{o.id} — {o.product_name} ({(o.total_price || 0).toLocaleString()} so'm)
                      {o.status === 'paid_waiting' ? ' [⏳ Chek tekshirilmoqda]' : o.status === 'ready' ? ' [✅ Tasdiqlangan]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Sotuvchi karta rekvizitlari */}
              {selectedOrder && (
                <div className="card bg-gray-800 border border-orange-500/30 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🏪</span>
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {selectedOrder.seller_point || selectedOrder.seller_name || 'Sotuvchi'} to'lov kartasi
                      </h3>
                      <p className="text-xs text-orange-400 font-bold">
                        O'tkaziladigan summa: {(selectedOrder.total_price || 0).toLocaleString()} so'm
                      </p>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-4 border border-gray-700 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-400">Sotuvchining Karta raqami (Click / Payme / Uzum):</p>
                      <button
                        type="button"
                        onClick={() => handleCopyCard(selectedOrder.seller_card || '8600 5555 4444 3333')}
                        className="text-[11px] text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
                      >
                        {copiedCard ? '✅ Nusxalandi' : '📋 Nusxalash'}
                      </button>
                    </div>
                    <p className="text-white font-mono text-lg font-extrabold tracking-wider select-all">
                      {selectedOrder.seller_card || '8600 5555 4444 3333'}
                    </p>
                    <div className="flex justify-between items-center text-xs text-gray-300 pt-1 border-t border-gray-700/70">
                      <span>Karta egasining ismi:</span>
                      <span className="font-bold text-orange-300">{selectedOrder.seller_card_holder || selectedOrder.seller_name || 'SOTUVCHI'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Chek yuklash */}
              <div className="card space-y-3">
                <h3 className="text-sm font-semibold text-white">📤 To'lov cheki skrinshotini yuklash</h3>
                <p className="text-xs text-gray-400 leading-relaxed">
                  Sotuvchi kartasiga pulni o'tkazgach, chek rasmini yuklang. Sotuvchi tasdiqlashi bilan buyurtmangiz tayyorlanishga tushadi.
                </p>

                <label
                  htmlFor="cust-payment-receipt"
                  className="w-full h-24 bg-gray-900 border-2 border-dashed border-orange-500/60 rounded-xl flex items-center justify-center overflow-hidden hover:border-orange-500 transition-colors cursor-pointer block"
                >
                  {previewUrl ? (
                    <div className="flex items-center gap-3 p-2 w-full h-full bg-black/40">
                      <img src={previewUrl} alt="Chek ko'rinishi" className="w-16 h-16 object-cover rounded-lg border border-gray-700" />
                      <div className="text-xs">
                        <p className="text-green-400 font-bold">✅ Chek rasmi tanlandi</p>
                        <p className="text-gray-400 text-[10px]">O'zgartirish uchun qayta bosing</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center p-2">
                      <span className="text-2xl block">📸</span>
                      <p className="text-xs text-orange-400 font-bold">Chek rasmini tanlash uchun bosing</p>
                      <p className="text-[10px] text-gray-400">Galereyadan rasm yoki skrinshot</p>
                    </div>
                  )}
                </label>

                <div className="flex items-center gap-2">
                  <label
                    htmlFor="cust-payment-receipt"
                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow text-center"
                  >
                    <span>🖼️</span>
                    <span>{previewUrl ? "Boshqa chek tanlash" : "Galereyadan chek tanlash"}</span>
                  </label>
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => { setPreviewUrl(null); if (receiptRef.current) receiptRef.current.value = ''; }}
                      className="bg-red-950/70 border border-red-800 text-red-300 py-2 px-3 rounded-xl text-xs font-bold"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <input
                  id="cust-payment-receipt"
                  type="file"
                  ref={receiptRef}
                  accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
                  onChange={handleFileChange}
                  className="sr-only"
                />

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-950/70 border border-red-700 text-xs text-red-200 font-bold flex items-center gap-2">
                    <span>⚠️</span>
                    <span>{errorMsg}</span>
                  </div>
                )}

                <button
                  onClick={handleUploadReceipt}
                  disabled={uploading}
                  className="btn-primary w-full text-sm font-bold py-3.5 flex items-center justify-center gap-2 shadow-xl"
                >
                  {uploading ? '⏳ Chek yuborilmoqda...' : '📨 Chekni sotuvchiga yuborish'}
                </button>

                {message && (
                  <p className="text-xs text-green-400 bg-green-950/50 border border-green-700 p-3 rounded-xl text-center font-semibold">
                    ✅ {message}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
