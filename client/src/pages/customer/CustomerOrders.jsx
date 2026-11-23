import { useState, useEffect } from 'react'
import RouteMap from '../../components/RouteMap'

export default function CustomerOrders({ telegramId, onGoToPayment }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [payingOrder, setPayingOrder] = useState(null)
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [uploadingReceipt, setUploadingReceipt] = useState(false)
  const [modalError, setModalError] = useState('')
  const [modalSuccess, setModalSuccess] = useState('')
  const [cancellingId, setCancellingId] = useState(null)

  const handleCancelOrder = async (orderId) => {
    if (!confirm(`Haqiqatan ham #${orderId} raqamli buyurtmani bekor qilmoqchimisiz?`)) {
      return
    }
    setCancellingId(orderId)
    try {
      const res = await fetch(`/api/customer/orders/${orderId}/cancel?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ telegramId })
      })
      const data = await res.json()
      if (res.ok) {
        alert('✅ Buyurtma bekor qilindi!')
        fetchOrders()
      } else {
        alert(data.error || 'Buyurtmani bekor qilishda xatolik yuz berdi')
      }
    } catch {
      alert('Serverga ulanishda xatolik yuz berdi!')
    } finally {
      setCancellingId(null)
    }
  }

  const fetchOrders = () => {
    fetch(`/api/customer/orders/${telegramId}?tid=${telegramId}&active_only=true`, {
      headers: {
        'x-telegram-id': String(telegramId)
      }
    })
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        // Foydalanuvchi talabi: bekor qilingan (cancelled), yetkazilgan (delivered)
        // va sotuvchi chekni qabul qilmagan (rejected) buyurtmalar BUYURTMALAR bo'limida ko'rinmasin!
        const active = list.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status))
        setOrders(active)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const openPayModal = (order) => {
    setPayingOrder(order)
    setReceiptFile(null)
    setReceiptPreview(null)
    setModalError('')
    setModalSuccess('')
  }

  const handleReceiptFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptFile(file)
      setReceiptPreview(URL.createObjectURL(file))
      setModalError('')
    } else {
      setReceiptFile(null)
      setReceiptPreview(null)
    }
  }

  const handleSubmitReceipt = async () => {
    if (!payingOrder) return
    if (!receiptFile) {
      setModalError('⚠️ Iltimos, to\'lov cheki rasmini tanlang!')
      return
    }

    setUploadingReceipt(true)
    setModalError('')
    setModalSuccess('')

    const fd = new FormData()
    fd.append('receipt', receiptFile)
    fd.append('telegramId', telegramId)
    fd.append('order_id', payingOrder.id)
    fd.append('amount', payingOrder.total_price)

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
        setModalSuccess('✅ Chek sotuvchiga yuborildi!')
        fetchOrders()
        setTimeout(() => {
          setPayingOrder(null)
        }, 1500)
      } else {
        setModalError(data.error || 'Chek yuklashda xatolik yuz berdi')
      }
    } catch {
      setModalError('Serverga ulanishda xatolik. Internetni tekshiring!')
    } finally {
      setUploadingReceipt(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const timer = setInterval(fetchOrders, 5000)
    return () => clearInterval(timer)
  }, [telegramId])

  const getStepIndex = (status) => {
    if (status === 'pending' || status === 'paid_waiting') return 0
    if (status === 'ready') return 1
    if (status === 'accepted') return 2
    if (status === 'delivering') return 3
    if (status === 'delivered') return 4
    return 0
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Buyurtmalar yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">🛍️ Faol buyurtmalar ({orders.length})</h2>
          <p className="text-[11px] text-gray-400">Faqat jarayondagi va yo'ldagi buyurtmalar</p>
        </div>
        <button onClick={fetchOrders} className="text-xs text-orange-400 hover:underline flex items-center gap-1 font-semibold">
          Yangilash 🔄
        </button>
      </div>

      {orders.length === 0 && (
        <div className="card text-center text-gray-400 py-12 space-y-3">
          <p className="text-5xl">🛵</p>
          <p className="font-bold text-white text-base">Hozirda faol buyurtmalaringiz yo'q</p>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Yetkazib topshirilgan, bekor qilingan yoki rad etilgan buyurtmalar bu yerda ko'rinmaydi. Oldingi xaridlaringiz Profil bo'limida saqlanadi.
          </p>
        </div>
      )}

      {orders.map(order => {
        const step = getStepIndex(order.status)
        const canCancel = ['pending', 'paid_waiting', 'ready', 'accepted'].includes(order.status)

        return (
          <div key={order.id} className="card space-y-3.5 border-l-4 border-orange-500">
            {/* Tepa qism: Yanglishib bosilganda buyurtmani bekor qilish tugmasi */}
            {canCancel && (
              <div className="flex items-center justify-between pb-2.5 border-b border-gray-800 bg-red-950/20 -mx-4 -mt-4 px-4 py-2.5 rounded-t-xl">
                <span className="text-[11px] text-gray-300 flex items-center gap-1 font-medium">
                  <span className="text-orange-400">⚠️</span> Yanglishib buyurtma berildimi?
                </span>
                <button
                  type="button"
                  onClick={() => handleCancelOrder(order.id)}
                  disabled={cancellingId === order.id}
                  className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/50 px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                >
                  <span>❌</span>
                  <span>{cancellingId === order.id ? 'Bekor qilinmoqda...' : 'Zakazni bekor qilish'}</span>
                </button>
              </div>
            )}

            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-gray-400">Buyurtma #{order.id}</span>
                <h3 className="text-base font-bold text-white">{order.product_name}</h3>
                <p className="text-xs text-gray-400">Jami miqdor: {order.quantity || 1} ta</p>
                <div className="mt-1">
                  {order.payment_method === 'cash' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                      💵 Naqd pul (Yetkazilganda to'lanadi)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      💳 Karta orqali
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                order.status === 'delivered' ? 'bg-green-900/60 text-green-300 border border-green-700' :
                order.status === 'delivering' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                order.status === 'ready' || order.status === 'accepted' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                order.status === 'paid_waiting' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700' :
                order.status === 'cancelled' || order.status === 'rejected' ? 'bg-red-950/80 text-red-400 border border-red-800' :
                order.payment_method === 'cash' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700' :
                'bg-gray-700 text-gray-300'
              }`}>
                {order.status === 'delivered' ? '✅ Yetkazildi' :
                 order.status === 'delivering' ? '🚴 Yo\'lda (Kuryerda)' :
                 order.status === 'accepted' ? '📦 Kuryerga berilmoqda' :
                 order.status === 'ready' ? '🧑‍🍳 Tayyorlanmoqda' :
                 order.status === 'paid_waiting' ? '⏳ Chek tekshirilmoqda' :
                 order.status === 'cancelled' ? '❌ Bekor qilingan' :
                 order.status === 'rejected' ? '❌ Rad etilgan' :
                 order.payment_method === 'cash' ? '💵 Naqd buyurtma' : '💳 To\'lov kutilmoqda'}
              </span>
            </div>

            {/* Buyurtma bosqichlari (Tayyorlanmoqda -> Kuryerga berildi -> Yo'lda) */}
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-700/80">
              <div className="grid grid-cols-4 gap-1 text-center text-[10px]">
                {[
                  { idx: 1, icon: '🧑‍🍳', label: 'Tayyorlanmoqda' },
                  { idx: 2, icon: '🤝', label: 'Kuryerga berildi' },
                  { idx: 3, icon: '🚴', label: 'Yo\'lda' },
                  { idx: 4, icon: '🏁', label: 'Yetkazildi' }
                ].map(s => {
                  const active = step >= s.idx
                  return (
                    <div key={s.idx} className={`flex flex-col items-center gap-1 p-1.5 rounded-lg ${active ? 'bg-orange-500/20 text-orange-300 font-bold' : 'text-gray-500'}`}>
                      <span className="text-base">{s.icon}</span>
                      <span>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Sotuvchi va Kuryer ma'lumotlari */}
            <div className="bg-gray-800/80 rounded-xl p-3 text-xs space-y-1.5 border border-gray-700">
              <p className="text-white font-semibold">🏪 Punkt: <span className="text-orange-400">{order.seller_point || order.seller_name || 'Restoran'}</span></p>
              {order.delivery_address && <p className="text-gray-300">📍 Manzil: {order.delivery_address}</p>}
              {order.courier_name ? (
                <div className="pt-1.5 border-t border-gray-700 flex items-center justify-between">
                  <p className="text-green-400 font-bold">
                    🚴 Kuryer: {order.courier_name} {order.courier_lastname || ''}
                  </p>
                  {order.courier_phone && <span className="text-gray-200 font-mono">📞 {order.courier_phone}</span>}
                </div>
              ) : (
                <p className="text-gray-400 italic pt-1">🚴 Kuryer tez orada biriktiriladi</p>
              )}
            </div>

            {/* Yetkazib berish 4 xonali PIN-kodi (faqat mijozga ko'rinadi) */}
            {order.delivery_pin_code && ['ready', 'accepted', 'delivering'].includes(order.status) && (
              <div className="bg-gradient-to-r from-orange-600/25 via-amber-600/20 to-orange-500/25 border border-orange-500/60 rounded-xl p-3 flex items-center justify-between shadow-md">
                <div>
                  <p className="text-xs text-orange-200 font-bold flex items-center gap-1.5">
                    <span>🔑</span>
                    <span>Yetkazib berish PIN-kodi:</span>
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Kuryer taomni topshirayotganda ushbu kodni unga ayting</p>
                </div>
                <div className="bg-orange-500 text-white font-mono font-extrabold text-xl px-3.5 py-1.5 rounded-xl tracking-widest shadow-lg">
                  {order.delivery_pin_code}
                </div>
              </div>
            )}

            {/* Xaritada kuryer kelish yo'li */}
            {(order.status === 'delivering' || order.status === 'accepted' || order.status === 'ready') && (
              <RouteMap
                sellerLat={order.seller_lat}
                sellerLon={order.seller_lon}
                sellerLabel={order.seller_point || 'Punkt'}
                customerLat={order.customer_lat}
                customerLon={order.customer_lon}
                customerLabel={order.delivery_address || 'Sizning manzilingiz'}
                courierLat={order.courier_lat}
                courierLon={order.courier_lon}
                status={order.status}
              />
            )}

            {/* Jami narx va to'lov holati / tugmasi */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700">
              <div>
                <p className="text-xs text-gray-400">Umumiy hisob</p>
                <p className="text-sm font-extrabold text-white">{(order.total_price || 0).toLocaleString()} so'm</p>
                {(Number(order.delivery_fee) > 0 || Number(order.courier_fee) > 0) && (
                  <p className="text-[10px] text-blue-300">
                    Mahsulot: {(order.products_price || Math.max(0, (order.total_price || 0) - (order.delivery_fee || order.courier_fee || 0))).toLocaleString()} + Kuryer ulushi{Number(order.delivery_distance_km) > 0 ? ` (~${order.delivery_distance_km} km)` : ''}: {Number(order.delivery_fee || order.courier_fee || 0).toLocaleString()} so'm
                  </p>
                )}
              </div>
              {order.status === 'pending' && (
                order.payment_method === 'cash' ? (
                  <span className="text-xs text-green-400 bg-green-950/60 border border-green-700/60 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                    <span>💵</span> Naqd to'lov (Yetkazilganda)
                  </span>
                ) : (
                  <button
                    onClick={() => openPayModal(order)}
                    className="btn-primary text-xs py-2 px-3.5 font-bold flex items-center gap-1.5 shadow-lg"
                  >
                    💳 To'lov qilish & Chek yuklash
                  </button>
                )
              )}
              {order.status === 'paid_waiting' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-yellow-950/80 text-yellow-300 px-3 py-1.5 rounded-xl border border-yellow-700/60 font-semibold flex items-center gap-1.5">
                    <span>⏳</span>
                    <span>Chek tekshirilmoqda</span>
                  </span>
                  <button
                    onClick={() => openPayModal(order)}
                    className="text-[11px] text-gray-400 hover:text-white underline"
                  >
                    Qayta yuklash
                  </button>
                </div>
              )}
              {order.status === 'rejected' && (
                <button
                  onClick={() => openPayModal(order)}
                  className="btn-danger text-xs py-2 px-3 font-bold flex items-center gap-1"
                >
                  ⚠️ Chek rad etilgan (Qayta yuborish)
                </button>
              )}
            </div>
          </div>
        )
      })}

      {/* To'lov va Chek yuklash Modali */}
      {payingOrder && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPayingOrder(null)}>
          <div className="modal-content space-y-4 max-w-md">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">💳 Buyurtma #{payingOrder.id} uchun to'lov</h3>
                <p className="text-xs text-gray-400">{payingOrder.product_name}</p>
              </div>
              <button onClick={() => setPayingOrder(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            {/* Sotuvchi to'lov kartasi */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-4 border border-orange-500/40 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">🏪 {payingOrder.seller_point || payingOrder.seller_name || 'Sotuvchi'} kartasi:</span>
                <span className="text-xs font-bold text-orange-400 bg-orange-950/60 px-2.5 py-0.5 rounded-full border border-orange-700/40">
                  Click / Payme / Uzum
                </span>
              </div>
              <p className="text-white font-mono text-lg font-extrabold tracking-wider select-all bg-black/40 p-2.5 rounded-xl border border-gray-700 text-center">
                {payingOrder.seller_card || '8600 5555 4444 3333'}
              </p>
              <div className="flex items-center justify-between text-xs text-gray-300 pt-1 border-t border-gray-700/60">
                <span>Karta egasi: <b className="text-orange-300">{payingOrder.seller_card_holder || payingOrder.seller_name || 'SOTUVCHI'}</b></span>
                <span>Summa: <b className="text-white font-mono text-sm">{(payingOrder.total_price || 0).toLocaleString()} so'm</b></span>
              </div>
            </div>

            {/* Chek rasmini tanlash */}
            <div className="space-y-2.5">
              <label className="text-xs text-gray-300 block font-semibold">
                📸 To'lov cheki skrinshotini (rasmini) yuklang:
              </label>

              <label
                htmlFor="customer-order-receipt"
                className="w-full h-24 bg-gray-900 border-2 border-dashed border-orange-500/60 rounded-xl flex items-center justify-center overflow-hidden hover:border-orange-500 transition-colors cursor-pointer block"
              >
                {receiptPreview ? (
                  <div className="flex items-center gap-3 p-2 w-full h-full bg-black/40">
                    <img src={receiptPreview} alt="Chek" className="w-16 h-16 object-cover rounded-lg border border-gray-700" />
                    <div className="text-xs">
                      <p className="text-green-400 font-bold">✅ Chek rasmi tanlandi</p>
                      <p className="text-gray-400 text-[10px]">O'zgartirish uchun qayta bosing</p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-2">
                    <span className="text-2xl block">📸</span>
                    <p className="text-xs text-orange-400 font-bold">Chek rasmini tanlash uchun bosing</p>
                    <p className="text-[10px] text-gray-400">Galereyadan skrinshot yoki rasm</p>
                  </div>
                )}
              </label>

              {/* Mobil Telegram uchun qulay tugma */}
              <div className="flex items-center gap-2">
                <label
                  htmlFor="customer-order-receipt"
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow text-center"
                >
                  <span>🖼️</span>
                  <span>{receiptFile ? "Boshqa chek rasmini tanlash" : "Galereyadan chekni tanlash"}</span>
                </label>
                {receiptFile && (
                  <button
                    type="button"
                    onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                    className="bg-red-950/70 border border-red-800 text-red-300 py-2 px-3 rounded-xl text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              <input
                id="customer-order-receipt"
                type="file"
                accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
                onChange={handleReceiptFileChange}
                className="sr-only"
              />

              {modalError && (
                <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-xs text-red-200 font-bold flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{modalError}</span>
                </div>
              )}

              {modalSuccess && (
                <div className="p-3 rounded-xl bg-green-950/80 border border-green-700 text-xs text-green-200 font-bold flex items-center gap-2">
                  <span>✅</span>
                  <span>{modalSuccess}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmitReceipt}
                disabled={uploadingReceipt}
                className="btn-primary w-full py-3.5 text-xs font-extrabold flex items-center justify-center gap-2 shadow-xl"
              >
                <span>📨</span>
                <span>{uploadingReceipt ? '⏳ Chek yuborilmoqda...' : 'CHEKNI SOTUVCHIGA YUBORISH'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
