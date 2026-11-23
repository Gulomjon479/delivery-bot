import { useState, useEffect, useRef } from 'react'

export default function SellerPayments({ telegramId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [message, setMessage] = useState('')
  const [copied, setCopied] = useState(false)
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [collectingCash, setCollectingCash] = useState(false)
  const receiptRef = useRef()

  const loadPayments = () => {
    fetch(`/api/seller/payments/${telegramId}?tid=${telegramId}`)
      .then(r => r.json())
      .then(res => {
        setData(res)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  const handleCollectCash = async (courierId = null, courierName = 'kuryer', amount = null) => {
    const amountText = amount ? `${Number(amount).toLocaleString()} so'm ` : ''
    const whoText = courierId ? `"${courierName}"dan ` : 'barcha kuryerlardan '
    if (!confirm(`Haqiqatan ham ${whoText}${amountText}naqd pulni qabul qilib, sotuvchi kassasiga kirim qilasizmi?`)) {
      return
    }

    setCollectingCash(true)
    try {
      const res = await fetch(`/api/seller/payments/collect-cash?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({
          telegramId,
          courier_id: courierId
        })
      })
      const result = await res.json()
      if (res.ok) {
        alert(result.message || '✅ Naqd pul muvaffaqiyatli kassaga qabul qilindi!')
        loadPayments()
      } else {
        alert(result.error || 'Xatolik yuz berdi!')
      }
    } catch {
      alert('Server bilan aloqa uzildi!')
    } finally {
      setCollectingCash(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [telegramId])

  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setReceiptFile(file)
      setReceiptPreview(URL.createObjectURL(file))
    }
  }

  const handleUploadReceipt = async () => {
    const assignedAmount = data?.assigned_deposit_amount !== undefined
      ? Number(data.assigned_deposit_amount)
      : (data?.required_deposit_amount !== undefined ? Number(data.required_deposit_amount) : 300000)

    if (!assignedAmount || assignedAmount <= 0) {
      return alert("Admin hali siz uchun to'lov summasini belgilamagan!")
    }

    const file = receiptFile || receiptRef.current?.files?.[0]
    if (!file) return alert('Iltimos, avval to\'lov cheki rasmini tanlang!')

    setUploading(true)
    const fd = new FormData()
    fd.append('receipt', file)
    fd.append('telegramId', telegramId)
    fd.append('amount', assignedAmount)

    try {
      const res = await fetch(`/api/seller/payments/upload-receipt?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'x-telegram-id': String(telegramId)
        },
        body: fd
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error || 'Xatolik yuz berdi')
      } else {
        setMessage(json.message || 'Chek Adminga yuborildi!')
        setReceiptFile(null)
        setReceiptPreview(null)
        if (receiptRef.current) receiptRef.current.value = ''
        loadPayments()
      }
    } catch {
      alert('Xatolik yuz berdi')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ To'lovlar yuklanmoqda...</div>

  const sellerBalance = Number(data?.seller_balance) || 0
  const assignedAmount = data?.assigned_deposit_amount !== undefined
    ? Number(data.assigned_deposit_amount)
    : (data?.required_deposit_amount !== undefined ? Number(data.required_deposit_amount) : 300000)

  const copyCard = () => {
    if (data?.admin_card) {
      navigator.clipboard?.writeText(data.admin_card.replace(/\s+/g, ''))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">💳 Sotuvchi Balansi va Depozit</h2>
        <button onClick={loadPayments} className="text-xs text-orange-400 hover:underline">Yangilash 🔄</button>
      </div>

      {/* 🔒 Admin tomonidan belgilangan aniq to'lov kartochkasi */}
      <div className="rounded-2xl p-4 border shadow-lg bg-gradient-to-br from-amber-950/70 via-gray-900 to-gray-900 border-amber-500/50 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔒</span>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-extrabold text-amber-300">
                Admin tomonidan belgilangan to'lov summasi
              </p>
              <p className="text-[10px] text-gray-400">Siz faqat admin kiritgan ushbu summani to'lashingiz lozim</p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full border bg-amber-500/20 text-amber-300 border-amber-500/40">
            Faqat belgilangan summa
          </span>
        </div>

        <div className="bg-black/40 rounded-xl p-3 border border-amber-500/30 flex items-baseline justify-between">
          <div>
            <span className="text-[10px] text-gray-400 block font-semibold">Adminga o'tkazilishi shart bo'lgan summa:</span>
            <p className="text-3xl font-black font-mono text-amber-400 mt-0.5">
              {assignedAmount > 0 ? (
                <span>{assignedAmount.toLocaleString()} <span className="text-sm font-normal text-gray-300">so'm</span></span>
              ) : (
                <span className="text-base text-gray-400">Admin hali summa belgilamagan</span>
              )}
            </p>
            <p className="text-xs text-gray-300 mt-1">
              Admin siz uchun to'lov summasini kiritgan. O'zboshimchalik bilan boshqa summa to'lab bo'lmaydi.
            </p>
          </div>
        </div>
      </div>

      {/* Sotuvchi joriy balansi kartochkasi */}
      <div className="bg-gradient-to-br from-orange-600 via-amber-600 to-orange-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-orange-100 text-xs uppercase tracking-wider font-bold">Faol Depozit Balansingiz</p>
          <span className="text-xs bg-black/30 text-white px-3 py-1 rounded-full font-semibold">
            Depozit hisobi
          </span>
        </div>
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-xs text-orange-200">Asosiy faol balans:</p>
            <p className="text-3xl font-extrabold text-white">
              {sellerBalance.toLocaleString()} <span className="text-base font-normal">so'm</span>
            </p>
          </div>
          {Number(data?.frozen_balance || 0) > 0 && (
            <div className="text-right bg-black/25 px-3 py-1.5 rounded-xl border border-white/20">
              <p className="text-[10px] text-amber-200 uppercase font-bold">🔒 Muzlatilgan (Hold):</p>
              <p className="text-base font-extrabold text-amber-300">
                {Number(data?.frozen_balance).toLocaleString()} so'm
              </p>
            </div>
          )}
        </div>
        <p className="text-xs text-orange-100 leading-relaxed">
          Har bir buyurtma qabul qilinganda <b>{data?.rates?.adminPct ?? 5}% Admin ulushi</b> va <b>Kuryer ulushi (1 km = {(data?.rates?.courierPricePerKm ?? 3000).toLocaleString()} so'm)</b> depozitdan yechiladi. Mahsulotdan sotuvchiga sof <b>{data?.rates?.sellerPct ?? 95}%</b> qoladi.
        </p>
      </div>

      {/* Yechilgan ulushlar statistikasi */}
      <div className="grid grid-cols-3 gap-2.5">
        <div className="stat-card">
          <p className="text-[10px] text-gray-400">Admin ({data?.rates?.adminPct ?? 5}%) ulushi</p>
          <p className="text-orange-400 font-bold text-xs mt-0.5">-{(data?.deducted_admin_5 || 0).toLocaleString()} so'm</p>
        </div>
        <div className="stat-card">
          <p className="text-[10px] text-gray-400">Kuryer (km) ulushi</p>
          <p className="text-blue-400 font-bold text-xs mt-0.5">-{(data?.deducted_courier_15 || 0).toLocaleString()} so'm</p>
        </div>
        <div className="stat-card">
          <p className="text-[10px] text-gray-400">Sof foydangiz ({data?.rates?.sellerPct ?? 95}%)</p>
          <p className="text-green-400 font-bold text-xs mt-0.5">+{(data?.total_earned || 0).toLocaleString()} so'm</p>
        </div>
      </div>

      {/* 💵 Naqd buyurtmalar va kuryerlardan kutilayotgan naqd pullar */}
      {data?.cash_stats && (
        <div className="card space-y-3 bg-gray-800/95 border border-emerald-500/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">💵</span>
              <div>
                <h3 className="text-sm font-bold text-white">Naqd buyurtmalar va Kuryer hisoboti</h3>
                <p className="text-[10px] text-gray-400">Mijozlardan naqd olinadigan va kuryerlar topshiradigan summalar</p>
              </div>
            </div>
            <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold px-2.5 py-0.5 rounded-full">
              {data.cash_stats.count || 0} ta naqd zakaz
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {/* 1. Sariq qism: Yo'lda / Kuryerlar qo'lida */}
            <div className="bg-gray-900 rounded-xl p-3 border border-amber-500/50 flex flex-col justify-between space-y-2.5 shadow-md">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-amber-300 font-bold flex items-center gap-1">
                    <span>🚴</span>
                    <span>Yo'lda / Kuryerlar qo'lida:</span>
                  </span>
                  {data.cash_stats.pending_cash > 0 && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full font-bold animate-pulse">
                      Kutilmoqda
                    </span>
                  )}
                </div>

                <div className="flex items-baseline justify-between mt-1">
                  <p className="text-xl font-black text-amber-400 font-mono tracking-tight">
                    {(data.cash_stats.pending_cash || 0).toLocaleString()} <span className="text-xs font-normal text-amber-300">so'm</span>
                  </p>
                  <span className="text-[10px] text-gray-400">Yetkazilgach punktga beriladi</span>
                </div>
              </div>

              {/* Pul qaysi kuryerda ekanligi (Har bir kuryer alohida) */}
              {data.cash_stats.couriers && data.cash_stats.couriers.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-gray-800">
                  <p className="text-[10px] text-amber-200/90 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>👥</span> Pul qaysi kuryerlarda:
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                    {data.cash_stats.couriers.map((c, idx) => (
                      <div
                        key={c.courier_id || idx}
                        className="bg-gray-950/90 rounded-lg p-2 border border-amber-500/30 flex items-center justify-between gap-2 hover:border-amber-500/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-white truncate flex items-center gap-1">
                            <span>🚴</span>
                            <span className="truncate">{c.first_name ? `${c.first_name} ${c.last_name || ''}` : 'Kuryer (Yo\'lda)'}</span>
                          </p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                            {c.phone && <span className="font-mono">📞 {c.phone}</span>}
                            <span>• {c.order_count} ta zakaz</span>
                          </div>
                          <p className="text-[11px] font-mono font-extrabold text-amber-400 mt-0.5">
                            {(Number(c.pending_amount) || 0).toLocaleString()} so'm
                          </p>
                        </div>

                        {/* Kuryer chetidagi alohida 'Oldim' tugmasi */}
                        <button
                          type="button"
                          onClick={() => handleCollectCash(c.courier_id, c.first_name, c.pending_amount)}
                          disabled={collectingCash}
                          className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-gray-950 font-black text-[11px] rounded-lg shadow transition-all whitespace-nowrap flex items-center gap-1 shrink-0"
                          title="Ushbu kuryer keltirgan pulni qabul qilish"
                        >
                          <span>💵</span>
                          <span>Oldim</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Asosiy qabul qilish tugmasi */}
              {data.cash_stats.pending_cash > 0 ? (
                <button
                  type="button"
                  onClick={() => handleCollectCash(null, 'Barcha kuryerlar', data.cash_stats.pending_cash)}
                  disabled={collectingCash}
                  className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 active:scale-95 text-gray-950 font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5 transition-all mt-1"
                >
                  <span>💵</span>
                  <span>
                    {collectingCash
                      ? 'Kassaga qabul qilinmoqda...'
                      : `Kuryer pulni olib keldi (${(data.cash_stats.pending_cash || 0).toLocaleString()} so'm oldim)`}
                  </span>
                </button>
              ) : (
                <div className="py-2 px-2.5 bg-gray-950/70 border border-gray-800 rounded-xl text-center flex items-center justify-center gap-1 text-[11px] text-emerald-400 font-semibold mt-1">
                  <span>✅</span>
                  <span>Barcha naqd pullar kassaga qabul qilingan (0 so'm)</span>
                </div>
              )}
            </div>

            {/* 2. Yashil qism: Yetkazilgan naqd summa (Sotuvchi kassasiga tushgan) */}
            <div className="bg-gray-900 rounded-xl p-3 border border-green-500/50 flex flex-col justify-between space-y-2.5 shadow-md">
              <div>
                <span className="text-[11px] text-green-300 block font-bold">✅ Yetkazilgan naqd summa:</span>
                <p className="text-xl font-black text-green-400 font-mono tracking-tight mt-1">
                  {(data.cash_stats.delivered_cash || 0).toLocaleString()} <span className="text-xs font-normal text-green-300">so'm</span>
                </p>
                <span className="text-[10px] text-gray-400 mt-1 block">Sotuvchi kassasiga tushgan</span>
              </div>

              <div className="py-2 px-2.5 bg-emerald-950/40 border border-emerald-500/30 rounded-xl text-[10px] text-emerald-300 flex items-center gap-1.5">
                <span>🛡️</span>
                <span>Kuryerlar topshirgan barcha naqd pullar to'liq shu yerga hisoblanib boradi</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin karta ma'lumotlari */}
      <div className="card space-y-2.5 bg-gray-800 border border-gray-700">
        <h3 className="text-sm font-semibold text-white">🏦 Admin to'lov rekviziti (Balansni to'ldirish uchun)</h3>
        <p className="text-xs text-gray-400">Quyidagi Admin kartasiga to'lov qiling va to'lov chekini pastdagi formaga yuklang:</p>
        
        <div className="bg-gray-900 rounded-xl p-3.5 border border-orange-500/30 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] text-gray-400">Admin Karta raqami:</p>
            <p className="text-white font-mono text-base sm:text-lg font-extrabold tracking-wider mt-0.5 select-all">
              {data?.admin_card || '8600 0000 0000 0000'}
            </p>
            <p className="text-xs text-gray-400 mt-1">Karta egasi: <span className="text-orange-300 font-bold">{data?.admin_card_holder || 'ADMINISTRATOR'}</span></p>
          </div>
          <button
            onClick={copyCard}
            className="px-3 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 text-xs font-bold rounded-xl text-white flex items-center gap-1.5 transition-colors"
          >
            <span>{copied ? '✅' : '📋'}</span>
            <span>{copied ? 'Nusxalandi!' : 'Nusxalash'}</span>
          </button>
        </div>
      </div>

      {/* Chek yuklash formasi */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-white">📤 To'lov chekini yuklash</h3>
        
        <div>
          <label className="text-xs text-gray-400 block mb-1">
            To'lanadigan summa (Admin tomonidan belgilangan):
          </label>
          <div className="bg-gray-950 border border-amber-500/60 rounded-xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔒</span>
              <div>
                <p className="text-lg font-black font-mono text-amber-400">
                  {assignedAmount > 0 ? (
                    <span>{assignedAmount.toLocaleString()} <span className="text-xs font-normal text-gray-300">so'm</span></span>
                  ) : (
                    <span className="text-sm text-gray-400">Admin hali summa belgilamagan</span>
                  )}
                </p>
                <p className="text-[10px] text-gray-400">
                  {assignedAmount > 0 
                    ? "Faqat admin belgilagan ushbu summa qabul qilinadi" 
                    : "Admin to'lov summasini belgilashi kutilmoqda"}
                </p>
              </div>
            </div>
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-1 rounded-full font-bold">
              Qat'iy summa
            </span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs text-gray-300 block font-semibold">To'lov cheki (rasm/skrinshot):</label>
          <label
            htmlFor="seller-deposit-receipt"
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
                <p className="text-[10px] text-gray-400">Galereyadan skrinshot yoki to'lov kvitansiyasi</p>
              </div>
            )}
          </label>

          <div className="flex items-center gap-2">
            <label
              htmlFor="seller-deposit-receipt"
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow text-center"
            >
              <span>🖼️</span>
              <span>{receiptFile ? "Boshqa chek rasmini tanlash" : "Galereyadan chekni tanlash"}</span>
            </label>
            {receiptFile && (
              <button
                type="button"
                onClick={() => { setReceiptFile(null); setReceiptPreview(null); if (receiptRef.current) receiptRef.current.value = ''; }}
                className="bg-red-950/70 border border-red-800 text-red-300 py-2 px-3 rounded-xl text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          <input
            id="seller-deposit-receipt"
            type="file"
            ref={receiptRef}
            accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
            onChange={handleReceiptChange}
            className="sr-only"
          />
        </div>

        <button
          onClick={handleUploadReceipt}
          disabled={uploading || assignedAmount <= 0}
          className="btn-primary w-full text-sm font-bold py-3 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading 
            ? '⏳ Yuklanmoqda...' 
            : assignedAmount > 0 
              ? `📨 Adminga chekni yuborish (${assignedAmount.toLocaleString()} so'm)`
              : '⚠️ Admin to\'lov summasini belgilashi kutilmoqda'}
        </button>

        {message && (
          <p className="text-xs text-green-400 bg-green-950/40 border border-green-800 p-2.5 rounded-xl text-center">
            ✅ {message}
          </p>
        )}
      </div>

      {/* Cheklar tarixi */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-white">📜 Yuborilgan depozit cheklari tarixi</h3>
        {(!data?.payments || data.payments.length === 0) && (
          <p className="text-xs text-gray-500 text-center py-4">Hali chek yuborilmagan</p>
        )}
        <div className="space-y-2">
          {data?.payments?.map(p => (
            <div key={p.id} className="bg-gray-900 rounded-xl p-3 flex items-center justify-between text-xs border border-gray-700/70">
              <div>
                <p className="text-white font-bold">+{Number(p.amount || 0).toLocaleString()} so'm</p>
                <p className="text-gray-400 text-[10px]">{new Date(p.created_at).toLocaleString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                  p.status === 'confirmed' ? 'bg-green-900 text-green-300' :
                  p.status === 'rejected' ? 'bg-red-900 text-red-300' :
                  'bg-yellow-900 text-yellow-300'
                }`}>
                  {p.status === 'confirmed' ? '✅ Tasdiqlangan' : p.status === 'rejected' ? '❌ Rad etilgan' : '⏳ Kutilmoqda'}
                </span>
                {p.receipt_url && (
                  <a href={p.receipt_url} target="_blank" rel="noreferrer" className="text-orange-400 font-semibold hover:underline">
                    Ko'rish
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
