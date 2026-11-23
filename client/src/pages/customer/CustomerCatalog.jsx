import { useState, useEffect } from 'react'
import LocationPickerMap from '../../components/LocationPickerMap'

function calcDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const nLat1 = Number(lat1), nLon1 = Number(lon1), nLat2 = Number(lat2), nLon2 = Number(lon2)
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) return null
  const R = 6371
  const dLat = (nLat2 - nLat1) * Math.PI / 180
  const dLon = (nLon2 - nLon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * Math.PI / 180) * Math.cos(nLat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export default function CustomerCatalog({ telegramId, onOrderCreated }) {
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSellerId, setActiveSellerId] = useState(null)

  // Shopping Cart (Savatcha) state
  const [cart, setCart] = useState([])
  const [showCartModal, setShowCartModal] = useState(false)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [customerCoords, setCustomerCoords] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('card') // 'card' yoki 'cash'
  const [ordering, setOrdering] = useState(false)
  const [deliverySettings, setDeliverySettings] = useState({ courierPricePerKm: 3000 })

  const [selectedCatFilter, setSelectedCatFilter] = useState('all')

  const loadCatalog = () => {
    fetch('/api/customer/catalog')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setCatalog(list)
        if (list.length > 0) {
          setActiveSellerId(prev => {
            if (prev && list.some(s => s.id === prev)) return prev
            // Agar foydalanuvchining o'z do'koni ro'yxatda bo'lsa, o'shani birinchi qilib tanlaymiz
            const myShop = list.find(s => String(s.telegram_id) === String(telegramId))
            if (myShop) return myShop.id
            return list[0].id
          })
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))

    fetch('/api/customer/delivery-settings')
      .then(r => r.json())
      .then(s => {
        if (s && s.courierPricePerKm != null) setDeliverySettings(s)
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadCatalog()
    fetch(`/api/customer/profile/${telegramId}`)
      .then(r => r.json())
      .then(u => {
        if (u?.address) setDeliveryAddress(u.address)
        if (u?.lat && u?.lon) setCustomerCoords({ lat: u.lat, lon: u.lon })
      })
      .catch(() => {})
  }, [telegramId])

  const addToCart = (product) => {
    const maxStock = product.stock !== undefined && product.stock !== null ? Number(product.stock) : 999
    if (maxStock <= 0) {
      alert(`"${product.name}" hozircha sotuvda qolmagan (0 ta).`)
      return
    }

    setCart(prev => {
      // Ensure cart only has products from same seller
      if (prev.length > 0 && prev[0].seller_id !== product.seller_id) {
        if (!confirm('Savatchada boshqa sotuvchining mahsuloti bor. Savatchani yangilaymizmi?')) {
          return prev
        }
        return [{ ...product, quantity: 1 }]
      }
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        if (existing.quantity >= maxStock) {
          alert(`"${product.name}" mahsulotidan atigi ${maxStock} ta qolgan! Undan ko'p xarid qila olmaysiz.`)
          return prev
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...prev, { ...product, quantity: 1 }]
    })
  }

  const updateCartQty = (productId, delta) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.id === productId) {
            const maxStock = item.stock !== undefined && item.stock !== null ? Number(item.stock) : 999
            if (delta > 0 && item.quantity >= maxStock) {
              alert(`"${item.name}" mahsulotidan atigi ${maxStock} ta mavjud! Undan ortiq qo'sha olmaysiz.`)
              return item
            }
            return { ...item, quantity: item.quantity + delta }
          }
          return item
        })
        .filter(item => item.quantity > 0)
    )
  }

  const getProductQty = (productId) => {
    return cart.find(i => i.id === productId)?.quantity || 0
  }

  const currentSeller = catalog.find(s => s.id === activeSellerId) || catalog[0]
  const cartSeller = cart.length > 0
    ? (catalog.find(s => s.id === cart[0].seller_id) || currentSeller)
    : currentSeller

  const totalCartItems = cart.reduce((s, i) => s + i.quantity, 0)
  const productsPrice = cart.reduce((s, i) => s + (Number(i.price) || 0) * i.quantity, 0)
  const pricePerKm = Math.max(0, Math.round(Number(deliverySettings?.courierPricePerKm ?? 3000)))
  const rawDistKm = customerCoords?.lat && customerCoords?.lon && cartSeller?.lat != null && cartSeller?.lon != null
    ? calcDistanceKm(cartSeller.lat, cartSeller.lon, customerCoords.lat, customerCoords.lon)
    : null
  const distanceKm = rawDistKm !== null ? Number(rawDistKm.toFixed(1)) : null
  const billedKm = distanceKm !== null ? Math.max(1, distanceKm) : 1
  const deliveryFee = productsPrice > 0 ? Math.round(billedKm * pricePerKm) : 0
  const totalCartPrice = productsPrice + deliveryFee

  const handleCheckout = async () => {
    if (cart.length === 0) return

    if (!customerCoords || !customerCoords.lat || !customerCoords.lon) {
      alert("⚠️ Buyurtma berish uchun lokatsiyangizni yoqishingiz (GPS) yoki xaritadan uyingizni tanlashingiz SHART!\n\nKuryer manzilingizni to'g'ri topib borishi uchun xaritada nuqtani belgilang.")
      return
    }

    const methodText = paymentMethod === 'cash' ? "Naqd pul (yetkazilganda)" : "Karta orqali"
    const distNote = distanceKm !== null ? ` (~${distanceKm} km × ${pricePerKm.toLocaleString()} so'm/km)` : ` (1 km = ${pricePerKm.toLocaleString()} so'm)`
    if (!confirm(`Buyurtmani tasdiqlaysizmi?\n\nMahsulotlar: ${productsPrice.toLocaleString()} so'm\nKuryer ulushi${distNote}: +${deliveryFee.toLocaleString()} so'm\nUmumiy hisob: ${totalCartPrice.toLocaleString()} so'm\nTo'lov turi: ${methodText}\nManzil: ${deliveryAddress || 'Xaritada tanlangan lokatsiya'}`)) {
      return
    }
    setOrdering(true)

    try {
      const res = await fetch('/api/customer/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramId,
          items: cart.map(i => ({ id: i.id, quantity: i.quantity })),
          product_id: cart[0].id,
          quantity: totalCartItems,
          delivery_address: deliveryAddress || `GPS: ${customerCoords.lat.toFixed(5)}, ${customerCoords.lon.toFixed(5)}`,
          customer_lat: customerCoords.lat,
          customer_lon: customerCoords.lon,
          payment_method: paymentMethod
        })
      })
      const data = await res.json()
      if (res.ok) {
        setCart([])
        setShowCartModal(false)
        onOrderCreated(data.order_id)
      } else {
        alert(data.error || 'Buyurtma berishda xatolik!')
      }
    } catch {
      alert('Xatolik yuz berdi!')
    } finally {
      setOrdering(false)
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Taomnoma yuklanmoqda...</div>

  return (
    <div className="space-y-4 pb-16">
      {/* Yetkazib berish xizmati ta'rifi banner */}
      <div className="bg-gradient-to-r from-orange-500/15 via-amber-500/10 to-orange-500/15 border border-orange-500/40 rounded-2xl p-3 flex items-center gap-3 shadow-sm">
        <span className="text-2xl">🛵</span>
        <div className="text-xs">
          <p className="font-bold text-orange-200">Yetkazib berish ta'rifi:</p>
          <p className="text-gray-300 text-[11px] leading-relaxed">
            Kuryer ulushi <b>1 km = {pricePerKm.toLocaleString()} so'm</b> (masofaga qarab hisoblanadi). Buyurtma berishda kuryer ulushi va umumiy hisob avtomatik ko'rsatiladi.
          </p>
        </div>
      </div>

      {/* Do'konlar / Sotuvchilar gorizontal filtri */}
      <div>
        <p className="text-xs text-gray-400 mb-2 font-semibold uppercase tracking-wider flex items-center justify-between">
          <span>🏪 Restoranlar & Savdo punktlari</span>
          <span className="text-[11px] text-orange-400 font-normal">Jami: {catalog.length} ta do'kon</span>
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1.5 no-scrollbar">
          {catalog.map(seller => {
            const isMe = String(seller.telegram_id) === String(telegramId);
            const totalProds = (seller.categories || []).reduce((acc, c) => acc + (c.products?.length || 0), 0);
            return (
              <button
                key={seller.id}
                onClick={() => {
                  setActiveSellerId(seller.id);
                  setSelectedCatFilter('all');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-1.5 transition-all shadow-sm ${
                  currentSeller?.id === seller.id
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25 ring-2 ring-orange-400'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
                }`}
              >
                <span>🏪</span>
                <span>{seller.point_name || `${seller.first_name} do'koni`}</span>
                {isMe && <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">Sizniki 🌟</span>}
                <span className="text-[10px] opacity-75">({totalProds})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tanlangan do'kon sarlavhasi va Bo'limlar (Kategoriyalar) filtri */}
      {currentSeller && currentSeller.categories && currentSeller.categories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
            <button
              onClick={() => setSelectedCatFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                selectedCatFilter === 'all'
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'bg-gray-800 text-gray-300 hover:text-white border border-gray-700'
              }`}
            >
              Hammasi
            </button>
            {currentSeller.categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCatFilter(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                  selectedCatFilter === cat.id
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'bg-gray-800 text-gray-300 hover:text-white border border-gray-700'
                }`}
              >
                <span>📂</span>
                <span>{cat.name}</span>
                <span className="text-[10px] bg-black/25 px-1.5 rounded-full font-semibold">
                  {cat.products?.length || 0}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tanlangan sotuvchi kategoriyalari va mahsulotlari */}
      {(!currentSeller || !currentSeller.categories || currentSeller.categories.length === 0) ? (
        <div className="card text-center text-gray-400 py-12 space-y-2">
          <p className="text-4xl">🍕</p>
          <p className="font-semibold text-white">Bu sotuvchida bo'limlar hali kiritilmagan</p>
          <p className="text-xs text-gray-500">Sotuvchi o'z panelidan bo'lim va taomlarni qo'shgach bu yerda ko'rinadi</p>
        </div>
      ) : (
        <div className="space-y-6">
          {currentSeller.categories
            .filter(cat => selectedCatFilter === 'all' || selectedCatFilter === cat.id)
            .map(cat => (
              <div key={cat.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-orange-400 flex items-center gap-2">
                    <span>📂</span>
                    <span>{cat.name}</span>
                    <span className="text-xs text-gray-400 font-normal">({cat.products?.length || 0} ta taom)</span>
                  </h3>
                </div>

                {(!cat.products || cat.products.length === 0) ? (
                  <div className="bg-gray-800/40 border border-dashed border-gray-700/60 rounded-xl p-4 text-center text-xs text-gray-400 space-y-1">
                    <p className="text-base">🍽️</p>
                    <p className="font-semibold text-gray-300">Ushbu bo'limda hozircha taom yo'q</p>
                    <p className="text-[11px] text-gray-500">Sotuvchi ushbu bo'limga taom qo'shgach bu yerda chiqadi</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {cat.products.map(prod => {
                      const qtyInCart = getProductQty(prod.id)
                      return (
                        <div
                          key={prod.id}
                          className="bg-gray-800/95 rounded-2xl border border-gray-700/70 overflow-hidden flex flex-col justify-between shadow-md card-hover"
                        >
                          {/* Rasm tepada, narxi yonboshda */}
                          <div className="h-32 bg-gray-900 w-full relative overflow-hidden">
                            {prod.photo_url ? (
                              <img src={prod.photo_url} alt={prod.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-4xl">🍕</div>
                            )}
                            <span className="absolute top-2 right-2 bg-orange-500 text-white font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-lg">
                              {Number(prod.price || 0).toLocaleString()} so'm
                            </span>
                          </div>

                          {/* Nomi, og'irligi va mavjud qoldig'i pastda */}
                          <div className="p-3 space-y-2 flex-1 flex flex-col justify-between">
                            <div>
                              <div className="flex items-baseline justify-between gap-1">
                                <h4 className="text-xs font-bold text-white line-clamp-1">{prod.name}</h4>
                              </div>
                              <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                                <span>⚖️ {prod.weight || 'Standart'}</span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  (prod.stock ?? 10) > 0 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' : 'bg-red-950 text-red-300 border border-red-700'
                                }`}>
                                  {(prod.stock ?? 10) > 0 ? `Qoldiq: ${prod.stock ?? 10} ta` : 'Tugagan'}
                                </span>
                              </div>
                            </div>

                            {(prod.stock ?? 10) <= 0 ? (
                              <button
                                disabled
                                className="w-full py-2 rounded-xl bg-gray-800 text-gray-500 text-xs font-bold border border-gray-700 cursor-not-allowed"
                              >
                                🚫 Tugagan (0 ta)
                              </button>
                            ) : qtyInCart === 0 ? (
                              <button
                                onClick={() => addToCart(prod)}
                                className="w-full py-2 rounded-xl bg-orange-500/20 text-orange-400 hover:bg-orange-500 hover:text-white text-xs font-bold transition-colors border border-orange-500/30"
                              >
                                🛒 Savatchaga qo'shish
                              </button>
                            ) : (
                              <div className="flex items-center justify-between bg-gray-900 rounded-xl p-1 border border-orange-500">
                                <button
                                  onClick={() => updateCartQty(prod.id, -1)}
                                  className="w-7 h-7 rounded-lg bg-gray-800 text-white font-bold"
                                >
                                  −
                                </button>
                                <span className="text-xs font-extrabold text-orange-400">{qtyInCart} ta</span>
                                <button
                                  onClick={() => updateCartQty(prod.id, 1)}
                                  className="w-7 h-7 rounded-lg bg-orange-500 text-white font-bold"
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
        </div>
      )}

      {/* Floating Cart Bar */}
      {totalCartItems > 0 && (
        <div className="fixed bottom-16 left-3 right-3 z-40">
          <button
            onClick={() => setShowCartModal(true)}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-2xl p-3.5 shadow-2xl flex items-center justify-between font-bold"
          >
            <div className="flex items-center gap-2.5">
              <span className="bg-black/25 px-2.5 py-1 rounded-xl text-xs">🛒 {totalCartItems} ta</span>
              <div className="text-left">
                <span className="text-sm block leading-tight">Savatchani ko'rish</span>
                <span className="text-[10px] text-orange-100 font-normal">
                  Kuryer: +{deliveryFee.toLocaleString()} so'm {distanceKm !== null ? `(~${distanceKm} km)` : '(1 km)'}
                </span>
              </div>
            </div>
            <span className="text-sm font-extrabold">{totalCartPrice.toLocaleString()} so'm ➔</span>
          </button>
        </div>
      )}

      {/* Savatcha va Buyurtma rasmiylashtirish Modali */}
      {showCartModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCartModal(false)}>
          <div className="modal-content space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-700/60">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">🛒 Savatcha va Buyurtma</h3>
                <span className="text-[11px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-bold">{totalCartItems} ta</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Savatchadagi barcha mahsulotlarni bekor qilib tozalaysizmi?")) {
                      setCart([])
                      setShowCartModal(false)
                    }
                  }}
                  className="text-[11px] text-red-400 hover:text-red-300 font-semibold px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-1 transition-all"
                  title="Savatchani tozalash"
                >
                  🗑️ Tozalash
                </button>
                <button onClick={() => setShowCartModal(false)} className="text-gray-400 hover:text-white text-xl px-1">✕</button>
              </div>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {cart.map(item => (
                <div key={item.id} className="bg-gray-900 rounded-xl p-3 flex items-center justify-between border border-gray-700">
                  <div>
                    <p className="text-xs font-bold text-white">{item.name}</p>
                    <p className="text-[11px] text-orange-400">
                      {Number(item.price).toLocaleString()} so'm {item.weight ? `• ${item.weight}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateCartQty(item.id, -1)}
                      className="w-7 h-7 rounded-lg bg-gray-800 text-white font-bold"
                    >
                      −
                    </button>
                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateCartQty(item.id, 1)}
                      className="w-7 h-7 rounded-lg bg-orange-500 text-white font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Xaritada lokatsiyani tanlash va GPS orqali topish */}
            <LocationPickerMap
              lat={customerCoords?.lat}
              lon={customerCoords?.lon}
              storeLat={currentSeller?.lat}
              storeLon={currentSeller?.lon}
              storeName={currentSeller?.point_name || currentSeller?.first_name || 'Do\'kon'}
              onChange={({ lat, lon, address }) => {
                setCustomerCoords({ lat, lon })
                if (address) setDeliveryAddress(address)
              }}
              height={230}
              required={true}
            />

            <div>
              <label className="text-xs text-gray-400 block mb-1">
                🏢 Qo'shimcha manzil (Uy, xonadon, qavat, mo'ljal):
              </label>
              <input
                className="input text-xs"
                value={deliveryAddress}
                onChange={e => setDeliveryAddress(e.target.value)}
                placeholder="Masalan: 4-uy, 2-qavat, 15-xonadon, domofon kodi 123..."
              />
            </div>

            {/* To'lov usulini tanlash: Karta orqali yoki Naqd pul */}
            <div className="space-y-1.5 pt-1">
              <label className="text-xs text-gray-300 font-bold block">
                💰 To'lov usulini tanlang:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-lg ring-2 ring-orange-500/50'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-2xl">💳</span>
                  <span className="text-white">Karta orqali</span>
                  <span className="text-[10px] text-gray-400 font-normal">Humo / Uzcard</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-green-500/20 border-green-500 text-green-400 shadow-lg ring-2 ring-green-500/50'
                      : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white'
                  }`}
                >
                  <span className="text-2xl">💵</span>
                  <span className="text-white">Naqd pul</span>
                  <span className="text-[10px] text-gray-400 font-normal">Yetkazilganda</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-gray-700">
              <div className="flex justify-between items-center text-xs text-gray-300">
                <span>📦 Mahsulotlar summasi:</span>
                <span className="font-semibold text-white">{productsPrice.toLocaleString()} so'm</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-300">
                  🚴 Kuryer ulushi {distanceKm !== null ? `(~${distanceKm} km × ${pricePerKm.toLocaleString()} so'm)` : `(1 km = ${pricePerKm.toLocaleString()} so'm)`}:
                </span>
                <span className="font-bold text-blue-400">+{deliveryFee.toLocaleString()} so'm</span>
              </div>
              {distanceKm === null && (
                <div className="text-[11px] text-blue-300 bg-blue-950/50 p-2 rounded-xl border border-blue-800/50 flex items-center gap-1.5">
                  <span>📍</span>
                  <span>Aniq masofani hisoblash uchun xaritada manzilingizni belgilang (1 km = {pricePerKm.toLocaleString()} so'm).</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-1.5 border-t border-gray-700/60">
                <span className="text-xs font-bold text-gray-200">💰 Umumiy hisob:</span>
                <span className="text-lg font-extrabold text-green-400">{totalCartPrice.toLocaleString()} so'm</span>
              </div>
            </div>

            {!customerCoords?.lat && (
              <div className="bg-red-950/70 border border-red-500/70 p-2.5 rounded-xl text-center space-y-1">
                <p className="text-xs text-red-200 font-bold">
                  ⚠️ Joylashuvingiz belgilanmagan!
                </p>
                <p className="text-[11px] text-gray-300">
                  Buyurtma berish uchun yuqoridagi <b>"📡 GPS orqali aniqlash"</b> tugmasini bosing yoki xaritada uyingizni tanlang.
                </p>
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={ordering || !customerCoords?.lat}
              className={`w-full text-sm font-bold py-3.5 rounded-xl shadow-lg transition-all ${
                !customerCoords?.lat
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : paymentMethod === 'cash'
                  ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white'
                  : 'btn-primary'
              }`}
            >
              {ordering
                ? '⏳ Yuborilmoqda...'
                : !customerCoords?.lat
                ? '📍 Avval xaritada lokatsiyani belgilang'
                : paymentMethod === 'cash'
                ? '💵 Buyurtmani tasdiqlash (Naqd to\'lov)'
                : '💳 Buyurtma berish va To\'lovga o\'tish'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
