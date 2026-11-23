import { useState, useEffect } from 'react'
import RouteMap from '../../components/RouteMap'

function openLink(url) {
  if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url)
  else window.open(url, '_blank')
}

export default function CourierMap({ telegramId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [courierLocation, setCourierLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [acceptingId, setAcceptingId] = useState(null)
  const [gpsMsg, setGpsMsg] = useState('')

  // 1. Kuryerning haqiqiy jonli GPS joylashuvini darhol aniqlash va kuzatish
  useEffect(() => {
    // Profil ma'lumotlaridan dastlabki koordinatani yuklab turish
    fetch(`/api/courier/profile/${telegramId}?tid=${telegramId}`, {
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(data => {
        if (data && data.lat && data.lon) {
          const savedLoc = { lat: Number(data.lat), lon: Number(data.lon) }
          setCourierLocation(prev => prev || savedLoc)
          fetchOrders(savedLoc)
        }
      })
      .catch(() => {})

    // Haqiqiy GPS orqali hozir qayerda turganini aniqlash va serverga uzatish
    handleGetLocation()

    // Harakatlanayotganda kuryer joylashuvini jonli kuzatib borish (watchPosition)
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
      headers: { 'x-telegram-id': String(telegramId) }
    })
      .then(r => r.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : []
        setOrders(arr)
        setSelectedOrder(prev => {
          if (prev && arr.some(o => o.id === prev.id)) {
            return arr.find(o => o.id === prev.id)
          }
          const active = arr.find(o => o.status === 'delivering' || o.status === 'accepted')
          return active || arr[0] || null
        })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  // GPS lokatsiyani aniqlash va serverga saqlash
  const handleGetLocation = () => {
    setLocating(true)
    setGpsMsg('GPS aniqlanmoqda...')

    const saveLoc = (lat, lon) => {
      const newLoc = { lat: Number(lat), lon: Number(lon) }
      setCourierLocation(newLoc)
      setLocating(false)
      setGpsMsg(`📍 Joylashuv yangilandi (${newLoc.lat.toFixed(4)}, ${newLoc.lon.toFixed(4)})`)
      setTimeout(() => setGpsMsg(''), 4000)

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
        (err) => {
          setLocating(false)
          setGpsMsg('⚠️ GPS ruxsati berilmadi. Xaritaga bosib lokatsiyangizni belgilashingiz mumkin.')
          setTimeout(() => setGpsMsg(''), 6000)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      setLocating(false)
      setGpsMsg('⚠️ Qurilmada GPS qo\'llab-quvvatlanmadi.')
    }
  }

  // Xarita ustiga bosilganda kuryer lokatsiyasini qo'lda o'rnatish
  const handleMapClick = (coords) => {
    if (!coords?.lat || !coords?.lon) return
    const newLoc = { lat: Number(coords.lat), lon: Number(coords.lon) }
    setCourierLocation(newLoc)
    setGpsMsg(`📍 Joylashuvingiz xaritadan belgilandi (${newLoc.lat.toFixed(4)}, ${newLoc.lon.toFixed(4)})`)
    setTimeout(() => setGpsMsg(''), 4000)

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

  // Buyurtmani qabul qilish
  const handleAcceptOrder = async (orderId) => {
    setAcceptingId(orderId)
    try {
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
      const data = await res.json()
      if (res.ok) {
        fetchOrders()
      } else {
        alert(data.error || 'Qabul qilishda xatolik!')
        fetchOrders()
      }
    } catch {
      alert('Tarmoq xatoligi!')
    } finally {
      setAcceptingId(null)
    }
  }

  useEffect(() => {
    const timer = setInterval(() => {
      fetchOrders()
    }, 4000)
    return () => clearInterval(timer)
  }, [telegramId, courierLocation])

  if (loading) return <div className="text-center text-gray-400 py-12">⏳ Xarita yuklanmoqda...</div>

  // Xaritadagi barcha do'konlar / savdo punktlari (20 km ichidagi buyurtmalar)
  const extraMarkers = orders.map(o => {
    const fee = o.courier_fee != null ? Number(o.courier_fee) : Number(o.delivery_fee || 0)
    return {
      id: o.id,
      lat: o.seller_lat,
      lon: o.seller_lon,
      title: `Buyurtma #${o.id} · +${fee.toLocaleString()} so'm`,
      subtitle: `${o.seller_point || o.seller_name || 'Punkt'} ➔ ${o.customer_name || 'Mijoz'}`,
      distance: o.distance_km,
      icon: o.courier_id ? '📦' : '🏪',
      bg: o.courier_id ? '#3b82f6' : '#ea580c',
      onClick: () => setSelectedOrder(o)
    }
  })

  const activeOrdersCount = orders.filter(o => o.courier_id).length
  const newOrdersCount = orders.filter(o => !o.courier_id).length

  return (
    <div className="space-y-4">
      {/* Sarlavha, 20 km Radius holati va GPS */}
      <div className="card bg-gray-800/90 border border-blue-500/30 p-4 space-y-3 shadow-lg">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-white font-bold text-base flex items-center gap-2">
              <span>🗺️</span> Kuryer Navigatsiya Xaritasi
            </h2>
            <p className="text-[11px] text-blue-300">
              🔵 <b className="text-white">20 km radius qoidasi:</b> Faqat sizdan 20 km gacha bo'lgan buyurtmalar keladi
            </p>
          </div>
          <button
            onClick={handleGetLocation}
            disabled={locating}
            className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5 shadow-md whitespace-nowrap"
          >
            {locating ? '⏳ Aniqlanmoqda...' : '📡 GPS yangilash'}
          </button>
        </div>

        {gpsMsg && (
          <div className="text-xs text-amber-300 bg-amber-950/60 border border-amber-800/80 rounded-xl px-3 py-2">
            {gpsMsg}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1 border-t border-gray-700/60">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-green-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Jonli xarita
            </span>
            <span className="text-gray-400">·</span>
            <span className="text-blue-300 font-medium">🎯 20 km xizmat radiusi</span>
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-lg border border-orange-500/30">
              Yangi: <b>{newOrdersCount}</b>
            </span>
            <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-lg border border-blue-500/30">
              Olingan: <b>{activeOrdersCount}</b>
            </span>
          </div>
        </div>
      </div>

      {/* Interaktiv Leaflet Xaritasi: Doimiy ishlaydi */}
      <RouteMap
        sellerLat={selectedOrder ? selectedOrder.seller_lat : null}
        sellerLon={selectedOrder ? selectedOrder.seller_lon : null}
        sellerLabel={selectedOrder ? (selectedOrder.seller_point || selectedOrder.seller_name || 'Savdo punkti') : 'Punkt'}
        customerLat={selectedOrder ? selectedOrder.customer_lat : null}
        customerLon={selectedOrder ? selectedOrder.customer_lon : null}
        customerLabel={selectedOrder ? (selectedOrder.delivery_address || selectedOrder.customer_name || 'Mijoz') : 'Mijoz'}
        courierLat={courierLocation?.lat}
        courierLon={courierLocation?.lon}
        status={selectedOrder?.status || 'ready'}
        distanceKm={selectedOrder?.distance_km}
        height={320}
        showCourierRadius={true}
        extraMarkers={extraMarkers}
        onMapClick={handleMapClick}
      />

      <p className="text-[11px] text-gray-400 text-center">
        💡 <i>Maslahat: Xarita ustidagi 🏪 belgilarni bosib buyurtmani tanlashingiz yoki bo'sh joyga bosib lokatsiyangizni o'zgartirishingiz mumkin.</i>
      </p>

      {/* Tanlangan buyurtma tafsilotlari kartasi */}
      {selectedOrder ? (
        <div className="card bg-gray-800 border-2 border-orange-500 p-4 space-y-3.5 shadow-xl">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono bg-gray-900 px-2 py-0.5 rounded text-gray-300 font-bold">
                  #{selectedOrder.id}
                </span>
                <span className="text-xs text-blue-400 font-bold">
                  📏 ~{selectedOrder.distance_km != null ? `${selectedOrder.distance_km} km` : '0 km'} (20 km ichida)
                </span>
              </div>
              <h3 className="text-base font-bold text-white mt-1">
                {selectedOrder.product_name || 'Buyurtma taomlari'}
              </h3>
            </div>

            <span className={`text-xs px-2.5 py-1 rounded-full font-bold whitespace-nowrap ${
              selectedOrder.status === 'delivering' ? 'bg-blue-900/80 text-blue-300 border border-blue-600' :
              selectedOrder.status === 'accepted' ? 'bg-yellow-900/80 text-yellow-300 border border-yellow-600' :
              'bg-green-900/80 text-green-300 border border-green-600'
            }`}>
              {selectedOrder.status === 'delivering' ? '🚴 Yo\'lda (Yetkazilmoqda)' :
               selectedOrder.status === 'accepted' ? '⏳ Savdo punktida kutilmoqda' : '🆕 Yangi (20 km ichida)'}
            </span>
          </div>

          {/* Olish va topshirish manzillari */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="bg-gray-900/90 rounded-xl p-3 border border-orange-500/40 space-y-1">
              <div className="flex items-center gap-1.5 text-orange-400 font-bold">
                <span>🏪</span> 1. QAYERDAN OLISH:
              </div>
              <p className="text-white font-semibold text-sm">
                {selectedOrder.seller_point || selectedOrder.seller_name || 'Savdo punkti'}
              </p>
              <p className="text-gray-300 text-[11px]">
                📍 {selectedOrder.seller_address || 'Manzil ko\'rsatilmagan'}
              </p>
              {selectedOrder.seller_phone && (
                <a href={`tel:${selectedOrder.seller_phone}`} className="inline-block text-orange-300 font-mono text-[11px] underline">
                  📞 {selectedOrder.seller_phone}
                </a>
              )}
            </div>

            <div className="bg-gray-900/90 rounded-xl p-3 border border-green-500/40 space-y-1">
              <div className="flex items-center gap-1.5 text-green-400 font-bold">
                <span>🏠</span> 2. QAYERGA YETKAZISH:
              </div>
              <p className="text-white font-semibold text-sm">
                {selectedOrder.customer_name} {selectedOrder.customer_lastname || ''}
              </p>
              <p className="text-gray-300 text-[11px]">
                📍 {selectedOrder.delivery_address || selectedOrder.customer_address || 'Mijoz manzili'}
              </p>
              {selectedOrder.customer_phone ? (
                <a href={`tel:${selectedOrder.customer_phone}`} className="inline-block text-green-300 font-mono text-[11px] underline">
                  📞 {selectedOrder.customer_phone}
                </a>
              ) : (
                <p className="text-gray-500 text-[10px]">
                  (Telefon raqami qabul qilingach ko'rinadi)
                </p>
              )}
            </div>
          </div>

          {/* Daromad va Qabul qilish tugmasi */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-700/80">
            <div>
              <span className="text-[10px] text-gray-400 block">
                Kuryer ulushi ({selectedOrder.delivery_distance_km || selectedOrder.route_km ? `~${selectedOrder.delivery_distance_km || selectedOrder.route_km} km` : `1 km = ${(selectedOrder.courier_price_per_km || 3000).toLocaleString()} so'm`}):
              </span>
              <span className="text-base font-extrabold text-green-400">
                +{(selectedOrder.courier_fee != null ? Number(selectedOrder.courier_fee) : Number(selectedOrder.delivery_fee || 0)).toLocaleString()} so'm
              </span>
            </div>

            {!selectedOrder.courier_id && (
              <button
                onClick={() => handleAcceptOrder(selectedOrder.id)}
                disabled={acceptingId === selectedOrder.id}
                className="btn-primary text-xs px-5 py-2.5 font-bold shadow-lg flex items-center gap-1.5"
              >
                {acceptingId === selectedOrder.id ? '⏳ Olinmoqda...' : '✅ Buyurtmani qabul qilish'}
              </button>
            )}

            {selectedOrder.courier_id && selectedOrder.status === 'accepted' && (
              <span className="text-xs bg-yellow-900/50 text-yellow-300 border border-yellow-700 px-3 py-1.5 rounded-xl font-bold">
                🏪 Punktga boring va taomni oling
              </span>
            )}

            {selectedOrder.courier_id && selectedOrder.status === 'delivering' && (
              <span className="text-xs bg-blue-900/50 text-blue-300 border border-blue-700 px-3 py-1.5 rounded-xl font-bold">
                🚴 Mijozga yetkazilmoqda
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="card text-center text-gray-400 py-6 space-y-2">
          <p className="text-3xl">📍</p>
          <p className="font-semibold text-white">20 km radiusingizda buyurtmalar mavjud emas</p>
          <p className="text-xs text-gray-500">
            Yangi buyurtma 20 km ichida paydo bo'lganda bu yerda va xaritada avtomatik paydo bo'ladi.
          </p>
        </div>
      )}

      {/* 20 km radiusedagi boshqa buyurtmalar ro'yxati */}
      {orders.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center justify-between">
            <span>20 km radiusdagi buyurtmalar ({orders.length})</span>
            <span className="text-[10px] text-blue-400">Filtr: faqat 20 km</span>
          </h4>
          <div className="space-y-2">
            {orders.map(o => (
              <div
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className={`card p-3 cursor-pointer flex items-center justify-between transition-all ${
                  selectedOrder?.id === o.id ? 'border-orange-500 bg-gray-800 shadow-md' : 'hover:border-gray-600 bg-gray-850'
                }`}
              >
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-white flex items-center gap-2">
                    <span>#{o.id} · {o.product_name}</span>
                    {o.courier_id && (
                      <span className="text-[10px] bg-blue-900 text-blue-200 px-1.5 py-0.2 rounded font-semibold">
                        Sizda
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-400 truncate max-w-[200px]">
                    🏪 {o.seller_point || 'Punkt'} ➔ 🏠 {o.delivery_address || 'Mijoz'}
                  </p>
                </div>
                <div className="text-right whitespace-nowrap">
                  <span className="text-xs font-bold text-green-400 block">
                    +{(o.courier_fee != null ? Number(o.courier_fee) : Number(o.delivery_fee || 0)).toLocaleString()} so'm
                  </span>
                  <span className="text-[10px] text-blue-300 font-medium">
                    📏 ~{o.distance_km != null ? `${o.distance_km} km` : '0 km'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
