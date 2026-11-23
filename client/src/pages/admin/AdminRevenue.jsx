import { useState, useEffect } from 'react'

export default function AdminRevenue({ telegramId }) {
  const [stats, setStats] = useState(null)
  const [rates, setRates] = useState({ adminPct: 5, sellerPct: 95, courierPricePerKm: 3000 })
  const [adminFeeInput, setAdminFeeInput] = useState('5')
  const [sellerFeeInput, setSellerFeeInput] = useState('95')
  const [courierPerKmInput, setCourierPerKmInput] = useState('3000')
  const [savingSettings, setSavingSettings] = useState(false)
  const [savedSettingsAlert, setSavedSettingsAlert] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadData = () => {
    Promise.all([
      fetch(`/api/admin/revenue/${telegramId}`).then(r => r.json()),
      fetch(`/api/admin/settings`).then(r => r.json())
    ])
      .then(([revenueData, settingsData]) => {
        setStats(revenueData)
        if (settingsData && settingsData.adminPct !== undefined) {
          setRates(settingsData)
          setAdminFeeInput(String(settingsData.adminPct))
          setSellerFeeInput(String(settingsData.sellerPct ?? Math.max(0, 100 - settingsData.adminPct)))
          if (settingsData.courierPricePerKm != null) setCourierPerKmInput(String(settingsData.courierPricePerKm))
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadData()
  }, [telegramId])

  const handleAdminFeeChange = (val) => {
    setAdminFeeInput(val)
    if (val === '') {
      setSellerFeeInput('100')
      return
    }
    const n = Math.max(0, Math.min(99, Number(val) || 0))
    setSellerFeeInput(String(100 - n))
  }

  const handleSellerFeeChange = (val) => {
    setSellerFeeInput(val)
    if (val === '') {
      setAdminFeeInput('0')
      return
    }
    const n = Math.max(1, Math.min(100, Number(val) || 0))
    setAdminFeeInput(String(100 - n))
  }

  const calculatedSellerShare = Math.max(0, Math.min(100, Number(sellerFeeInput) || 0))

  const handleSaveSettings = async () => {
    const a = Number(adminFeeInput) || 0
    const perKm = Math.max(0, Math.round(Number(courierPerKmInput) || 0))
    if (a < 0 || a >= 100) {
      return alert("Xatolik! Admin komissiyasi 0% dan 99% gacha bo'lishi kerak!")
    }

    setSavingSettings(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          admin_fee_percent: a,
          courier_price_per_km: perKm
        })
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSavedSettingsAlert(true)
        setTimeout(() => setSavedSettingsAlert(false), 3000)
        loadData()
      } else {
        alert(data.error || 'Sozlamalarni saqlashda xatolik!')
      }
    } catch {
      alert('Tarmoq xatosi yuz berdi!')
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Moliya yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">💰 Moliya va Daromad</h2>
        <button onClick={loadData} className="text-xs text-orange-400 hover:underline">Yangilash 🔄</button>
      </div>

      {/* 1. ASOSIY SOZLAMALAR BLOKI: TA'RIFLAR (ADMIN % / SOTUVCHI % / KURYER 1 KM NARXI) */}
      <div className="card bg-gray-800/95 border-2 border-orange-500/60 p-4 space-y-3.5 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <div>
              <h3 className="text-sm font-bold text-white">Ta'rif va Ulushlarni Sozlash</h3>
              <p className="text-xs text-gray-400">Admin va Sotuvchi foizi, Kuryer uchun 1 km narxi</p>
            </div>
          </div>
          {savedSettingsAlert && (
            <span className="bg-green-600 text-white text-xs px-2.5 py-1 rounded-lg font-bold animate-pulse">
              ✅ Saqlandi!
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* Admin foizi */}
          <div className="bg-gray-900 rounded-xl p-2.5 border border-orange-500/40">
            <label className="text-[11px] text-orange-300 font-bold block mb-1">
              👑 Admin ulushi (%):
            </label>
            <input
              type="number"
              min="0"
              max="99"
              className="input text-sm font-extrabold text-orange-400 py-1.5 px-2 text-center"
              value={adminFeeInput}
              onChange={e => handleAdminFeeChange(e.target.value)}
            />
          </div>

          {/* Kuryer ulushi (1 km narxi) */}
          <div className="bg-gray-900 rounded-xl p-2.5 border border-blue-500/40">
            <label className="text-[11px] text-blue-300 font-bold block mb-1">
              🚴 Kuryer (1 km, so'm):
            </label>
            <input
              type="number"
              min="0"
              step="500"
              className="input text-sm font-extrabold text-blue-400 py-1.5 px-2 text-center"
              value={courierPerKmInput}
              onChange={e => setCourierPerKmInput(e.target.value)}
            />
          </div>

          {/* Sotuvchi ulushi (%) */}
          <div className="bg-gray-900 rounded-xl p-2.5 border border-green-500/40">
            <label className="text-[11px] text-green-300 font-bold block mb-1">
              🏪 Sotuvchi ulushi (%):
            </label>
            <input
              type="number"
              min="1"
              max="100"
              className="input text-sm font-extrabold text-green-400 py-1.5 px-2 text-center"
              value={sellerFeeInput}
              onChange={e => handleSellerFeeChange(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-gray-900/70 rounded-xl p-2.5 border border-gray-700/80 space-y-1 text-xs text-gray-300">
          <div className="flex items-center justify-between">
            <span>👑 Admin: <b className="text-orange-400">{Number(adminFeeInput) || 0}%</b> · 🏪 Sotuvchi: <b className="text-green-400">{calculatedSellerShare}%</b></span>
            <span className="text-[10px] text-gray-400">(mahsulotdan)</span>
          </div>
          <div className="flex items-center justify-between pt-1 border-t border-gray-800">
            <span>🚴 Kuryer ulushi (1 km narxi):</span>
            <b className="text-blue-400">{Number(courierPerKmInput || 0).toLocaleString()} so'm / km</b>
          </div>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg"
        >
          <span>💾</span>
          <span>{savingSettings ? '⏳ Saqlanmoqda...' : 'YANGI TA\'RIFLARNI SAQLASH'}</span>
        </button>
      </div>

      {/* Main Net Profit Card */}
      <div className="bg-gradient-to-br from-orange-500 via-amber-600 to-orange-700 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-orange-100 text-xs font-semibold uppercase tracking-wider">Sof foyda (Admin {rates.adminPct}% ulushi)</p>
          <span className="text-xs bg-black/25 text-white px-2.5 py-0.5 rounded-full font-bold">
            {rates.adminPct}% platforma komissiyasi
          </span>
        </div>
        <p className="text-white text-3xl font-extrabold">
          {((stats?.admin_share) || 0).toLocaleString()} <span className="text-base font-normal">so'm</span>
        </p>
        <div className="pt-2 border-t border-white/20 flex justify-between text-xs text-orange-100">
          <span>Sotuvchilardan tushgan depozitlar:</span>
          <span className="font-bold text-white">{(stats?.deposits_received || 0).toLocaleString()} so'm</span>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card text-center">
          <p className="text-gray-400 text-xs mb-1">Jami aylanma (100%)</p>
          <p className="text-white font-bold text-lg">{(stats?.total_revenue || 0).toLocaleString()}</p>
          <p className="text-gray-500 text-[10px]">so'm ({stats?.total_orders || 0} ta zakaz)</p>
        </div>
        <div className="card text-center">
          <p className="text-gray-400 text-xs mb-1">Sotuvchilar ulushi ({rates.sellerPct}%)</p>
          <p className="text-green-400 font-bold text-lg">{(stats?.seller_share_total || 0).toLocaleString()}</p>
          <p className="text-gray-500 text-[10px]">so'm</p>
        </div>
        <div className="card text-center">
          <p className="text-gray-400 text-xs mb-1">Kuryerlarga to'langan</p>
          <p className="text-blue-400 font-bold text-lg">{(stats?.paid_to_couriers || 0).toLocaleString()}</p>
          <p className="text-gray-500 text-[10px]">so'm (Chek bilan)</p>
        </div>
        <div className="card text-center">
          <p className="text-gray-400 text-xs mb-1">Kuryerlarda kutilayotgan</p>
          <p className="text-yellow-400 font-bold text-lg">{(stats?.unpaid_to_couriers || 0).toLocaleString()}</p>
          <p className="text-gray-500 text-[10px]">so'm (1 km = {(rates.courierPricePerKm ?? 3000).toLocaleString()} so'm)</p>
        </div>
      </div>

      {/* Share breakdown visual */}
      <div className="card space-y-3">
        <h3 className="text-white font-semibold text-sm">📊 Moliyaviy taqsimot arxitekturasi</h3>
        <div className="space-y-2.5">
          {[
            { label: `Admin ulushi (Sof platforma foydasi)`, percent: rates.adminPct, color: 'bg-orange-500' },
            { label: `Sotuvchi ulushi (Taom/Mahsulot)`, percent: rates.sellerPct, color: 'bg-green-500' }
          ].map(item => (
            <div key={item.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-gray-300">{item.label}</span>
                <span className="text-white font-bold">{item.percent}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`${item.color} h-2 rounded-full`}
                  style={{ width: `${item.percent}%` }}
                />
              </div>
            </div>
          ))}
          <div className="pt-2 border-t border-gray-700/70 flex items-center justify-between text-xs">
            <span className="text-blue-300 font-semibold">🚴 Kuryer ulushi (Masofa bo'yicha):</span>
            <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2.5 py-0.5 rounded-full font-bold">
              {(rates.courierPricePerKm ?? 3000).toLocaleString()} so'm / 1 km
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
