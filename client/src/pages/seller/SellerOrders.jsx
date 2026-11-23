import { useState, useEffect } from 'react'
import RouteMap from '../../components/RouteMap'

export default function SellerOrders({ telegramId }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = () => {
    fetch(`/api/seller/orders/${telegramId}`)
      .then(r => r.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchOrders()
    const timer = setInterval(fetchOrders, 5000)
    return () => clearInterval(timer)
  }, [telegramId])

  const confirmPayment = async (orderId) => {
    const res = await fetch(`/api/seller/orders/${orderId}/confirm-payment`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || 'Tasdiqlashda xatolik!')
    } else {
      fetchOrders()
    }
  }

  const rejectPayment = async (orderId) => {
    if (!confirm(`Buyurtma #${orderId} to'lov chekini rad etmoqchimisiz?`)) return
    const res = await fetch(`/api/seller/orders/${orderId}/reject`, { method: 'POST' })
    if (res.ok) fetchOrders()
  }

  const handoverToCourier = async (orderId) => {
    const res = await fetch(`/api/seller/orders/${orderId}/handover`, { method: 'POST' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      alert(data.error || 'Xatolik!')
    } else {
      fetchOrders()
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Buyurtmalar yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">📋 Kelgan buyurtmalar ({orders.length})</h2>
        <button onClick={fetchOrders} className="text-xs text-orange-400 hover:underline">Yangilash 🔄</button>
      </div>

      {orders.length === 0 && (
        <div className="card text-center text-gray-400 py-12 space-y-2">
          <p className="text-4xl">🍕</p>
          <p className="font-medium text-white">Yangi buyurtmalar yo'q</p>
          <p className="text-xs text-gray-500">Mijozlar buyurtma berishi bilan bu yerda ko'rinadi</p>
        </div>
      )}

      {orders.map(order => {
        let itemsList = []
        try {
          if (order.items_json) itemsList = JSON.parse(order.items_json)
        } catch (e) {}

        const canHandover = order.status === 'accepted' && (order.courier_name || order.courier_id)

        return (
          <div key={order.id} className="card space-y-3.5 border-l-4 border-orange-500">
            {/* Sarlavha & Narx */}
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-mono text-gray-400">Buyurtma #{order.id}</span>
                <h4 className="text-base font-bold text-white">{order.product_name || 'Buyurtma'}</h4>
                <p className="text-xs text-gray-400">Soni: {order.quantity || 1} ta</p>
                <div className="mt-1">
                  {order.payment_method === 'cash' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-green-500/20 text-green-400 border border-green-500/40">
                      💵 To'lov: NAQD PUL (Yetkazilganda olinadi)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/40">
                      💳 To'lov: KARTA ORQALI
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold inline-block mb-1 ${
                  order.status === 'delivered' ? 'bg-green-900/60 text-green-300 border border-green-700' :
                  order.status === 'delivering' ? 'bg-blue-900/60 text-blue-300 border border-blue-700' :
                  order.status === 'accepted' ? 'bg-indigo-900/60 text-indigo-300 border border-indigo-700' :
                  order.status === 'ready' ? 'bg-purple-900/60 text-purple-300 border border-purple-700' :
                  order.status === 'paid_waiting' ? 'bg-yellow-900/60 text-yellow-300 border border-yellow-700 animate-pulse' :
                  order.status === 'rejected' ? 'bg-red-950 text-red-400 border border-red-800' :
                  'bg-gray-800 text-gray-400'
                }`}>
                  {order.status === 'delivered' ? '✅ Yetkazildi' :
                   order.status === 'delivering' ? '🚴 Kuryer yo\'lda' :
                   order.status === 'accepted' ? '🛵 Kuryer kelmoqda' :
                   order.status === 'ready' ? '🧑‍🍳 Kuryer qidirilmoqda' :
                   order.status === 'paid_waiting' ? '🧾 Chek keldi!' :
                   order.status === 'rejected' ? '❌ Rad etilgan' : 'Yangi'}
                </span>
                <p className="text-white font-extrabold text-sm">{Number(order.total_price || 0).toLocaleString()} so'm</p>
              </div>
            </div>

            {/* Savatcha tarkibi */}
            {itemsList.length > 0 && (
              <div className="bg-gray-900/70 rounded-xl p-2.5 border border-gray-700/70 space-y-1 text-xs">
                <p className="text-gray-400 font-semibold text-[11px]">🛒 Buyurtma tarkibi:</p>
                {itemsList.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-gray-200">
                    <span>• {it.name} {it.weight ? `(${it.weight})` : ''}</span>
                    <span className="font-bold text-orange-300">{it.quantity} ta × {Number(it.price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Mijoz profili va Kuryer ma'lumotlari */}
            <div className="bg-gray-900 rounded-xl p-3 border border-gray-700 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 text-xs">
                  <p className="text-white font-bold flex items-center gap-1.5">
                    <span>👤 Mijoz:</span>
                    <span>{order.customer_name} {order.customer_lastname || ''}</span>
                  </p>
                  {order.customer_phone && <p className="text-gray-300">📞 {order.customer_phone}</p>}
                  {order.delivery_address && <p className="text-orange-300">📍 {order.delivery_address}</p>}
                </div>

                {/* Kuryerga topshirdim tugmasi */}
                {canHandover && (
                  <button
                    onClick={() => handoverToCourier(order.id)}
                    className="btn-success text-xs py-2 px-3.5 font-bold whitespace-nowrap shadow-md flex items-center gap-1 animate-pulse"
                  >
                    <span>🤝</span>
                    <span>Kuryerga topshirdim</span>
                  </button>
                )}
              </div>

              <div className="pt-2 border-t border-gray-800 flex items-center justify-between text-xs">
                {order.courier_name ? (
                  <p className="text-green-400 font-semibold">
                    🚴 Kuryer: <b>{order.courier_name}</b> {order.courier_phone ? `(${order.courier_phone})` : ''}
                  </p>
                ) : (
                  <p className="text-yellow-400">🚴 Kuryer: Hali qabul qilmagan</p>
                )}

                {order.receipt_url && (
                  <a
                    href={order.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-orange-400 font-semibold hover:underline flex items-center gap-1"
                  >
                    🧾 Chekni ko'rish
                  </a>
                )}
              </div>
            </div>

            {/* Mijoz to'lov chekini tasdiqlash yoki naqd pul zakazni qabul qilish */}
            {(order.status === 'paid_waiting' || order.status === 'pending') && (
              <div className="flex gap-2">
                <button
                  onClick={() => confirmPayment(order.id)}
                  className={`flex-1 text-xs font-bold py-2.5 shadow-md flex items-center justify-center gap-1.5 rounded-xl ${
                    order.payment_method === 'cash'
                      ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                      : 'btn-primary'
                  }`}
                >
                  <span>✅</span>
                  <span>
                    {order.payment_method === 'cash'
                      ? 'Naqd buyurtmani qabul qilish (Tayyorlash)'
                      : (order.receipt_url ? 'Chekni tasdiqlash va Qabul qilish' : 'Qabul qilish (Tayyorlash)')}
                  </span>
                </button>
                <button
                  onClick={() => rejectPayment(order.id)}
                  className="btn-danger text-xs font-bold px-3 py-2.5"
                >
                  ❌ Rad etish
                </button>
              </div>
            )}

            {/* Kuryer yo'lga chiqqanda xaritada ko'rinadi */}
            {(order.status === 'delivering' || order.status === 'accepted') && (
              <RouteMap
                sellerLat={order.seller_lat}
                sellerLon={order.seller_lon}
                sellerLabel="Sizning punktingiz"
                customerLat={order.customer_lat}
                customerLon={order.customer_lon}
                customerLabel={order.delivery_address || order.customer_name || 'Mijoz'}
                status={order.status}
                height={200}
              />
            )}

            {/* Moliyaviy ulushlar ko'rinishi (Dinamik sozlamalar bo'yicha) */}
            {(() => {
              const price = Number(order.total_price || 0)
              const deliveryFee = order.delivery_fee != null ? Number(order.delivery_fee) : Number(order.courier_fee || 0)
              const productsPrice = order.products_price != null && Number(order.products_price) > 0 ? Number(order.products_price) : Math.max(0, price - deliveryFee)
              const adminFee = order.admin_fee != null ? Number(order.admin_fee) : Math.round(productsPrice * 0.05)
              const courierFee = order.courier_fee != null ? Number(order.courier_fee) : deliveryFee
              const sellerNet = order.seller_net != null ? Number(order.seller_net) : Math.max(0, productsPrice - adminFee)

              return (
                <div className="bg-gray-800/80 rounded-xl p-2.5 text-xs space-y-1 border border-gray-700/60">
                  <div className="flex justify-between text-gray-300">
                    <span>Umumiy hisob:</span>
                    <span className="font-semibold text-white">{price.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-gray-400 text-[11px]">
                    <span>Mahsulotlar summasi:</span>
                    <span>{productsPrice.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-orange-400">
                    <span>Admin ulushi:</span>
                    <span>-{adminFee.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-yellow-400">
                    <span>Kuryer ulushi{Number(order.delivery_distance_km) > 0 ? ` (~${order.delivery_distance_km} km)` : ''}:</span>
                    <span>-{courierFee.toLocaleString()} so'm</span>
                  </div>
                  <div className="flex justify-between text-green-400 font-bold border-t border-gray-700 pt-1">
                    <span>Sotuvchiga sof daromad:</span>
                    <span>+{sellerNet.toLocaleString()} so'm</span>
                  </div>
                </div>
              )
            })()}
          </div>
        )
      })}
    </div>
  )
}
