import { useState, useEffect, useRef } from 'react'

export default function CourierProfile({ telegramId }) {
  const [profile, setProfile] = useState(null)
  const [form, setForm] = useState({ first_name: '', last_name: '', username: '', phone: '', card_number: '', card_holder: '' })
  const [isOnline, setIsOnline] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    fetch(`/api/courier/profile/${telegramId}`)
      .then(r => r.json())
      .then(data => {
        setProfile(data)
        setIsOnline(data.is_online !== 0)
        setForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          username: data.username || '',
          phone: data.phone || '',
          card_number: data.card_number || '',
          card_holder: data.card_holder || ''
        })
      })
      .catch(() => {})
  }, [telegramId])

  const toggleOnline = async () => {
    const next = !isOnline
    setIsOnline(next)
    try {
      await fetch(`/api/courier/toggle-online?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'x-telegram-id': String(telegramId)
        }
      })
    } catch {}
  }

  const handleSave = async () => {
    if (!telegramId) return
    setSaving(true)
    try {
      const formData = new FormData()
      Object.entries(form).forEach(([k, v]) => formData.append(k, v ?? ''))
      formData.append('telegramId', String(telegramId))

      const res = await fetch(`/api/courier/profile/${telegramId}?tid=${telegramId}`, {
        method: 'PUT',
        headers: {
          'x-telegram-id': String(telegramId)
        },
        body: formData
      })
      if (res.ok) {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
        fetch(`/api/courier/profile/${telegramId}?tid=${telegramId}`).then(r => r.json()).then(setProfile)
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
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append('photo', file)
    Object.entries(form).forEach(([k, v]) => formData.append(k, v))

    const res = await fetch(`/api/courier/profile/${telegramId}?tid=${telegramId}`, {
      method: 'PUT',
      headers: {
        'x-telegram-id': String(telegramId)
      },
      body: formData
    })
    if (res.ok) {
      fetch(`/api/courier/profile/${telegramId}?tid=${telegramId}`).then(r => r.json()).then(setProfile)
    }
  }

  return (
    <div className="space-y-5">
      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <label
            htmlFor="courier-profile-photo"
            className="w-24 h-24 rounded-full bg-gray-800 border-4 border-orange-500 overflow-hidden flex items-center justify-center cursor-pointer shadow-xl relative block"
          >
            {profile?.photo_url ? (
              <img src={profile.photo_url} alt="courier" className="w-full h-full object-cover" />
            ) : (
              <span className="text-4xl">🚴</span>
            )}
          </label>
          <label
            htmlFor="courier-profile-photo"
            className="absolute bottom-0 right-0 bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm shadow-md cursor-pointer"
          >
            📷
          </label>
          <input
            id="courier-profile-photo"
            type="file"
            accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
            onChange={handlePhoto}
            className="sr-only"
          />
        </div>
        <div className="text-center">
          <label
            htmlFor="courier-profile-photo"
            className="text-xs text-orange-400 font-bold hover:underline cursor-pointer block mb-1"
          >
            📷 Rasm yuklash / o'zgartirish
          </label>
          <h2 className="text-lg font-bold text-white">{form.first_name || 'Kuryer'} {form.last_name}</h2>
          <p className="text-xs text-gray-400">@{form.username || 'kuryer'}</p>
        </div>
      </div>

      {/* Smenada Online / Offline Switch */}
      <div className="card bg-gray-800/90 border border-gray-700 p-4 flex items-center justify-between shadow-lg">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span>🚴</span>
            <span>Smena holati:</span>
            <span className={isOnline ? 'text-green-400 font-extrabold' : 'text-yellow-400 font-extrabold'}>
              {isOnline ? 'ONLINE (Smenada)' : 'OFFLINE (Tanaffus)'}
            </span>
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {isOnline ? 'Yangi buyurtmalar 20 km radiusda keladi' : 'Siz dam olyapsiz, yangi buyurtmalar berilmaydi'}
          </p>
        </div>
        <button
          onClick={toggleOnline}
          className={`px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-md flex items-center gap-1.5 ${
            isOnline
              ? 'bg-green-600 hover:bg-green-500 text-white'
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
          }`}
        >
          <span>{isOnline ? '🟢 Onlayn' : '⚪ Oflayn'}</span>
          <span className="text-[10px] opacity-80">(O'zgartirish)</span>
        </button>
      </div>

      {/* Profil Form */}
      <div className="card space-y-3">
        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider">👤 Kuryer shaxsiy ma'lumotlari</h3>
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
      </div>

      {/* Kuryer Karta ma'lumotlari */}
      <div className="card space-y-3">
        <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider">💳 Mening kartam (Kuryer ulushini qabul qilish uchun)</h3>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Karta raqami (16 xonali)</label>
          <input
            className="input font-mono"
            value={form.card_number}
            onChange={e => setForm(f => ({ ...f, card_number: e.target.value }))}
            placeholder="8600 0000 0000 0000"
            maxLength={19}
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Karta egasining ism-familiyasi</label>
          <input
            className="input"
            value={form.card_holder}
            onChange={e => setForm(f => ({ ...f, card_holder: e.target.value }))}
            placeholder="ISM FAMILIYA"
          />
        </div>
      </div>

      {/* Admin Karta ma'lumotlari (Ko'rinib turishi uchun) */}
      <div className="card bg-gray-800/70 border border-orange-500/30 space-y-2">
        <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>👑</span> <span>Admin Karta Ma'lumotlari</span>
        </h3>
        <div className="bg-gray-900 rounded-xl p-3 border border-gray-700">
          <p className="text-[11px] text-gray-400">Admin karta raqami:</p>
          <p className="text-white font-mono text-sm font-bold tracking-wider mt-0.5">
            {profile?.admin_card || '8600 0000 0000 0000'}
          </p>
          <p className="text-xs text-gray-300 mt-1">
            Egasi: <span className="font-semibold text-orange-300">{profile?.admin_card_holder || 'ADMINISTRATOR'}</span>
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className={`btn-primary w-full py-3 ${saved ? 'bg-green-600' : ''}`}
      >
        {saving ? '⏳ Saqlanmoqda...' : saved ? '✅ Saqlandi!' : '💾 Profilni saqlash'}
      </button>
    </div>
  )
}
