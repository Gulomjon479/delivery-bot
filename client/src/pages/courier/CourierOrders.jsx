import { useState, useEffect } from 'react'
import RouteMap from '../../components/RouteMap'

export default function CourierOrders({ telegramId, onOpenMap }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [courierLocation, setCourierLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [openMaps, setOpenMaps] = useState({}) // qaysi buyurtmada xarita ochiq
  const [pinModalOrder, setPinModalOrder] = useState(null)
  const [pinInput, setPinInput] = useState('')
  const [submittingPin, setSubmittingPin] = useState(false)
  const [pinError, setPinError] = useState('')

  // O'tkazib yuborilgan (skip qilingan) buyurtmalar ro'yxati
  const [skippedIds, setSkippedIds] = useState(() => {
    try {
      const saved = localStorage.getItem(`courier_skipped_${telegramId}`)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const skipOrder = (orderId) => {
    setSkippedIds(prev => {
      const updated = prev.includes(orderId) ? prev : [...prev, orderId]
      try {
        localStorage.setItem(`courier_skipped_${telegramId}`, JSON.stringify(updated))
      } catch {}
      return updated
    })
  }

  const unskipAll = () => {
    setSkippedIds([])
    try {
      localStorage.removeItem(`courier_skipped_${telegramId}`)
    } catch {}
  }

  // O'tkazilgan buyurtmalar filtrlangan ro'yxat
  const visibleOrders = orders.filter(o => o.courier_id || !skippedIds.includes(o.id))
  const skippedCount = orders.filter(o => !o.courier_id && skippedIds.includes(o.id)).length

  const toggleMap = (id) => {
    setOpenMaps(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Kuryerning haqiqiy GPS joylashuvini aniqlash va jonli yangilab borish
  useEffect(() => {
    fetch(`/api/courier/profile/${telegramId}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(data => {
        if (data?.lat && data?.lon) {
          const loc = { lat: Number(data.lat), lon: Number(data.lon) }
          setCourierLocation(prev => prev || loc)
          fetchOrders(loc)
        } else {
          fetchOrders()
        }
      })
      .catch(() => fetchOrders())

    handleGetLocation()

    let watchId = null
    if (navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const newLoc = { lat: Number(pos.coords.latitude), lon: Number(pos.coords.longitude) }
          setCourierLocation(newLoc)
          fetch(`/api/courier/location?tid=${telegramId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-telegram-id': String(telegramId)
            },
            body: JSON.stringify({ telegramId, lat: newLoc.lat, lon: newLoc.lon })
          }).catch(() => {})
        },
        () => {},
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      )
    }

    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [telegramId])

  const fetchOrders = (loc = courierLocation) => {
    const locParam = loc ? `&lat=${loc.lat}&lon=${loc.lon}` : ''
    fetch(`/api/courier/orders/${telegramId}?tid=${telegramId}${locParam}`, {
      headers: {
        'x-telegram-id': String(telegramId)
      }
    })
      .then(r => r.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const openDeliverModal = (order) => {
    setPinModalOrder(order)
    setPinInput('')
    setPinError('')
  }

  const handleConfirmDeliveryWithPin = async () => {
    if (!pinModalOrder) return
    const cleanPin = pinInput.trim()
    if (!cleanPin) {
      setPinError('Iltimos, mijoz bergan 4 xonali PIN-kodni kiriting!')
      return
    }

    setSubmittingPin(true)
    setPinError('')
    try {
      const res = await fetch(`/api/courier/orders/${pinModalOrder.id}/deliver?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ pin_code: cleanPin })
      })
      const data = await res.json()
      if (res.ok) {
        setPinModalOrder(null)
        fetchOrders()
      } else {
        setPinError(data.error || 'Noto\'g\'ri PIN-kod!')
      }
    } catch {
      setPinError('Ulanishda xatolik yuz berdi!')
    } finally {
      setSubmittingPin(false)
    }
  }

  useEffect(() => {
    fetchOrders()
    const timer = setInterval(() => fetchOrders(), 2000)
    return () => clearInterval(timer)
  }, [telegramId, courierLocation])

  const handleGetLocation = () => {
    setLocating(true)
    const saveLoc = (lat, lon) => {
      const newLoc = { lat: Number(lat), lon: Number(lon) }
      setCourierLocation(newLoc)
      setLocating(false)
      fetch(`/api/courier/location?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ telegramId, lat: newLoc.lat, lon: newLoc.lon })
      }).catch(() => {})
      fetchOrders(newLoc)
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => saveLoc(pos.coords.latitude, pos.coords.longitude),
        () => {
          setLocating(false)
        },
        { enableHighAccuracy: true, timeout: 8000 }
      )
    } else {
      setLocating(false)
    }
  }

  const acceptOrder = async (orderId) => {
    const res = await fetch(`/api/courier/orders/${orderId}/accept?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({
        telegramId,
        courier_lat: courierLocation?.lat,
        courier_lon: courierLocation?.lon
      })
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setOpenMaps(prev => ({ ...prev, [orderId]: true }))
      fetchOrders()
    } else {
      setOrders(prev => prev.filter(o => o.id !== orderId))
      alert(data.error || 'Ushbu buyurtmani qabul qilib bo\'lmadi.')
      fetchOrders()
    }
  }

  const deliverOrder = async (orderId) => {
    const pin = prompt(`🔑 Buyurtma #${orderId} ni topshirish uchun mijoz ekranidagi 4 xonali PIN-kodni kiriting:`)
    if (pin === null) return // bekor qilindi
    const res = await fetch(`/api/courier/orders/${orderId}/deliver?tid=${telegramId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-telegram-id': String(telegramId)
      },
      body: JSON.stringify({ pin_code: pin.trim() })
    })
    if (res.ok) {
      alert(`✅ Buyurtma #${orderId} muvaffaqiyatli yetkazildi! Kuryer ulushingiz balansingizga qo'shildi.`)
      fetchOrders()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || 'Xatolik')
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Buyurtmalar yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      {/* Lokatsiya aniqlash tugmasi va Xarita tabiga o'tish */}
      <div className="card bg-gray-800/90 border border-orange-500/30 p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              <span>🎯</span> 20 km radiusdagi buyurtmalar
            </h3>
            <p className="text-[11px] text-blue-300">Faqat sizdan 20 km gacha bo'lgan buyurtmalar ko'rsatiladi</p>
          </div>
          <div className="flex items-center gap-1.5">
            {onOpenMap && (
              <button
                onClick={onOpenMap}
                className="btn-secondary text-xs px-2.5 py-2 flex items-center gap-1"
                title="To'liq xarita bo'limi"
              >
                🗺️ Xarita
              </button>
            )}
            <button
              onClick={handleGetLocation}
              disabled={locating}
              className="btn-primary text-xs px-3 py-2 flex items-center gap-1 whitespace-nowrap shadow-md"
            >
              {locating ? '⏳' : '📡'} Joylashuvim
            </button>
          </div>
        </div>

        {courierLocation && (
          <div className="text-xs text-green-400 bg-green-950/50 border border-green-700/50 rounded-xl p-2.5 flex items-center justify-between">
            <span>✅ GPS: {courierLocation.lat.toFixed(4)}, {courierLocation.lon.toFixed(4)}</span>
            <span className="bg-green-800/60 text-green-200 px-2 py-0.5 rounded-full text-[10px] font-bold">Faol</span>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">📦 Buyurtmalar ({visibleOrders.length})</h2>
        <div className="flex items-center gap-2">
          {skippedCount > 0 && (
            <button
              onClick={unskipAll}
              className="text-xs text-gray-400 hover:text-orange-400 flex items-center gap-1 bg-gray-800/80 px-2 py-1 rounded-lg border border-gray-700 transition-all shadow-sm"
              title="O'tkazib yuborilgan buyurtmalarni qayta ko'rsatish"
            >
              <span>↺</span> O'tkazilganlar ({skippedCount})
            </button>
          )}
          <button onClick={() => fetchOrders()} className="text-xs text-orange-400 hover:underline">Yangilash 🔄</button>
        </div>
      </div>

      {visibleOrders.length === 0 && (
        <div className="card text-center text-gray-400 py-12 space-y-2">
          <p className="text-4xl">🛵</p>
          <p className="font-medium text-white">Yangi buyurtmalar yo'q</p>
          <p className="text-xs text-gray-500">
            {skippedCount > 0
              ? 'Barcha yangi buyurtmalarni o\'tkazib yuborgansiz. "O\'tkazilganlar" tugmasi orqali qaytarishingiz mumkin.'
              : 'Mijoz buyurtma berishi bilan bu yerda barcha kuryerlarga avtomatik paydo bo\'ladi'}
          </p>
        </div>
      )}

      {visibleOrders.map(order => {
        const isMine = order.courier_id
        const isDelivering = order.status === 'delivering'
        const isAccepted = order.status === 'accepted'
        const showMap = openMaps[order.id] !== undefined ? openMaps[order.id] : (isDelivering || isAccepted)

        return (
          <div key={order.id} className="card space-y-3.5 border-l-4 border-orange-500">
            {/* Sarlavha & Status */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-gray-400">Buyurtma #{order.id}</span>
                <h4 className="text-base font-bold text-white">
                  {Array.isArray(order.items) && order.items.length > 1
                    ? `${order.items.length} xil taom/mahsulot`
                    : (order.product_name || 'Taom/Mahsulot')}
                </h4>
                <p className="text-xs text-gray-400">Jami soni: {order.quantity || 1} ta</p>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                isDelivering ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                isAccepted ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700' :
                'bg-green-900/60 text-green-300 border border-green-700'
              }`}>
                {isDelivering ? '🚴 Yo\'lda (Yetkazilmoqda)' :
                 isAccepted ? '⏳ Punktda kutilmoqda' : '🆕 Yangi zakaz'}
              </span>
            </div>

            {/* 🛍️ BUYURTMA QILINGAN BARCHA MAHSULOTLAR RO'YXATI */}
            <div className="bg-gray-900/95 rounded-xl p-3 border border-orange-500/30 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-orange-400">
                <span className="flex items-center gap-1.5">
                  <span>🛍️</span> Buyurtma tarkibi ({order.items?.length || 1} xil mahsulot):
                </span>
                <span className="text-gray-300 font-mono font-bold">Jami: {order.quantity || 1} dona</span>
              </div>
              <div className="space-y-1.5 divide-y divide-gray-800">
                {Array.isArray(order.items) && order.items.length > 0 ? (
                  order.items.map((it, idx) => (
                    <div key={idx} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-orange-400 font-bold">•</span>
                        <span className="font-semibold text-white truncate">{it.name}</span>
                        {it.weight && <span className="text-[10px] text-gray-400 font-normal">({it.weight})</span>}
                      </div>
                      <div className="flex items-center gap-2 font-mono flex-shrink-0">
                        <span className="text-orange-300 font-bold">× {it.quantity || 1} ta</span>
                        <span className="text-gray-400 text-[11px]">({Number(it.price || 0).toLocaleString()} so'm)</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center justify-between text-xs text-gray-200">
                    <span className="font-semibold text-white">{order.product_name || 'Taom'}</span>
                    <span className="text-orange-300 font-bold font-mono">× {order.quantity || 1} ta</span>
                  </div>
                )}
              </div>
            </div>

            {/* QAYERDAN OLISH va QAYERGA OLIB BORISH bloklari */}
            <div className="space-y-2 text-xs">
              {/* Qayerdan olish */}
              <div className="bg-gray-900/90 rounded-xl p-3 border border-orange-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-orange-400 font-bold flex items-center gap-1">
                    <span>🏪</span> 1. Qayerdan olish (Punkt):
                  </span>
                  {order.distance_km && (
                    <span className="text-blue-300 bg-blue-950/60 px-2 py-0.5 rounded-full text-[10px] font-bold border border-blue-800">
                      📏 ~{order.distance_km} km (20 km ichida)
                    </span>
                  )}
                </div>
                <p className="text-white font-bold text-sm">
                  {order.seller_point || order.seller_name || 'Savdo punkti'}
                </p>
                <p className="text-gray-300">
                  📍 {order.seller_address || 'Manzil ko\'rsatilmagan'}
                </p>
                {order.seller_phone && (
                  <p className="text-orange-300 font-mono">
                    📞 {order.seller_phone}
                  </p>
                )}
              </div>

              {/* Qayerga olib borish */}
              <div className="bg-gray-900/90 rounded-xl p-3 border border-green-500/40 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-green-400 font-bold flex items-center gap-1">
                    <span>🏠</span> 2. Qayerga olib borish (Mijoz):
                  </span>
                  {order.route_km && (
                    <span className="text-green-300 bg-green-950/60 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-800">
                      marshrut: ~{order.route_km} km
                    </span>
                  )}
                </div>
                <p className="text-white font-bold text-sm">
                  {order.customer_name} {order.customer_lastname || ''}
                </p>
                <p className="text-gray-300">
                  📍 {order.delivery_address || order.customer_address || 'Toshkent sh.'}
                </p>
                {order.customer_phone ? (
                  <p className="text-green-300 font-mono">
                    📞 {order.customer_phone}
                  </p>
                ) : (
                  <p className="text-gray-500 text-[11px]">
                    (Telefon raqami qabul qilingandan so'ng ko'rinadi)
                  </p>
                )}
              </div>
            </div>

            {/* Xarita toggle tugmasi */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => toggleMap(order.id)}
                className="text-xs text-orange-400 hover:text-orange-300 font-bold flex items-center gap-1"
              >
                <span>🗺️</span> {showMap ? 'Xaritani yopish ▲' : 'Xaritani ko\'rish (Marshrut) ▼'}
              </button>
            </div>

            {/* Interaktiv Xarita */}
            {showMap && (
              <RouteMap
                sellerLat={order.seller_lat}
                sellerLon={order.seller_lon}
                sellerLabel={order.seller_point || order.seller_name || 'Punkt'}
                customerLat={order.customer_lat}
                customerLon={order.customer_lon}
                customerLabel={order.delivery_address || order.customer_name || 'Mijoz'}
                courierLat={courierLocation?.lat}
                courierLon={courierLocation?.lon}
                status={order.status}
                distanceKm={order.distance_km}
                height={220}
              />
            )}

            {/* To'lov usuli (Naqd yoki Karta) */}
            <div className="bg-gray-900/90 rounded-xl p-2.5 border border-gray-700/80 flex items-center justify-between text-xs">
              <span className="text-gray-400 font-semibold">To'lov holati:</span>
              {order.payment_method === 'cash' ? (
                <span className="font-extrabold text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-700/60 flex items-center gap-1">
                  💵 NAQD PUL: {Number(order.total_price || 0).toLocaleString()} so'm olinadi
                </span>
              ) : (
                <span className="font-extrabold text-green-300 bg-green-950/60 px-2.5 py-1 rounded-lg border border-green-700/60 flex items-center gap-1">
                  💳 KARTAGA TO'LANGAN (Pul olinmaydi)
                </span>
              )}
            </div>

            {/* Narx va Kuryer daromadi */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-700 text-sm">
              <div>
                <p className="text-xs text-gray-400">Umumiy summa</p>
                <p className="text-white font-bold">{(order.total_price || 0).toLocaleString()} so'm</p>
                {Number(order.delivery_distance_km || order.route_km) > 0 && (
                  <p className="text-[10px] text-blue-300">
                    📏 Masofa: ~{order.delivery_distance_km || order.route_km} km (1 km = {(order.courier_price_per_km || 3000).toLocaleString()} so'm)
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">Kuryer ulushi</p>
                <p className="text-green-400 font-extrabold text-base">
                  +{(order.courier_fee != null ? Number(order.courier_fee) : Number(order.delivery_fee || 0)).toLocaleString()} so'm
                </p>
              </div>
            </div>

            {/* Boshqaruv tugmalari */}
            {!isMine && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => acceptOrder(order.id)}
                  className="btn-primary flex-1 text-sm font-bold py-3 flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                >
                  <span>✅</span>
                  <span>Buyurtmani qabul qilish</span>
                </button>
                <button
                  onClick={() => skipOrder(order.id)}
                  className="bg-gray-800 hover:bg-gray-700 active:scale-95 text-gray-300 hover:text-white border border-gray-700 font-bold px-3.5 py-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all shadow-md whitespace-nowrap"
                  title="Ushbu buyurtmani ro'yxatdan o'tkazib yuborish"
                >
                  <span>⏭️</span>
                  <span>O'tkazib yuborish</span>
                </button>
              </div>
            )}

            {isAccepted && (
              <div className="bg-yellow-950/40 border border-yellow-700/50 rounded-xl p-3 text-center text-xs text-yellow-300 space-y-1">
                <p className="font-bold">⏳ Punktga boring:</p>
                <p><b>{order.seller_point || 'Punkt'}</b> sotuvchisi taomni sizga topshirib, o'z panelida <b>"Kuryerga topshirdim"</b> tugmasini bosishini kuting.</p>
              </div>
            )}

            {isDelivering && (
              <button
                onClick={() => openDeliverModal(order)}
                className="btn-success w-full text-sm font-bold py-3 flex items-center justify-center gap-2 shadow-lg"
              >
                🏁 Mijozga yetkazib berdim (Yakunlash)
              </button>
            )}
          </div>
        )
      })}

      {/* PIN-kod kiritish modali (window.prompt o'rniga to'liq ishlaydigan in-app modal) */}
      {pinModalOrder && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setPinModalOrder(null)}>
          <div className="modal-content space-y-4 max-w-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>🔑</span>
                <span>Yetkazib berish PIN-kodi</span>
              </h3>
              <button onClick={() => setPinModalOrder(null)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 text-center space-y-2">
              <p className="text-xs text-gray-400">
                Buyurtma <b>#{pinModalOrder.id}</b> ni yakunlash uchun mijoz ekranidagi <b>4 xonali PIN-kodni</b> so'rab kiriting:
              </p>
              <input
                type="text"
                maxLength={4}
                autoFocus
                className="input text-center text-2xl font-mono font-extrabold tracking-widest text-orange-400 py-3"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                placeholder="••••"
              />
            </div>

            {pinError && (
              <div className="p-3 bg-red-950/80 border border-red-700 rounded-xl text-xs text-red-200 font-bold text-center">
                ⚠️ {pinError}
              </div>
            )}

            <button
              onClick={handleConfirmDeliveryWithPin}
              disabled={submittingPin}
              className="btn-success w-full py-3.5 text-xs font-extrabold flex items-center justify-center gap-2 shadow-xl"
            >
              <span>✅</span>
              <span>{submittingPin ? 'Tekshirilmoqda...' : 'TASDIQLASH VA YAKUNLASH'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
