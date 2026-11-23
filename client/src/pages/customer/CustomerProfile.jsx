import { useState, useEffect, useRef } from 'react'
import LocationPickerMap from '../../components/LocationPickerMap'
import LegalConsentModal from '../../components/LegalConsentModal'

export default function CustomerProfile({ telegramId, onGoToOrders, onGoToPayment }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', phone: '', address: '', lat: '', lon: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [locating, setLocating] = useState(false)
  const [showLegalModal, setShowLegalModal] = useState(null)
  const fileRef = useRef()

  // Buyurtmalar tarixi
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(true)
  const [orderFilter, setOrderFilter] = useState('all') // 'all', 'active', 'delivered'
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
        loadOrders()
      } else {
        alert(data.error || 'Buyurtmani bekor qilishda xatolik yuz berdi')
      }
    } catch {
      alert('Serverga ulanishda xatolik yuz berdi!')
    } finally {
      setCancellingId(null)
    }
  }

  // Shikoyat va taklif
  const [feedbackText, setFeedbackText] = useState('')
  const [feedbackType, setFeedbackType] = useState('suggestion')
  const [sendingFeedback, setSendingFeedback] = useState(false)
  const [feedbackSent, setFeedbackSent] = useState(false)

  const loadProfile = () => {
    if (!telegramId) return
    fetch(`/api/customer/profile/${telegramId}?tid=${telegramId}`, {
      headers: {
        'x-telegram-id': String(telegramId)
      }
    })
      .then(r => r.json())
      .then(data => {
        if (!data || data.error) return
        setProfile(data)
        setForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          username: data.username ? data.username.replace('@', '') : '',
          phone: data.phone || '',
          address: data.address || '',
          lat: data.lat || '',
          lon: data.lon || ''
        })
      })
      .catch(() => {})
  }

  const loadOrders = () => {
    if (!telegramId) return
    setOrdersLoading(true)
    fetch(`/api/customer/orders/${telegramId}?tid=${telegramId}`, {
      headers: {
        'x-telegram-id': String(telegramId)
      }
    })
      .then(r => r.json())
      .then(data => {
        setOrders(Array.isArray(data) ? data : [])
        setOrdersLoading(false)
      })
      .catch(() => setOrdersLoading(false))
  }

  useEffect(() => {
    loadProfile()
    loadOrders()
  }, [telegramId])

  const handleSave = async () => {
    if (!telegramId) return
    setSaving(true)
    try {
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v ?? ''))
      fd.append('telegramId', String(telegramId))

      const res = await fetch(`/api/customer/profile/${telegramId}?tid=${telegramId}`, {
        method: 'PUT',
        headers: {
          'x-telegram-id': String(telegramId)
        },
        body: fd
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setSaved(true)
        if (data.user) {
          setProfile(data.user)
          setForm({
            first_name: data.user.first_name || '',
            last_name: data.user.last_name || '',
            username: data.user.username ? data.user.username.replace('@', '') : '',
            phone: data.user.phone || '',
            address: data.user.address || '',
            lat: data.user.lat || '',
            lon: data.user.lon || ''
          })
        }
        setTimeout(() => setSaved(false), 2000)
      } else {
        alert(data.error || 'Saqlashda xatolik yuz berdi')
      }
    } catch {
      alert('Serverga ulanishda xatolik yuz berdi')
    } finally {
      setSaving(false)
    }
  }

  const handlePhoto = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const fd = new FormData()
    fd.append('photo', file)
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    const res = await fetch(`/api/customer/profile/${telegramId}?tid=${telegramId}`, {
      method: 'PUT',
      headers: {
        'x-telegram-id': String(telegramId)
      },
      body: fd
    })
    if (res.ok) loadProfile()
  }

  const handleDetectGps = () => {
    setLocating(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setForm(f => ({
            ...f,
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            address: f.address || `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          }))
          setLocating(false)
        },
        () => {
          alert("⚠️ Joylashuvni aniqlab bo'lmadi. Iltimos, telefoningizda GPS (geolokatsiya)ni yoqing!")
          setLocating(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      alert("⚠️ Qurilmangizda GPS qo'llab-quvvatlanmadi.")
      setLocating(false)
    }
  }

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) return
    setSendingFeedback(true)
    await fetch('/api/customer/complaints', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramId, text: feedbackText, type: feedbackType })
    })
    setFeedbackText('')
    setSendingFeedback(false)
    setFeedbackSent(true)
    setTimeout(() => setFeedbackSent(false), 3000)
    loadProfile()
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

  const getStatusBadge = (order) => {
    if (order.status === 'delivered') {
      return { text: '✅ Yetkazildi', cls: 'bg-green-900/60 text-green-300 border-green-700' }
    }
    if (order.status === 'delivering') {
      return { text: '🚴 Yo\'lda (Kuryerda)', cls: 'bg-blue-900/60 text-blue-300 border-blue-700' }
    }
    if (order.status === 'accepted') {
      return { text: '📦 Kuryerga berilmoqda', cls: 'bg-purple-900/60 text-purple-300 border-purple-700' }
    }
    if (order.status === 'ready') {
      return { text: '🧑‍🍳 Tayyorlanmoqda', cls: 'bg-purple-900/60 text-purple-300 border-purple-700' }
    }
    if (order.status === 'paid_waiting') {
      return { text: '⏳ Chek tekshirilmoqda', cls: 'bg-yellow-900/60 text-yellow-300 border-yellow-700' }
    }
    if (order.status === 'cancelled') {
      return { text: '❌ Bekor qilingan', cls: 'bg-red-900/60 text-red-300 border-red-700' }
    }
    if (order.status === 'rejected') {
      return { text: '❌ Rad etilgan', cls: 'bg-red-900/60 text-red-300 border-red-700' }
    }
    if (order.payment_method === 'cash') {
      return { text: '💵 Naqd buyurtma', cls: 'bg-emerald-950/80 text-emerald-300 border-emerald-700' }
    }
    return { text: '💳 To\'lov kutilmoqda', cls: 'bg-orange-950/80 text-orange-300 border-orange-700' }
  }

  // Filtrlash: all, active, delivered
  const activeOrdersList = orders.filter(o => !['delivered', 'cancelled', 'rejected'].includes(o.status))
  const deliveredOrdersList = orders.filter(o => o.status === 'delivered')
  const filteredOrders = orderFilter === 'active' 
    ? activeOrdersList 
    : orderFilter === 'delivered' 
      ? deliveredOrdersList 
      : orders

  return (
    <div className="space-y-5">
      {/* Profil Header */}
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <label
            htmlFor="cust-profile-photo"
            className="w-24 h-24 rounded-full bg-orange-500/20 border-4 border-orange-500 overflow-hidden flex items-center justify-center text-4xl shadow-lg cursor-pointer relative block"
          >
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              '👤'
            )}
          </label>
          <label
            htmlFor="cust-profile-photo"
            className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-md cursor-pointer"
          >
            📷
          </label>
          <input
            id="cust-profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
            onChange={handlePhoto}
            className="sr-only"
          />
        </div>
        <div className="text-center">
          <label
            htmlFor="cust-profile-photo"
            className="text-xs text-orange-400 font-bold hover:underline cursor-pointer block mb-1"
          >
            📷 Rasm yuklash / o'zgartirish
          </label>
          <h2 className="text-lg font-bold text-white">{form.first_name || 'Mijoz'} {form.last_name}</h2>
        </div>
        <p className="text-xs text-gray-400">@{form.username || 'mijoz'}</p>
        <span className="text-xs bg-gray-800 border border-gray-700 px-3 py-1 rounded-full text-orange-400 font-semibold">
          🛍️ {profile?.total_orders || orders.length || 0} ta xarid qilingan
        </span>
      </div>

      {/* Profil va Yetkazib berish manzili */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-white">👤 Shaxsiy ma'lumotlar va Manzil</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Ism</label>
            <input
              className="input"
              value={form.first_name}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Ismingiz"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Familiya</label>
            <input
              className="input"
              value={form.last_name}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Familiyangiz"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Telegram Username</label>
          <input
            className="input"
            value={form.username ? `@${form.username.replace('@', '')}` : ''}
            onChange={e => setForm(f => ({ ...f, username: e.target.value.replace('@', '') }))}
            placeholder="@username"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Telefon raqam</label>
          <input
            className="input"
            value={form.phone}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
            placeholder="+998 90 123 45 67"
          />
        </div>
        {/* Xaritada yetkazib berish manzilini belgilash */}
        <div className="space-y-2">
          <LocationPickerMap
            lat={form.lat ? Number(form.lat) : null}
            lon={form.lon ? Number(form.lon) : null}
            onChange={({ lat, lon, address }) => {
              setForm(f => ({
                ...f,
                lat,
                lon,
                address: address || f.address
              }))
            }}
            height={200}
            required={true}
          />
          <div>
            <label className="text-xs text-gray-400 block mb-1">
              🏢 Qo'shimcha manzil ma'lumotlari (Uy, xonadon, qavat, mo'ljal):
            </label>
            <input
              className="input text-xs"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="Masalan: Yunusobod tumani, 12-mavze, 5-uy, 24-xonadon"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`btn-primary w-full text-xs font-bold py-3 ${saved ? 'bg-green-600' : ''}`}
        >
          {saving ? '⏳ Saqlanmoqda...' : saved ? '✅ Saqlandi' : '💾 Ma\'lumotlarni saqlash'}
        </button>
      </div>

      {/* 📦 Mening buyurtmalarim (Xaridlar tarixi va faol buyurtmalar) */}
      <div className="card space-y-4 border border-orange-500/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📦</span>
            <div>
              <h3 className="text-sm font-bold text-white">Mening buyurtmalarim</h3>
              <p className="text-[10px] text-gray-400">Xaridlar tarixi va faol holatlar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={loadOrders}
            className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-semibold"
            title="Yangilash"
          >
            🔄 Yangilash
          </button>
        </div>

        {/* Filtr tugmalari */}
        <div className="flex gap-1.5 p-1 bg-gray-900 rounded-xl border border-gray-800 text-xs">
          <button
            type="button"
            onClick={() => setOrderFilter('all')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              orderFilter === 'all' ? 'bg-orange-500 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Barchasi ({orders.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderFilter('active')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              orderFilter === 'active' ? 'bg-orange-500 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Faol ({activeOrdersList.length})
          </button>
          <button
            type="button"
            onClick={() => setOrderFilter('delivered')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              orderFilter === 'delivered' ? 'bg-green-600 text-white shadow' : 'text-gray-400 hover:text-white'
            }`}
          >
            Yetkazildi ({deliveredOrdersList.length})
          </button>
        </div>

        {ordersLoading ? (
          <div className="text-center text-gray-400 py-6 text-xs">⏳ Buyurtmalar yuklanmoqda...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-6 space-y-2 bg-gray-900/60 rounded-xl border border-gray-800">
            <span className="text-3xl block">🛍️</span>
            <p className="text-xs text-gray-300 font-medium">
              {orderFilter === 'active'
                ? 'Hozirda faol buyurtmalaringiz yo\'q'
                : orderFilter === 'delivered'
                ? 'Hali yakunlangan xaridlar yo\'q'
                : 'Siz hali birorta buyurtma bermagansiz'}
            </p>
            {onGoToOrders && (
              <button
                type="button"
                onClick={onGoToOrders}
                className="text-xs text-orange-400 hover:underline font-semibold"
              >
                🍕 Taomnomaga o'tish va buyurtma berish ➔
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredOrders.map(order => {
              const badge = getStatusBadge(order)
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
                  className="bg-gray-900/90 rounded-xl p-3.5 border border-gray-700/80 space-y-2.5 shadow hover:border-gray-600 transition-all"
                >
                  {/* Tepa qism: Yanglishib bosilganda buyurtmani bekor qilish tugmasi */}
                  {['pending', 'paid_waiting', 'ready', 'accepted'].includes(order.status) && (
                    <div className="flex items-center justify-between pb-2 mb-1 border-b border-gray-800 bg-red-950/20 -mx-3.5 -mt-3.5 px-3.5 py-2 rounded-t-xl">
                      <span className="text-[11px] text-gray-300 flex items-center gap-1 font-medium">
                        <span className="text-orange-400">⚠️</span> Yanglishib bosildimi?
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCancelOrder(order.id)}
                        disabled={cancellingId === order.id}
                        className="bg-red-500/20 hover:bg-red-500/30 text-red-300 hover:text-red-200 border border-red-500/50 px-2.5 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 shadow-sm"
                      >
                        <span>❌</span>
                        <span>{cancellingId === order.id ? 'Bekor qilinmoqda...' : 'Zakazni bekor qilish'}</span>
                      </button>
                    </div>
                  )}

                  {/* Buyurtma sarlavhasi va statusi */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-orange-400 font-bold">#{order.id}</span>
                        <span className="text-[11px] text-gray-400">{formatDateTime(order.created_at)}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-0.5">
                        {order.seller_point || order.seller_name || 'Restoran'}
                      </h4>
                    </div>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold whitespace-nowrap ${badge.cls}`}>
                      {badge.text}
                    </span>
                  </div>

                  {/* Taomlar ro'yxati */}
                  <div className="bg-gray-800/60 rounded-lg p-2.5 text-xs text-gray-300 space-y-1">
                    {itemsList.length > 0 ? (
                      itemsList.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className="truncate pr-2">
                            • {item.name || item.product_name} <span className="text-orange-400 font-semibold">x{item.quantity || 1}</span>
                          </span>
                          <span className="font-mono text-gray-300 whitespace-nowrap">
                            {((item.price || 0) * (item.quantity || 1)).toLocaleString()} so'm
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="truncate pr-2">
                          • {order.product_name || 'Taom'} <span className="text-orange-400 font-semibold">x{order.quantity || 1}</span>
                        </span>
                        <span className="font-mono text-gray-300 whitespace-nowrap">
                          {(order.total_price || 0).toLocaleString()} so'm
                        </span>
                      </div>
                    )}
                  </div>

                  {/* To'lov turi va Jami summa */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-800">
                    <div>
                      {order.payment_method === 'cash' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400">
                          💵 Naqd pul
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-400">
                          💳 Karta orqali
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-gray-400 block">Jami summa:</span>
                      <span className="text-sm font-bold text-orange-400 font-mono">
                        {(order.total_price || 0).toLocaleString()} so'm
                      </span>
                    </div>
                  </div>

                  {/* Yetkazib berish PIN-kodi (faol bosqichlarda) */}
                  {order.delivery_pin_code && ['ready', 'accepted', 'delivering'].includes(order.status) && (
                    <div className="bg-gradient-to-r from-orange-600/20 via-amber-600/20 to-orange-500/20 border border-orange-500/50 rounded-lg p-2 flex items-center justify-between">
                      <span className="text-xs text-orange-200 font-medium">🔑 Yetkazib berish PIN-kodi:</span>
                      <span className="font-mono text-base font-black text-orange-300 tracking-widest bg-black/40 px-2 py-0.5 rounded border border-orange-500/40">
                        {order.delivery_pin_code}
                      </span>
                    </div>
                  )}

                  {/* Tugmalar */}
                  <div className="flex gap-2 pt-1">
                    {onGoToOrders && (
                      <button
                        type="button"
                        onClick={onGoToOrders}
                        className="flex-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white rounded-lg py-2 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      >
                        <span>🗺️</span>
                        <span>Xaritada kuzatish</span>
                      </button>
                    )}
                    {order.status === 'pending' && order.payment_method === 'card' && onGoToPayment && (
                      <button
                        type="button"
                        onClick={() => onGoToPayment(order.id)}
                        className="flex-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow transition-all"
                      >
                        <span>💳</span>
                        <span>Chek yuklash</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* To'liq buyurtmalar bo'limiga o'tish havolasi */}
        {orders.length > 0 && onGoToOrders && (
          <button
            type="button"
            onClick={onGoToOrders}
            className="w-full bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-xl py-2.5 text-xs font-bold transition-all text-center"
          >
            📦 Barcha buyurtmalarni to'liq kuzatish (Xarita va Kuryer) ➔
          </button>
        )}
      </div>

      {/* Admindan kelgan sovg'alar qutisi (Ayiqcha, gul, olmos va h.k.) */}
      <div className="card space-y-3 bg-gradient-to-br from-pink-950/40 to-purple-950/40 border border-pink-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎁</span>
            <div>
              <h3 className="text-sm font-bold text-pink-300">Sovg'alar qutisi (Virtual Gifts)</h3>
              <p className="text-[10px] text-pink-200/70">Admin tomonidan yuborilgan Telegram sovg'alari</p>
            </div>
          </div>
          <span className="bg-pink-500/20 text-pink-300 border border-pink-500/40 text-xs font-bold px-2.5 py-0.5 rounded-full">
            {profile?.gifts?.length || 0} ta
          </span>
        </div>

        {(!profile?.gifts || profile.gifts.length === 0) ? (
          <p className="text-xs text-gray-400 py-3 text-center">
            Hozircha sovg'alar qutisi bo'sh. Faol mijozlarga Admin tomonidan 🐻 Ayiqcha, 🌸 Atirgul va 💎 Olmos sovg'alari yuboriladi!
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-2.5 pt-1">
            {profile.gifts.map((g, i) => (
              <div key={i} className="bg-gray-900/90 rounded-xl p-2.5 text-center border border-pink-700/40 shadow">
                <span className="text-3xl block">{g.gift_emoji}</span>
                <span className="text-[10px] text-pink-200 mt-1 block truncate font-medium">{g.gift_name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Shikoyat va takliflar */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-white">✍️ Shikoyat va takliflar qoldirish</h3>
        <p className="text-xs text-gray-400">Fikringiz to'g'ridan-to'g'ri Admin paneliga va Admin botiga borib tushadi:</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setFeedbackType('suggestion')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${feedbackType === 'suggestion' ? 'bg-orange-500 text-white shadow' : 'bg-gray-700 text-gray-300'}`}
          >
            💡 Taklif yozish
          </button>
          <button
            type="button"
            onClick={() => setFeedbackType('complaint')}
            className={`flex-1 py-2 rounded-xl text-xs font-semibold transition-all ${feedbackType === 'complaint' ? 'bg-red-500 text-white shadow' : 'bg-gray-700 text-gray-300'}`}
          >
            ⚠️ Shikoyat yozish
          </button>
        </div>

        <textarea
          className="input h-24 text-xs resize-none"
          value={feedbackText}
          onChange={e => setFeedbackText(e.target.value)}
          placeholder="Shikoyat yoki taklifingizni shu yerga yozing..."
        />

        <button
          onClick={handleSendFeedback}
          disabled={sendingFeedback}
          className="btn-secondary w-full text-xs font-bold py-2.5"
        >
          {sendingFeedback ? '⏳ Yuborilmoqda...' : '📨 Adminga yuborish'}
        </button>

        {feedbackSent && (
          <p className="text-xs text-green-400 text-center font-semibold">✅ Murojaatingiz Adminga muvaffaqiyatli yuborildi!</p>
        )}
      </div>

      {/* ⚖️ Rasmiy Hujjatlar (Ommaviy oferta va Maxfiylik siyosati) */}
      <div className="card space-y-2 bg-gray-800/80 border border-gray-700">
        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
          <span>⚖️</span> Hujjatlar va Xavfsizlik
        </h3>
        <p className="text-[11px] text-gray-400">
          Oʻzbekiston Respublikasi qonunlariga muvofiq rasmiy foydalanish qoidalari:
        </p>
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setShowLegalModal('oferta')}
            className="p-2.5 bg-gray-900 hover:bg-gray-700/80 border border-gray-700 rounded-xl text-left transition-all flex items-center gap-2"
          >
            <span className="text-xl">📄</span>
            <div>
              <p className="text-xs font-bold text-white">Ommaviy oferta</p>
              <p className="text-[10px] text-gray-400">Foydalanuvchi shartnomasi</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setShowLegalModal('privacy')}
            className="p-2.5 bg-gray-900 hover:bg-gray-700/80 border border-gray-700 rounded-xl text-left transition-all flex items-center gap-2"
          >
            <span className="text-xl">🔒</span>
            <div>
              <p className="text-xs font-bold text-white">Maxfiylik siyosati</p>
              <p className="text-[10px] text-gray-400">Shaxsiy ma'lumotlar</p>
            </div>
          </button>
        </div>
      </div>

      {/* Yuridik hujjatlarni o'qish modali */}
      {showLegalModal && (
        <LegalConsentModal
          telegramId={telegramId}
          isReadOnly={true}
          onClose={() => setShowLegalModal(null)}
        />
      )}
    </div>
  )
}
