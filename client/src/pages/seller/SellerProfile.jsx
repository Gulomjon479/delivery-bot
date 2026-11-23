import { useState, useEffect, useRef } from 'react'

export default function SellerProfile({ telegramId }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    point_name: '',
    address: '',
    lat: '',
    lon: '',
    card_number: '',
    card_holder: ''
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [locating, setLocating] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const [msgText, setMsgText] = useState('')
  const [showMsg, setShowMsg] = useState(false)
  const [messages, setMessages] = useState([])
  const fileRef = useRef()

  const loadProfile = () => {
    fetch(`/api/seller/profile/${telegramId}`)
      .then(r => r.json())
      .then(data => {
        setProfile(data)
        setIsOpen(data.is_open !== 0)
        setForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          point_name: data.point_name || '',
          address: data.address || '',
          lat: data.lat || '',
          lon: data.lon || '',
          card_number: data.card_number || '',
          card_holder: data.card_holder || ''
        })
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadProfile()
  }, [telegramId])

  const handleGetLocation = () => {
    setLocating(true)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setForm(f => ({
            ...f,
            lat: pos.coords.latitude.toFixed(6),
            lon: pos.coords.longitude.toFixed(6),
            address: f.address || `GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`
          }))
          setLocating(false)
        },
        () => {
          alert("⚠️ Joylashuvni aniqlab bo'lmadi. Iltimos qurilmangizda GPS (geolokatsiya)ni yoqing va ruxsat bering!")
          setLocating(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      alert("⚠️ Qurilmangizda GPS qo'llab-quvvatlanmadi.")
      setLocating(false)
    }
  }

  const handleSave = async () => {
    if (!telegramId) return
    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([k, v]) => formData.append(k, v ?? ''))
      formData.append('telegramId', String(telegramId))

      const res = await fetch(`/api/seller/profile/${telegramId}?tid=${telegramId}`, {
        method: 'PUT',
        headers: {
          'x-telegram-id': String(telegramId)
        },
        body: formData
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        loadProfile()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Saqlashda xatolik yuz berdi')
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
    const formData = new FormData()
    formData.append('photo', file)
    Object.entries(form).forEach(([k, v]) => formData.append(k, v))

    const res = await fetch(`/api/seller/profile/${telegramId}?tid=${telegramId}`, {
      method: 'PUT',
      headers: {
        'x-telegram-id': String(telegramId)
      },
      body: formData
    })
    if (res.ok) loadProfile()
  }

  const toggleStoreOpen = async () => {
    const next = !isOpen
    setIsOpen(next)
    try {
      await fetch('/api/seller/toggle-open', { method: 'POST' })
    } catch {}
  }

  const loadMessages = () => {
    if (!profile?.id) return
    fetch(`/api/admin/messages/${profile.id}/1`)
      .then(r => r.json())
      .then(setMessages)
      .catch(() => {})
  }

  const sendMsgToAdmin = async () => {
    if (!msgText.trim() || !profile?.id) return
    await fetch('/api/admin/messages/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from_user_id: profile.id, to_user_id: 1, text: msgText })
    })
    setMsgText('')
    loadMessages()
  }

  return (
    <div className="space-y-6">
      {/* Avatar & Punkt */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <label
            htmlFor="seller-profile-photo"
            className="w-24 h-24 rounded-full bg-gray-800 border-4 border-orange-500 overflow-hidden flex items-center justify-center cursor-pointer shadow-xl relative block"
          >
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="seller" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">🏪</span>
            )}
          </label>
          <label
            htmlFor="seller-profile-photo"
            className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-md cursor-pointer"
          >
            📷
          </label>
          <input
            id="seller-profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
            onChange={handlePhoto}
            className="sr-only"
          />
        </div>
        <div className="text-center">
          <label
            htmlFor="seller-profile-photo"
            className="text-xs text-orange-400 font-bold hover:underline cursor-pointer block mb-1"
          >
            📷 Profil rasmini tanlash
          </label>
          <h2 className="text-lg font-bold text-white">{profile?.first_name} {profile?.last_name}</h2>
          <p className="text-sm text-orange-400 font-semibold">📍 {profile?.point_name || 'Savdo punkti'}</p>
          <p className="text-xs text-gray-400">@{profile?.username || 'sotuvchi'}</p>
        </div>
      </div>

      {/* Do'kon Ochiq / Yopiq Switch */}
      <div className="card bg-gray-800/90 border border-gray-700 p-4 flex items-center justify-between shadow-lg">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🏪</span>
            <span>Do'kon holati:</span>
            <span className={isOpen ? 'text-green-400 font-extrabold' : 'text-red-400 font-extrabold'}>
              {isOpen ? 'OCHIQ' : 'YOPIQ'}
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {isOpen ? 'Mijozlar buyurtma bera oladi' : 'Do\'kon yopilgan, yangi buyurtma qabul qilinmaydi'}
          </p>
        </div>
        <button
          onClick={toggleStoreOpen}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-1.5 ${
            isOpen
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-red-600 hover:bg-red-500 text-white'
          }`}
        >
          <span>{isOpen ? '🟢 Ochiq' : '🔴 Yopiq'}</span>
          <span className="text-[10px] opacity-80">(O'zgartirish)</span>
        </button>
      </div>

      {/* Profil Form */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wider">Do'kon / Punkt ma'lumotlari</h3>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Savdo punkti (filial / restoran) nomi</label>
          <input
            className="input"
            value={form.point_name}
            onChange={e => setForm(f => ({ ...f, point_name: e.target.value }))}
            placeholder="Masalan: Rayhon Milliy Taomlari (Chilonzor)"
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

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs text-gray-400">Punkt manzili (Kuryer kelishi uchun)</label>
            <button
              type="button"
              onClick={handleGetLocation}
              disabled={locating}
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
            >
              {locating ? '⏳ GPS olinmoqda...' : '📡 GPS orqali aniqlash'}
            </button>
          </div>
          <input
            className="input"
            value={form.address}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
            placeholder="Masalan: Chilonzor tumani, 9-kvartal, 12-uy"
          />
        </div>

        {form.lat && form.lon && (
          <div className="text-xs text-green-400 bg-green-950/40 border border-green-800/60 rounded-xl p-2.5 flex items-center justify-between">
            <span>📍 GPS lokatsiya: {form.lat}, {form.lon}</span>
            <span className="text-[10px] bg-green-900 text-green-200 px-2 py-0.5 rounded-full font-bold">Xarita faol</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Mas'ul shaxs ismi</label>
            <input
              className="input"
              value={form.first_name}
              onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
              placeholder="Ism"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Familiya</label>
            <input
              className="input"
              value={form.last_name}
              onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
              placeholder="Familiya"
            />
          </div>
        </div>
      </div>

      {/* Karta ma'lumotlari */}
      <div className="card space-y-4">
        <h3 className="text-sm font-semibold text-green-400 uppercase tracking-wider">💳 Karta (Mijoz to'lov qilishi uchun)</h3>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Karta raqami</label>
          <input
            className="input font-mono"
            value={form.card_number}
            onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))}
            placeholder="8600 0000 0000 0000"
            maxLength={19}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Karta egasining ism familiyasi</label>
          <input
            className="input"
            value={form.card_holder}
            onChange={e => setForm(f => ({ ...f, card_holder: e.target.value }))}
            placeholder="SOTUVCHI ISM FAMILIYA"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`btn-primary w-full ${saved ? 'bg-green-600' : ''}`}
      >
        {saving ? '⏳ Saqlanmoqda...' : saved ? '✅ Saqlandi!' : '💾 Saqlash'}
      </button>

      {/* Admin bilan aloqa (Message) */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">💬 Admin bilan aloqa</h3>
          <button
            onClick={() => { setShowMsg(!showMsg); if (!showMsg) loadMessages() }}
            className="text-xs text-orange-400 hover:underline"
          >
            {showMsg ? 'Yopish ▲' : 'Xabarlarni ochish ▼'}
          </button>
        </div>

        {showMsg && (
          <div className="space-y-3 pt-2">
            <div className="bg-gray-800 rounded-xl p-3 max-h-48 overflow-y-auto space-y-2 text-xs">
              {messages.length === 0 && <p className="text-gray-500 text-center py-2">Xabarlar tarixi bo'sh</p>}
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`p-2 rounded-lg ${m.from_user_id === profile?.id ? 'bg-orange-500/20 ml-8 text-right' : 'bg-gray-700 mr-8'}`}
                >
                  <p className="text-white">{m.text}</p>
                  <p className="text-gray-400 text-[10px] mt-0.5">{new Date(m.created_at).toLocaleTimeString()}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="input text-xs flex-1"
                value={msgText}
                onChange={e => setMsgText(e.target.value)}
                placeholder="Adminga savol yoki xabar yozing..."
                onKeyDown={e => e.key === 'Enter' && sendMsgToAdmin()}
              />
              <button onClick={sendMsgToAdmin} className="btn-primary px-4 text-xs font-bold">➤</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
