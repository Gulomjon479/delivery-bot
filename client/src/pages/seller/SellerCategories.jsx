import { useState, useEffect, useRef } from 'react'

const QUICK_CATEGORIES = [
  '🍕 Pitsalar',
  '🍔 Fast Food & Burger',
  '🌯 Lavash & Shourma',
  '🥘 Milliy taomlar',
  '🥗 Salatlar',
  '🥤 Ichimliklar',
  '🍰 Shirinliklar'
]

const QUICK_WEIGHTS = ['350g', '500g', '650g', '1kg', '0.5L', '1L', '1 dona']

export default function SellerCategories({ telegramId }) {
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCatId, setSelectedCatId] = useState('all')

  // Yangi kategoriya modal holati
  const [showAddCatModal, setShowAddCatModal] = useState(false)
  const [newCatName, setNewCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  // Mahsulot qo'shish / tahrirlash modal holati
  const [showProdModal, setShowProdModal] = useState(false)
  const [editingProdId, setEditingProdId] = useState(null)
  const [deleteConfirmProd, setDeleteConfirmProd] = useState(null)
  const [deletingProdId, setDeletingProdId] = useState(null)
  const [prodForm, setProdForm] = useState({
    name: '',
    price: '',
    weight: '350g',
    category_id: '',
    new_category_name: ''
  })
  const [prodPhoto, setProdPhoto] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [savingProd, setSavingProd] = useState(false)
  const fileRef = useRef()

  const loadCategories = () => {
    fetch(`/api/seller/categories/${telegramId}?tid=${telegramId}`, {
      headers: {
        'x-telegram-id': String(telegramId)
      }
    })
      .then(r => r.json())
      .then(data => {
        setCategories(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    loadCategories()
  }, [telegramId])

  // Yangi kategoriya saqlash
  const handleSaveCategory = async (nameOverride) => {
    const name = (nameOverride || newCatName).trim()
    if (!name) return alert('Iltimos, kategoriya nomini kiriting!')
    setSavingCat(true)
    try {
      const res = await fetch(`/api/seller/categories?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-id': String(telegramId)
        },
        body: JSON.stringify({ telegramId, name })
      })
      if (res.ok) {
        setNewCatName('')
        setShowAddCatModal(false)
        loadCategories()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Kategoriya saqlashda xatolik!')
      }
    } catch {
      alert('Tarmoq xatosi yuz berdi!')
    } finally {
      setSavingCat(false)
    }
  }

  // Kategoriyani o'chirish
  const handleDeleteCategory = async (catId, catName) => {
    if (!confirm(`"${catName}" bo'limi va undagi barcha taomlar o'chiriladi. Davom etasizmi?`)) return
    try {
      const res = await fetch(`/api/seller/categories/${catId}?tid=${telegramId}`, {
        method: 'DELETE',
        headers: {
          'x-telegram-id': String(telegramId)
        }
      })
      if (res.ok) {
        if (selectedCatId === catId) setSelectedCatId('all')
        loadCategories()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Kategoriyani o\'chirishda xatolik yuz berdi!')
      }
    } catch {
      alert('Tarmoq xatosi yuz berdi!')
    }
  }

  // Yangi mahsulot qo'shish oynasini ochish
  const openAddProductModal = (prefillCatId = null) => {
    setEditingProdId(null)
    setProdForm({
      name: '',
      price: '',
      weight: '350g',
      stock: '10',
      category_id: prefillCatId || (categories[0]?.id ? String(categories[0].id) : 'new'),
      new_category_name: categories.length === 0 ? '🍕 Pitsalar' : ''
    })
    setProdPhoto(null)
    setPhotoPreview(null)
    setShowProdModal(true)
  }

  // Mahsulotni tahrirlash oynasini ochish
  const openEditProductModal = (p, catId) => {
    setEditingProdId(p.id)
    setProdForm({
      name: p.name || '',
      price: String(p.price || ''),
      weight: p.weight || '350g',
      stock: p.stock !== undefined && p.stock !== null ? String(p.stock) : '10',
      category_id: String(catId || p.category_id || categories[0]?.id || ''),
      new_category_name: ''
    })
    setProdPhoto(null)
    setPhotoPreview(p.photo_url || null)
    setShowProdModal(true)
  }

  // Rasm tanlanganda
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setProdPhoto(file)
      setPhotoPreview(URL.createObjectURL(file))
    }
  }

  // Mahsulotni saqlash (Yangi yoki Tahrirlash)
  const handleSaveProduct = async () => {
    if (!prodForm.name.trim()) return alert('Mahsulot nomini kiriting!')
    if (!prodForm.price || Number(prodForm.price) <= 0) return alert('To\'g\'ri narx kiriting!')

    setSavingProd(true)
    const fd = new FormData()
    fd.append('name', prodForm.name.trim())
    fd.append('price', prodForm.price)
    fd.append('weight', prodForm.weight.trim() || 'Standart')
    fd.append('stock', prodForm.stock !== undefined && prodForm.stock !== '' ? Number(prodForm.stock) : 10)
    fd.append('seller_telegram_id', telegramId)

    if (prodForm.category_id === 'new' || !prodForm.category_id) {
      fd.append('category_name', prodForm.new_category_name.trim() || '🍽️ Asosiy Menyu')
    } else {
      fd.append('category_id', prodForm.category_id)
    }

    if (prodPhoto) {
      fd.append('photo', prodPhoto)
    }

    try {
      const url = editingProdId
        ? `/api/seller/products/${editingProdId}?tid=${telegramId}`
        : `/api/seller/products?tid=${telegramId}`
      const method = editingProdId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: {
          'x-telegram-id': String(telegramId)
        },
        body: fd
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok) {
        setShowProdModal(false)
        setEditingProdId(null)
        setProdPhoto(null)
        setPhotoPreview(null)
        loadCategories()
      } else {
        alert(data.error || 'Mahsulotni saqlashda xatolik!')
      }
    } catch {
      alert('Tarmoq xatosi!')
    } finally {
      setSavingProd(false)
    }
  }

  // Stop-list: Mavjud / Tugadi switch
  const handleToggleProduct = async (p) => {
    try {
      const res = await fetch(`/api/seller/products/${p.id}/toggle?tid=${telegramId}`, {
        method: 'POST',
        headers: {
          'x-telegram-id': String(telegramId)
        }
      })
      if (res.ok) {
        loadCategories()
      } else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Holatni o\'zgartirishda xatolik!')
      }
    } catch {
      alert('Tarmoq xatosi yuz berdi!')
    }
  }

  // Mahsulotni o'chirish (Tasdiqlash oynasini ochish)
  const handleDeleteProduct = (p) => {
    setDeleteConfirmProd(p)
  }

  // Mahsulotni bazadan butunlay o'chirish
  const confirmDeleteProduct = async () => {
    if (!deleteConfirmProd) return
    const p = deleteConfirmProd
    setDeletingProdId(p.id)

    // 1. Zudlik bilan ekrandan yo'qotish (optimistik o'chirish)
    setCategories(prev => prev.map(c => ({
      ...c,
      products: (c.products || []).filter(item => item.id !== p.id)
    })))
    setDeleteConfirmProd(null)

    // 2. Serverdan bazadan butunlay o'chirish
    try {
      const res = await fetch(`/api/seller/products/${p.id}?tid=${telegramId}`, {
        method: 'DELETE',
        headers: {
          'x-telegram-id': String(telegramId)
        }
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Mahsulotni o\'chirishda xatolik yuz berdi!')
        loadCategories()
      }
    } catch {
      alert('Tarmoq xatosi yuz berdi!')
      loadCategories()
    } finally {
      setDeletingProdId(null)
    }
  }

  // Barcha mahsulotlarni yig'ish
  const allProducts = categories.flatMap(c => (c.products || []).map(p => ({ ...p, category_name: c.name, cat_id: c.id })))
  const displayedProducts = selectedCatId === 'all'
    ? allProducts
    : allProducts.filter(p => String(p.cat_id) === String(selectedCatId))

  if (loading) return <div className="text-center text-gray-400 py-10">⏳ Menyuingiz yuklanmoqda...</div>

  return (
    <div className="space-y-4">
      {/* 1. ASOSIY QISM: KATTA MAHSULOT QO'SHISH TUGMASI */}
      <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-3">
        <div>
          <h2 className="text-white font-extrabold text-base flex items-center gap-1.5">
            <span>🍕</span>
            <span>Menyu & Mahsulotlar</span>
          </h2>
          <p className="text-orange-100 text-xs mt-0.5">
            Jami: <b>{allProducts.length} ta</b> taom mavjud
          </p>
        </div>
        <button
          onClick={() => openAddProductModal()}
          className="bg-white hover:bg-orange-50 text-orange-600 font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-1.5 transition-all transform active:scale-95 whitespace-nowrap"
        >
          <span className="text-base font-bold">➕</span>
          <span>Mahsulot qo'shish</span>
        </button>
      </div>

      {/* 2. KATEGORIYALAR FILTR CHIPLARI */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
        <button
          onClick={() => setSelectedCatId('all')}
          className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all shadow-sm ${
            selectedCatId === 'all'
              ? 'bg-orange-500 text-white'
              : 'bg-gray-800 text-gray-300 hover:text-white border border-gray-700'
          }`}
        >
          Hammasi ({allProducts.length})
        </button>

        {categories.map(c => (
          <button
            key={c.id}
            onClick={() => setSelectedCatId(c.id)}
            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
              selectedCatId === c.id
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-gray-800 text-gray-300 hover:text-white border border-gray-700'
            }`}
          >
            <span>{c.name}</span>
            <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded-full font-semibold">
              {c.products?.length || 0}
            </span>
          </button>
        ))}

        <button
          onClick={() => setShowAddCatModal(true)}
          className="px-3 py-1.5 rounded-xl font-bold text-orange-400 bg-gray-900 border border-orange-500/50 hover:bg-gray-800 whitespace-nowrap flex items-center gap-1"
        >
          <span>➕</span>
          <span>Bo'lim qo'shish</span>
        </button>
      </div>

      {/* 3. MAHSULOTLAR RO'YXATI (GRID 2 USTUNLI TALABDAGI KARTA DIZAYNI) */}
      {displayedProducts.length === 0 ? (
        <div className="card text-center py-12 space-y-3 border-2 border-dashed border-gray-700">
          <p className="text-5xl">🍔</p>
          <h3 className="text-white font-bold text-base">Hozircha mahsulot qo'shilmagan</h3>
          <p className="text-xs text-gray-400 max-w-xs mx-auto">
            Mijozlar buyurtma berishi uchun restoraningiz taomlarini rasmi va narxi bilan qo'shing.
          </p>
          <button
            onClick={() => openAddProductModal()}
            className="btn-primary inline-flex items-center gap-2 text-xs font-bold px-5 py-2.5 shadow-lg"
          >
            <span>➕</span>
            <span>Birinchi mahsulotni qo'shish</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {displayedProducts.map(p => {
            const isAvail = p.is_available === 1 || p.is_available === undefined
            return (
              <div
                key={p.id}
                className={`bg-gray-800/95 rounded-2xl overflow-hidden border ${
                  isAvail ? 'border-gray-700 shadow-md' : 'border-gray-800 opacity-60'
                } flex flex-col justify-between transition-all`}
              >
                {/* 1. RASM TEPADA, NARXI YONBOSHDA (BADGE KO'RINISHIDA) */}
                <div className="h-32 bg-gray-900 w-full overflow-hidden relative group">
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-600 bg-gray-900">
                      <span className="text-3xl">🍕</span>
                      <span className="text-[10px] text-gray-500 mt-1">Rasm yuklanmagan</span>
                    </div>
                  )}

                  {/* Narxi yonboshda badge */}
                  <span className="absolute top-2 right-2 bg-orange-500 text-white font-extrabold text-[11px] px-2.5 py-1 rounded-xl shadow-lg border border-orange-400">
                    {Number(p.price || 0).toLocaleString()} so'm
                  </span>

                  {/* Stop-list holati ko'rinishi */}
                  {!isAvail && (
                    <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                      <span className="text-[11px] font-extrabold text-red-200 bg-red-950/90 px-2.5 py-1 rounded-lg border border-red-700 shadow-lg">
                        🔴 TUGADI
                      </span>
                    </div>
                  )}
                </div>

                {/* 2. NOMI VA OG'IRLIGI PASTKI QISMDA */}
                <div className="p-3 flex-1 flex flex-col justify-between gap-2.5">
                  <div>
                    <h4 className="text-white font-bold text-xs line-clamp-1" title={p.name}>
                      {p.name}
                    </h4>
                    <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                      <span className="flex items-center gap-1">
                        <span>⚖️</span>
                        <span className="text-orange-200 font-semibold">{p.weight || 'Standart'}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                        (p.stock ?? 10) > 0 ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40' : 'bg-red-950 text-red-400 border border-red-700'
                      }`}>
                        📦 {(p.stock ?? 10) > 0 ? `${p.stock ?? 10} ta` : 'Tugagan'}
                      </span>
                    </div>
                  </div>

                  {/* 3. STOP-LIST SWITCH VA AMALLAR */}
                  <div className="pt-2 border-t border-gray-700/80 space-y-2">
                    {/* Mavjud / Tugadi switch */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-400">Holat:</span>
                      <button
                        onClick={() => handleToggleProduct(p)}
                        className={`px-2 py-0.5 rounded-lg font-bold text-[10px] transition-all flex items-center gap-1 ${
                          isAvail
                            ? 'bg-green-950/80 text-green-300 border border-green-700'
                            : 'bg-red-950/80 text-red-300 border border-red-700'
                        }`}
                        title="Mavjudlikni o'zgartirish"
                      >
                        <span>{isAvail ? '🟢 Mavjud' : '🔴 Tugadi'}</span>
                      </button>
                    </div>

                    {/* Tahrirlash va O'chirish tugmalari */}
                    <div className="flex items-center justify-between gap-1">
                      <button
                        onClick={() => openEditProductModal(p, p.cat_id)}
                        className="flex-1 bg-gray-700/80 hover:bg-gray-600 text-gray-200 text-[11px] font-semibold py-1 rounded-lg transition-all flex items-center justify-center gap-1"
                      >
                        <span>✏️</span>
                        <span>Tahrirlash</span>
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p)}
                        className="bg-red-950/50 hover:bg-red-900/60 text-red-400 p-1 rounded-lg transition-all border border-red-900/50"
                        title="O'chirish"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================
          4. MAHSULOT QO'SHISH / TAHRIRLASH MODALI
          ======================================================== */}
      {showProdModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex flex-col justify-center items-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-gray-900 border-2 border-orange-500 rounded-2xl w-full max-w-md flex flex-col max-h-[85vh] shadow-2xl overflow-hidden z-[10000]">
            {/* Modal Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 border-b border-gray-800 bg-gray-950">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{editingProdId ? '✏️' : '➕'}</span>
                <span>{editingProdId ? 'Mahsulotni Tahrirlash' : 'Yangi Mahsulot Qo\'shish'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowProdModal(false)}
                className="text-gray-400 hover:text-white text-lg p-1 font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Scrollable Form Body */}
            <div className="flex-1 p-4 space-y-3.5 overflow-y-auto">
              {/* Rasm yuklash (Kamera / Galereya) */}
              <div className="space-y-2">
                <label className="text-xs text-gray-300 block font-semibold">
                  📷 Mahsulot rasmi (Galereya yoki Kamera)
                </label>
                <label
                  htmlFor="seller-prod-photo-input"
                  className="w-full h-32 bg-gray-850 rounded-2xl border-2 border-dashed border-orange-500/60 hover:border-orange-500 overflow-hidden flex flex-col items-center justify-center relative cursor-pointer block transition-all shadow-inner"
                >
                  {photoPreview ? (
                    <div className="w-full h-full relative">
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <span className="absolute bottom-2 right-2 bg-black/80 text-orange-300 font-bold text-xs px-2.5 py-1 rounded-lg border border-orange-500/40">
                        🔄 Rasmni almashtirish
                      </span>
                    </div>
                  ) : (
                    <div className="text-center space-y-1.5 p-3">
                      <span className="text-3xl block">📸</span>
                      <p className="text-xs text-orange-400 font-bold">Rasm tanlash uchun bosing</p>
                      <p className="text-[10px] text-gray-400">JPG, PNG, WEBP formatlari</p>
                    </div>
                  )}
                </label>

                {/* Mobil Telegram uchun 100% aniq va ko'rinib turadigan tugmalar */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="seller-prod-photo-input"
                    className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-95 transition-all text-center"
                  >
                    <span>🖼️</span>
                    <span>{photoPreview ? 'Boshqa rasm tanlash' : 'Galereyadan rasm tanlash'}</span>
                  </label>
                  {(prodPhoto || photoPreview) && (
                    <button
                      type="button"
                      onClick={() => { setProdPhoto(null); setPhotoPreview(null); }}
                      className="bg-red-950/70 border border-red-800 text-red-300 py-2.5 px-3 rounded-xl text-xs font-bold active:scale-95 transition-all"
                    >
                      ✕ Bekor qilish
                    </button>
                  )}
                </div>

                <input
                  id="seller-prod-photo-input"
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,image/webp,image/*"
                  onChange={handlePhotoSelect}
                  className="sr-only"
                />
              </div>

              {/* Kategoriya tanlash */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-semibold">
                  📁 Kategoriya (Bo'lim)
                </label>
                <select
                  className="input text-xs font-semibold"
                  value={prodForm.category_id}
                  onChange={e => setProdForm(f => ({ ...f, category_id: e.target.value }))}
                >
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="new">➕ Yangi kategoriya yaratish...</option>
                </select>

                {(prodForm.category_id === 'new' || categories.length === 0) && (
                  <input
                    className="input text-xs mt-2"
                    value={prodForm.new_category_name}
                    onChange={e => setProdForm(f => ({ ...f, new_category_name: e.target.value }))}
                    placeholder="Yangi kategoriya nomi (masalan: 🍕 Pitsalar)"
                  />
                )}
              </div>

              {/* Mahsulot nomi */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-semibold">
                  🏷️ Mahsulot nomi *
                </label>
                <input
                  className="input text-sm font-bold"
                  value={prodForm.name}
                  onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Masalan: Margarita Pitsa yoki Big Burger"
                />
              </div>

              {/* Narxi */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-semibold">
                  💰 Narxi (so'mda) *
                </label>
                <input
                  type="number"
                  className="input text-sm font-extrabold text-orange-400"
                  value={prodForm.price}
                  onChange={e => setProdForm(f => ({ ...f, price: e.target.value }))}
                  placeholder="Masalan: 65000"
                />
              </div>

              {/* Mahsulot soni (Mavjud zaxira) */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-semibold flex items-center justify-between">
                  <span>📦 Mahsulot soni (Mavjud zaxira) *</span>
                  <span className="text-[10px] text-orange-400 font-normal">Mijoz ko'pi bilan shu miqdorda ola oladi</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="input text-sm font-bold text-white"
                  value={prodForm.stock}
                  onChange={e => setProdForm(f => ({ ...f, stock: e.target.value }))}
                  placeholder="Masalan: 10"
                />
              </div>

              {/* Og'irligi / Hajmi */}
              <div>
                <label className="text-xs text-gray-400 block mb-1 font-semibold">
                  ⚖️ Og'irligi / Hajmi (masalan: 350g yoki 0.5L)
                </label>
                <input
                  className="input text-xs font-semibold"
                  value={prodForm.weight}
                  onChange={e => setProdForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder="Masalan: 350g, 0.5L yoki 1 dona"
                />
                {/* Tezkor tanlash tugmalari */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {QUICK_WEIGHTS.map(w => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setProdForm(f => ({ ...f, weight: w }))}
                      className="text-[10px] bg-gray-800 hover:bg-gray-700 text-gray-300 px-2.5 py-1 rounded-lg border border-gray-700"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal DOIM KO'RINIB TURADIGAN Sticky Footer (Saqlash tugmasi) */}
            <div className="flex-shrink-0 p-3.5 bg-gray-950 border-t border-gray-800 flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={savingProd}
                className="btn-primary flex-1 py-3 text-xs font-extrabold flex items-center justify-center gap-2 shadow-xl"
              >
                <span>💾</span>
                <span>{savingProd ? '⏳ Saqlanmoqda...' : editingProdId ? 'O\'ZGARISHLARNI SAQLASH' : 'MAHSULOTNI SAQLASH'}</span>
              </button>
              <button
                type="button"
                onClick={() => setShowProdModal(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold px-3 py-3 rounded-xl text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          5. KATEGORIYA YARATISH MODALI
          ======================================================== */}
      {showAddCatModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📁</span>
                <span>Yangi Bo'lim (Kategoriya)</span>
              </h3>
              <button onClick={() => setShowAddCatModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Kategoriya nomi:</label>
              <input
                className="input text-xs font-bold"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                placeholder="Masalan: 🍕 Pitsalar"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSaveCategory()}
              />
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-gray-400">Tezkor tanlash:</p>
              <div className="flex flex-wrap gap-1">
                {QUICK_CATEGORIES.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setNewCatName(q)}
                    className="text-[10px] bg-gray-800 hover:bg-gray-700 text-orange-300 px-2 py-0.5 rounded border border-gray-700"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => handleSaveCategory()}
              disabled={savingCat}
              className="btn-primary w-full text-xs font-bold py-2.5 flex items-center justify-center gap-1 shadow-md"
            >
              <span>💾</span>
              <span>{savingCat ? 'Saqlanmoqda...' : 'Kategoriyani Saqlash'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          5. MAHSULOTNI BUTUNLAY O'CHIRISH MODALI
          ======================================================== */}
      {deleteConfirmProd && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-900 border-2 border-red-500/60 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-full bg-red-950/80 border-2 border-red-600 mx-auto flex items-center justify-center text-3xl shadow-inner">
              🗑️
            </div>
            <div>
              <h3 className="text-white font-extrabold text-base">Mahsulotni butunlay o'chirish</h3>
              <p className="text-xs text-gray-300 mt-1.5">
                <span className="text-red-400 font-bold">"{deleteConfirmProd.name}"</span> taomini ro'yxatdan butunlay o'chirib tashlamoqchimisiz?
              </p>
              <p className="text-[10px] text-gray-400 mt-1">
                Ushbu taom menyuingizdan to'liq yo'qoladi (Mavjud/Tugadi holatiga o'tmaydi, balki to'liq o'chiriladi).
              </p>
            </div>
            <div className="flex gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setDeleteConfirmProd(null)}
                className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition-colors"
              >
                Bekor qilish
              </button>
              <button
                type="button"
                onClick={confirmDeleteProduct}
                disabled={deletingProdId === deleteConfirmProd.id}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold transition-colors shadow-lg flex items-center justify-center gap-1"
              >
                <span>🗑️</span>
                <span>{deletingProdId === deleteConfirmProd.id ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
