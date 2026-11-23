import { useEffect, useRef, useState } from 'react'

const ok = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
const pt = (lat, lon) => (ok(lat) && ok(lon) ? [Number(lat), Number(lon)] : null)

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function labeledIcon(L, emoji, bg, labelText, badgeBg = bg, size = 42) {
  const cleanLabel = escapeHtml(String(labelText || '').trim().slice(0, 36))
  return L.divIcon({
    className: 'custom-map-labeled-marker',
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;pointer-events:auto;cursor:pointer;user-select:none;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.6));">
        ${cleanLabel ? `
          <div style="background:${badgeBg};color:#ffffff;font-size:11px;font-weight:900;padding:4px 10px;border-radius:14px;box-shadow:0 3px 10px rgba(0,0,0,0.7);white-space:nowrap;border:2px solid #ffffff;letter-spacing:0.3px;margin-bottom:3px;text-shadow:0 1px 2px rgba(0,0,0,0.7);line-height:1.2;">
            ${cleanLabel}
          </div>
        ` : ''}
        <div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.52)}px;box-shadow:0 4px 12px rgba(0,0,0,0.6);transition:transform 0.15s ease;">
          ${emoji}
        </div>
        <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #ffffff;margin-top:-1px;"></div>
      </div>
    `,
    iconSize: [160, 80],
    iconAnchor: [80, 80],
    popupAnchor: [0, -82]
  })
}

function openLink(url) {
  if (window.Telegram?.WebApp?.openLink) window.Telegram.WebApp.openLink(url)
  else window.open(url, '_blank')
}

/**
 * Yandex Navigator / Maps orqali avtomatik marshrut chizish
 * rtext parametrida start va destination beriladi yoki ~dest orqali jonli GPS dan avtoyo'l chiziladi
 */
function openYandexNav(destLat, destLon, fromLat, fromLon) {
  if (!ok(destLat) || !ok(destLon)) return
  const hasFrom = ok(fromLat) && ok(fromLon) && (Math.abs(Number(fromLat) - Number(destLat)) > 0.0001 || Math.abs(Number(fromLon) - Number(destLon)) > 0.0001)
  const rtext = hasFrom ? `${fromLat},${fromLon}~${destLat},${destLon}` : `~${destLat},${destLon}`
  const url = `https://yandex.uz/maps/?rtext=${encodeURIComponent(rtext)}&rtt=auto`
  openLink(url)
}

/**
 * Google Maps orqali avtomatik navigatsiya va chiziq chizish
 * dir_action=navigate parametri navigatsiyani to'g'ridan-to'g'ri ishga tushiradi
 */
function openGoogleNav(destLat, destLon, fromLat, fromLon) {
  if (!ok(destLat) || !ok(destLon)) return
  const hasFrom = ok(fromLat) && ok(fromLon) && (Math.abs(Number(fromLat) - Number(destLat)) > 0.0001 || Math.abs(Number(fromLon) - Number(destLon)) > 0.0001)
  const originParam = hasFrom ? `&origin=${fromLat},${fromLon}` : ''
  const url = `https://www.google.com/maps/dir/?api=1${originParam}&destination=${destLat},${destLon}&travelmode=driving&dir_action=navigate`
  openLink(url)
}

/**
 * RouteMap - Interaktiv navigatsiya xaritasi:
 * - 🏪 Magazinga borish yo'li (Kuryer -> Magazin)
 * - 🏠 Mijoz oldiga borish yo'li (Kuryer -> Mijoz)
 * - Yandex Navigator & Google Maps orqali avtomatik chiziq chizish
 */
export default function RouteMap({
  sellerLat, sellerLon, sellerLabel = 'Sotuvchi do\'koni',
  customerLat, customerLon, customerLabel = 'Mijoz manzili',
  courierLat = null, courierLon = null,
  status = 'ready', distanceKm = null, height = 300, showDetails = true,
  showCourierRadius = false, extraMarkers = [], onMapClick = null
}) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const [info, setInfo] = useState(null)
  const [leafletReady, setLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L))

  // Kuryer qayerga borishini tanlash: 'store' (Magazinga) yoki 'customer' (Mijozga)
  const [activeTarget, setActiveTarget] = useState(status === 'delivering' ? 'customer' : 'store')

  useEffect(() => {
    if (status === 'delivering') setActiveTarget('customer')
    else if (status === 'accepted') setActiveTarget('store')
  }, [status])

  useEffect(() => {
    if (leafletReady) return
    const checkInterval = setInterval(() => {
      if (typeof window !== 'undefined' && window.L) {
        setLeafletReady(true)
        clearInterval(checkInterval)
      }
    }, 100)
    return () => clearInterval(checkInterval)
  }, [leafletReady])

  const pickup = pt(sellerLat, sellerLon)
  const drop = pt(customerLat, customerLon)
  const courier = pt(courierLat, courierLon)

  // Tanlangan nishonga qarab navigatsiya start va finish nuqtasi
  let from = null
  let to = null
  let targetName = ''
  let targetColor = '#ea580c'

  if (activeTarget === 'store') {
    from = courier || drop
    to = pickup
    targetName = sellerLabel ? `🏪 Magazin: ${sellerLabel}` : "🏪 Magazin (Do'kon)"
    targetColor = '#ea580c'
  } else {
    from = courier || pickup
    to = drop
    targetName = customerLabel ? `🏠 Mijoz: ${customerLabel}` : "🏠 Mijoz manzili"
    targetColor = '#16a34a'
  }

  const key = JSON.stringify([pickup, drop, courier, activeTarget, extraMarkers, showCourierRadius])

  useEffect(() => {
    if (!leafletReady || !elRef.current) return
    const L = window.L
    if (!L) return

    if (!mapRef.current) {
      if (elRef.current._leaflet_id) {
        delete elRef.current._leaflet_id
      }
      const initialCenter = courier || pickup || drop || [41.3111, 69.2406]
      const map = L.map(elRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(initialCenter, 13)

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map)

      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map

      if (onMapClick) {
        map.on('click', (e) => {
          onMapClick({ lat: e.latlng.lat, lon: e.latlng.lng })
        })
      }
    }

    const map = mapRef.current
    const layer = layerRef.current
    layer.clearLayers()
    const bounds = []

    // 20 km Kuryer xizmat radiusi (ko'k shaffof doira)
    if (showCourierRadius && courier) {
      L.circle(courier, {
        radius: 20000,
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.10,
        weight: 2,
        dashArray: '6, 6'
      }).addTo(layer).bindPopup('<b>📍 Sizning 20 km xizmat radiusingiz</b><br/>Faqat shu radius ichidagi buyurtmalar keladi.')
    }

    // 🏪 1. Magazin / Sotuvchi do'koni markeri
    if (pickup) {
      const magazinLabel = `🏪 Magazin: ${sellerLabel || "Do'kon"}`
      const mStore = L.marker(pickup, {
        icon: labeledIcon(L, '🏪', '#ea580c', magazinLabel, '#c2410c', 42),
        zIndexOffset: 950
      }).addTo(layer)

      mStore.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;min-width:180px;line-height:1.4;">
          <b style="color:#ea580c;font-size:13px;">🏪 MAGAZIN (Savdo punkti)</b><br/>
          <b>Nomi:</b> ${escapeHtml(sellerLabel || "Do'kon")}<br/>
          <span style="color:#666;font-size:11px;">Kuryer bu yerga borib taomni oladi.</span>
        </div>
      `)
      mStore.on('click', () => setActiveTarget('store'))
      bounds.push(pickup)
    }

    // 🚴 2. Kuryer markeri (Siz)
    if (courier) {
      const mCourier = L.marker(courier, {
        icon: labeledIcon(L, '🚴', '#2563eb', '🚴 Kuryer (Siz)', '#1d4ed8', 42),
        zIndexOffset: 1000
      }).addTo(layer)

      mCourier.bindPopup('<b>🚴 Sizning joylashuvingiz (Kuryer)</b><br/>Jonli GPS faol')
      bounds.push(courier)
    }

    // 🏠 3. Mijoz manzili markeri
    if (drop) {
      const mDrop = L.marker(drop, {
        icon: labeledIcon(L, '🏠', '#16a34a', '🏠 Mijoz manzili', '#15803d', 42),
        zIndexOffset: 900
      }).addTo(layer)

      mDrop.bindPopup(`
        <div style="font-family:sans-serif;font-size:12px;min-width:180px;line-height:1.4;">
          <b style="color:#16a34a;font-size:13px;">🏠 MIJOZ MANZILI</b><br/>
          ${escapeHtml(customerLabel || 'Mijoz')}<br/>
          <span style="color:#666;font-size:11px;">Yetkazib berish manzili (Jonli GPS)</span>
        </div>
      `)
      mDrop.on('click', () => setActiveTarget('customer'))
      bounds.push(drop)
    }

    // Xaritadagi boshqa barcha magazinlar / buyurtmalar (extraMarkers)
    if (Array.isArray(extraMarkers)) {
      extraMarkers.forEach((m) => {
        const p = pt(m.lat, m.lon)
        if (!p) return
        const isCurrent = (pickup && Math.abs(p[0] - pickup[0]) < 0.0001 && Math.abs(p[1] - pickup[1]) < 0.0001)
        if (isCurrent) return

        const markerLabel = m.storeLabel ? `🏪 Magazin: ${m.storeLabel}` : `🏪 Magazin: ${m.subtitle || m.title || "Do'kon"}`
        const marker = L.marker(p, {
          icon: labeledIcon(L, m.icon || '🏪', m.bg || '#ea580c', markerLabel, '#c2410c', 36),
          zIndexOffset: 700
        }).addTo(layer)

        const popupContent = `
          <div style="font-family:sans-serif;font-size:12px;min-width:170px;">
            <b style="color:#ea580c;font-size:13px;">🏪 MAGAZIN: ${escapeHtml(m.subtitle || 'Savdo punkti')}</b><br/>
            <div style="margin-top:2px;">${escapeHtml(m.title || 'Buyurtma')}</div>
            ${m.distance != null ? `<div style="color:#0284c7;font-weight:bold;margin-top:4px;">📏 Masofa: ~${m.distance} km</div>` : ''}
          </div>
        `
        marker.bindPopup(popupContent)
        if (m.onClick) {
          marker.on('click', () => m.onClick(m))
        }
        bounds.push(p)
      })
    }

    // Umumiy bog'lovchi yo'l (magazin <-> mijoz) och uzuq-yuluq chiziq
    if (pickup && drop) {
      L.polyline([pickup, drop], { color: '#64748b', weight: 3, dashArray: '6 8', opacity: 0.65 }).addTo(layer)
    }

    // AVTOMATIK MARSHRUT CHIZISH: Tanlangan nuqtagacha to'g'ridan-to'g'ri avtoyo'l chizig'i
    let aborted = false
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null

    if (from && to) {
      const isSamePoint = Math.abs(from[0] - to[0]) < 0.0001 && Math.abs(from[1] - to[1]) < 0.0001
      if (!isSamePoint) {
        // Dastlab to'g'ri chiziq chiziladi
        const straight = L.polyline([from, to], { color: targetColor, weight: 4, dashArray: '8 6', opacity: 0.85 }).addTo(layer)
        setInfo(null)

        // OSRM orqali haqiqiy avtomobil yo'li (marshrut) chiziladi
        fetch(`https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`, { signal: ctrl?.signal })
          .then((r) => r.json())
          .then((d) => {
            if (aborted || !d.routes?.[0]) return
            const route = d.routes[0]
            try { layer.removeLayer(straight) } catch (e) {}
            const coords = route.geometry.coordinates.map(([lo, la]) => [la, lo])
            L.polyline(coords, { color: targetColor, weight: 6, opacity: 0.95 }).addTo(layer)
            setInfo({
              km: (route.distance / 1000).toFixed(1),
              min: Math.max(1, Math.round(route.duration / 60)),
              real: true
            })
            map.fitBounds(L.latLngBounds(coords).extend(bounds.length ? bounds : coords), { padding: [40, 40] })
          })
          .catch(() => {})
      } else {
        setInfo({ km: '0.0', min: 1, real: true })
      }
    }

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14)
    }

    const timers = [
      setTimeout(() => mapRef.current?.invalidateSize(), 100),
      setTimeout(() => mapRef.current?.invalidateSize(), 300),
      setTimeout(() => mapRef.current?.invalidateSize(), 700)
    ]

    return () => {
      aborted = true
      ctrl?.abort()
      timers.forEach(t => clearTimeout(t))
    }
  }, [key, leafletReady, activeTarget])

  // ResizeObserver
  useEffect(() => {
    if (!elRef.current || !window.ResizeObserver) return
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize()
    })
    ro.observe(elRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => {
    if (mapRef.current) {
      try { mapRef.current.remove() } catch (e) {}
      mapRef.current = null
    }
  }, [])

  const missing = []
  if (!pickup && !extraMarkers.length) missing.push('🏪 magazin koordinatasi yo\'q')
  if (!drop && activeTarget === 'customer') missing.push('🏠 mijoz koordinatasi yo\'q')

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-700/80 overflow-hidden shadow-lg">
      {/* 1. Manzilni tanlash tugmalari: Magazingami yoki Mijozgami? */}
      <div className="p-2 bg-gray-950 border-b border-gray-800 grid grid-cols-2 gap-2 text-xs">
        <button
          type="button"
          onClick={() => setActiveTarget('store')}
          className={`py-2 px-3 rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
            activeTarget === 'store'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white ring-2 ring-orange-400'
              : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
          }`}
        >
          <span>🏪</span> 1. Magazinga borish
        </button>

        <button
          type="button"
          onClick={() => setActiveTarget('customer')}
          className={`py-2 px-3 rounded-xl font-extrabold flex items-center justify-center gap-1.5 transition-all shadow-sm ${
            activeTarget === 'customer'
              ? 'bg-gradient-to-r from-emerald-600 to-green-600 text-white ring-2 ring-green-400'
              : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
          }`}
        >
          <span>🏠</span> 2. Mijoz oldiga borish
        </button>
      </div>

      {/* Sarlavha va joriy masofa */}
      <div className="px-3.5 py-2.5 bg-gray-800/90 border-b border-gray-700 flex items-center justify-between text-xs gap-2">
        <span className="font-bold text-white flex items-center gap-1.5 truncate">
          <span>{activeTarget === 'store' ? '🏪' : '🏠'}</span>
          <span>Yo'nalish: <b className={activeTarget === 'store' ? 'text-orange-400' : 'text-green-400'}>{activeTarget === 'store' ? "Magazin (Taomni olish)" : "Mijoz (Yetkazish)"}</b></span>
        </span>
        {(info || distanceKm) && (
          <span className={`px-2.5 py-1 rounded-full font-extrabold whitespace-nowrap text-xs border ${
            activeTarget === 'store'
              ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
              : 'bg-green-500/20 text-green-300 border-green-500/40'
          }`}>
            📏 {info ? `${info.km} km · ~${info.min} daq` : `~${distanceKm} km`}
          </span>
        )}
      </div>

      {/* Interaktiv Xarita */}
      <div className="relative">
        <div ref={elRef} style={{ height, width: '100%', background: '#0f172a' }} />
        {!leafletReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 text-gray-400 text-xs">
            ⏳ Xarita yuklanmoqda...
          </div>
        )}
      </div>

      {showDetails && (
        <div className="p-3 bg-gray-800/80 border-t border-gray-700/80 space-y-3 text-xs">
          {/* Asosiy Navigator tugmalari (Yandex va Google Maps) */}
          {to && (
            <div className="space-y-1.5 bg-gray-900/90 p-3 rounded-xl border border-gray-700">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span>🧭</span>
                  <span>{activeTarget === 'store' ? "🏪 Magazinga avto-marshrut:" : "🏠 Mijozga avto-marshrut:"}</span>
                </span>
                <span className="text-[11px] text-green-400 font-bold">Avtomatik chiziq chiziladi</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => openYandexNav(to[0], to[1], courier?.[0], courier?.[1])}
                  className="bg-yellow-500 hover:bg-yellow-400 text-black font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs shadow-lg active:scale-95"
                >
                  <span>🟡</span> Yandex Navigator
                </button>

                <button
                  type="button"
                  onClick={() => openGoogleNav(to[0], to[1], courier?.[0], courier?.[1])}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-extrabold py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all text-xs shadow-lg active:scale-95"
                >
                  <span>🔵</span> Google Maps
                </button>
              </div>
            </div>
          )}

          {/* 1. Magazin qutisi */}
          {pickup && (
            <div className={`rounded-xl p-2.5 border transition-all ${
              activeTarget === 'store'
                ? 'bg-orange-950/60 border-orange-500 ring-1 ring-orange-500'
                : 'bg-gray-900/80 border-gray-700'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-xl leading-none">🏪</span>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-orange-400 block">
                      1. MAGAZIN (SAVDO PUNKTI)
                    </span>
                    <span className="text-white font-bold text-sm block">
                      {sellerLabel || "Do'kon"}
                    </span>
                    <span className="text-gray-400 text-[11px] block mt-0.5">
                      Kuryer taomni qabul qiladigan joy
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTarget('store')
                      openYandexNav(pickup[0], pickup[1], courier?.[0], courier?.[1])
                    }}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap shadow"
                  >
                    <span>🟡</span> Yandex
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTarget('store')
                      openGoogleNav(pickup[0], pickup[1], courier?.[0], courier?.[1])
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap shadow"
                  >
                    <span>🔵</span> Google
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. Mijoz manzili qutisi */}
          {drop && (
            <div className={`rounded-xl p-2.5 border transition-all ${
              activeTarget === 'customer'
                ? 'bg-green-950/60 border-green-500 ring-1 ring-green-500'
                : 'bg-gray-900/80 border-gray-700'
            }`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 flex-1">
                  <span className="text-xl leading-none">🏠</span>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-extrabold text-green-400 block">
                      2. MIJOZ MANZILI (YETKAZISH PUNKTI)
                    </span>
                    <span className="text-white font-bold text-sm block">
                      {customerLabel || 'Mijoz'}
                    </span>
                    <span className="text-gray-400 text-[11px] block mt-0.5">
                      Yetkazib beriladigan manzil (Jonli GPS)
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTarget('customer')
                      openYandexNav(drop[0], drop[1], courier?.[0], courier?.[1])
                    }}
                    className="bg-yellow-500 hover:bg-yellow-400 text-black text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap shadow"
                  >
                    <span>🟡</span> Yandex
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTarget('customer')
                      openGoogleNav(drop[0], drop[1], courier?.[0], courier?.[1])
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 whitespace-nowrap shadow"
                  >
                    <span>🔵</span> Google
                  </button>
                </div>
              </div>
            </div>
          )}

          {missing.length > 0 && (
            <div className="p-2 bg-amber-950/60 border border-amber-800/80 rounded-xl text-amber-300 text-[11px]">
              ⚠️ Eslatma: {missing.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
