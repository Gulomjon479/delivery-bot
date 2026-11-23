import { useState, useEffect } from 'react'

export default function LegalConsentModal({ telegramId, onAccepted, isReadOnly = false, onClose = null }) {
  const [activeTab, setActiveTab] = useState('oferta') // 'oferta' yoki 'privacy'
  const [agreed, setAgreed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [docs, setDocs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/me/terms?tid=${telegramId}`)
      .then(r => r.json())
      .then(d => {
        setDocs(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [telegramId])

  const handleAccept = async () => {
    if (!agreed && !isReadOnly) {
      alert("Iltimos, avval quyidagi rozilik katakchasini (checkbox) belgilang!")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/me/accept-terms?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ telegramId })
      })
      const data = await res.json()
      if (res.ok) {
        if (onAccepted) onAccepted()
      } else {
        alert(data.error || 'Xatolik yuz berdi!')
      }
    } catch {
      alert('Server bilan aloqa uzildi!')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-orange-500/50 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Tepa qism: Sarlavha */}
        <div className="p-4 bg-gray-950 border-b border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">⚖️</span>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-white">
                Foydalanuvchi Shartnomasi va Maxfiylik
              </h2>
              <p className="text-[11px] text-orange-400">
                Oʻzbekiston Respublikasi qonunlari talabi asosida
              </p>
            </div>
          </div>
          {isReadOnly && onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white text-xl p-1 leading-none"
            >
              ✕
            </button>
          )}
        </div>

        {/* Tab tugmalari */}
        <div className="flex border-b border-gray-800 bg-gray-950/60 p-1.5 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('oferta')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'oferta'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <span>📄</span>
            <span>Ommaviy oferta</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('privacy')}
            className={`flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'bg-orange-500 text-white shadow-md'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
            }`}
          >
            <span>🔒</span>
            <span>Maxfiylik siyosati</span>
          </button>
        </div>

        {/* Matn qismi (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 text-xs text-gray-300 space-y-3 leading-relaxed border-b border-gray-800 bg-gray-900/60 font-sans">
          {loading ? (
            <div className="py-12 text-center text-gray-400 space-y-2">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p>Hujjatlar yuklanmoqda...</p>
            </div>
          ) : activeTab === 'oferta' ? (
            <div
              className="space-y-3 whitespace-pre-wrap select-text"
              dangerouslySetInnerHTML={{ __html: docs?.oferta?.text || 'Ommaviy oferta yuklanmoqda...' }}
            />
          ) : (
            <div
              className="space-y-3 whitespace-pre-wrap select-text"
              dangerouslySetInnerHTML={{ __html: docs?.privacy?.text || 'Maxfiylik siyosati yuklanmoqda...' }}
            />
          )}
        </div>

        {/* Pastki qism: Rozilik bildirish yoki Yopish */}
        <div className="p-3.5 bg-gray-950 space-y-2.5">
          {!isReadOnly ? (
            <>
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-orange-500 focus:ring-orange-400 bg-gray-900 border-gray-700 accent-orange-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] text-gray-300 leading-tight">
                  Men <b>Ommaviy oferta</b> va <b>"Shaxsiy maʼlumotlar toʻgʻrisida"gi Qonun</b> talablariga muvofiq shaxsiy maʼlumotlarim (ism, telefon, manzil, geolokatsiya) qayta ishlanishiga toʻliq roziman.
                </span>
              </label>

              <button
                type="button"
                onClick={handleAccept}
                disabled={submitting || !agreed}
                className={`w-full py-3 px-4 rounded-xl text-xs font-black shadow-lg flex items-center justify-center gap-2 transition-all ${
                  agreed
                    ? 'bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 hover:from-orange-400 hover:to-amber-400 text-white active:scale-95 cursor-pointer shadow-orange-500/20'
                    : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
                }`}
              >
                <span>✅</span>
                <span>{submitting ? 'Tasdiqlanmoqda...' : 'Roziman va Ilovaga kirish'}</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition-all"
            >
              Yopish
            </button>
          )}
        </div>

      </div>
    </div>
  )
}
