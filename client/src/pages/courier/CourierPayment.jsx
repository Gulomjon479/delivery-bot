import { useState, useEffect } from 'react'

export default function CourierPayment({ telegramId }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/courier/payments/${telegramId}`)
      .then(r => r.json())
      .then(res => {
        setData(res)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [telegramId])

  if (loading) return <div className="text-center text-gray-400 py-8">⏳ Hisob yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      <h2 className="text-white font-bold text-lg">💳 Mening hisobim</h2>

      {/* Asosiy balans kartochkasi */}
      <div className="bg-gradient-to-br from-green-600 to-emerald-800 rounded-2xl p-5 shadow-xl space-y-3">
        <p className="text-emerald-100 text-xs uppercase tracking-wider font-semibold">Admin to'lashi kerak bo'lgan summa</p>
        <div className="flex items-baseline justify-between">
          <p className="text-3xl font-extrabold text-white">
            {(data?.unpaid_amount || 0).toLocaleString()} <span className="text-lg font-normal">so'm</span>
          </p>
          <span className="text-xs bg-black/20 text-white px-2.5 py-1 rounded-full">
            1 km = {(data?.courier_price_per_km ?? data?.rates?.courierPricePerKm ?? 3000).toLocaleString()} so'm
          </span>
        </div>
        <p className="text-xs text-emerald-200">
          Admin to'lov qilib chek yuklagandan so'ng bu ko'rsatkich 0 ga tushadi.
        </p>
      </div>

      {/* Jami ishlab topilgan summa */}
      <div className="card grid grid-cols-2 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-400 mb-1">Jami daromad</p>
          <p className="text-xl font-bold text-green-400">{(data?.total_earned || 0).toLocaleString()} so'm</p>
        </div>
        <div>
          <p className="text-xs text-gray-400 mb-1">To'langan cheklar</p>
          <p className="text-xl font-bold text-white">{data?.payments?.length || 0} ta</p>
        </div>
      </div>

      {/* 💵 Mijozlardan yig'ilgan naqd pullar (Kuryer qo'lidagi naqd pullar hisoboti) */}
      {(() => {
        const cashOrders = (data?.delivered_orders || []).filter(o => o.payment_method === 'cash')
        const totalCashInHand = cashOrders.reduce((s, o) => s + (Number(o.total_price) || 0), 0)
        return (
          <div className="card space-y-3 border border-amber-500/40 bg-gray-800/95">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💵</span>
                <div>
                  <h3 className="text-sm font-bold text-white">Mijozlardan olingan naqd pul</h3>
                  <p className="text-[10px] text-gray-400">Naqd buyurtmalar bo'yicha yig'ilgan summalar</p>
                </div>
              </div>
              <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {cashOrders.length} ta zakaz
              </span>
            </div>

            <div className="bg-gray-900 rounded-xl p-3.5 border border-gray-700 flex items-baseline justify-between">
              <div>
                <span className="text-[11px] text-gray-400 block font-medium">Jami yig'ilgan naqd summa:</span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {totalCashInHand.toLocaleString()} <span className="text-xs font-normal text-gray-400">so'm</span>
                </span>
              </div>
              <p className="text-[10px] text-amber-200/80 max-w-[140px] text-right">
                Ushbu naqd pul sotuvchi (punkt)ga topshiriladi
              </p>
            </div>

            {cashOrders.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-gray-400 font-semibold">Oxirgi naqd zakazlar:</p>
                {cashOrders.slice(0, 5).map(o => (
                  <div key={o.id} className="bg-gray-900/80 rounded-lg p-2.5 flex items-center justify-between text-xs border border-gray-800">
                    <div>
                      <span className="text-white font-bold">Zakaz #{o.id} • {o.product_name || 'Taom'}</span>
                      <p className="text-[10px] text-gray-400">{o.seller_point || 'Punkt'}</p>
                    </div>
                    <span className="font-mono font-bold text-amber-300">
                      +{Number(o.total_price || 0).toLocaleString()} so'm
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Admin tashlagan to'lovlar va cheklar ro'yxati */}
      <div className="card space-y-3">
        <h3 className="text-sm font-semibold text-white">🧾 Admin tashlagan cheklar va to'lovlar</h3>

        {(!data?.payments || data.payments.length === 0) && (
          <p className="text-xs text-gray-400 text-center py-4">Hozircha admin to'lov cheki yubormagan</p>
        )}

        <div className="space-y-2">
          {data?.payments?.map(p => (
            <div key={p.id} className="bg-gray-700/60 rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <p className="text-white font-bold text-sm">+{Number(p.amount || 0).toLocaleString()} so'm</p>
                <p className="text-gray-400">{new Date(p.created_at).toLocaleDateString()} {new Date(p.created_at).toLocaleTimeString()}</p>
                <span className="text-green-400 text-[10px] uppercase font-bold">Tasdiqlangan</span>
              </div>
              {p.receipt_url && (
                <a
                  href={p.receipt_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1"
                >
                  📄 Chekni ko'rish
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
