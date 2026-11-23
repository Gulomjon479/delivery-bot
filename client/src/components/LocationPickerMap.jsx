import { useEffect, useRef, useState } from 'react'

const ok = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))

function emojiIcon(L, emoji, bg, size = 42) {
  return L.divIcon({
    className: 'custom-map-picker-icon',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:3px solid #ffffff;display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.52)}px;box-shadow:0 4px 14px rgba(0,0,0,0.55);cursor:grab;transition:transform 0.15s ease;">${emoji}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  })
}

// Haversine masofa (km)
function calcDistance(lat1, lon1, lat2, lon2) {
  if (!ok(lat1) || !ok(lon1) || !ok(lat2) || !ok(lon2)) return null
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1)
}

/**
 * LocationPickerMap - Mijoz yetkazib berish manzilini xaritada aniqlash va belgilash komponenti
 * - 📡 GPS orqali qurilma lokatsiyasini aniqlash
 * - 📍 Xaritada nuqtani tanlash (bosish yoki pinni surish)
 * - 🏪 Do'kon/restoran va mijoz orasidagi masofani hisoblash
 * - Manzil nomini avtomatik aniqlash (Nominatim geocoding)
 */
export default function LocationPickerMap({
  lat,
  lon,
  onChange,
  storeLat = null,
  storeLon = null,
  storeName = 'Savdo punkti',
  height = 250,
  required = true
}) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const storeMarkerRef = useRef(null)
  const lineRef = useRef(null)

  const [locating, setLocating] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const [geocoding, setGeocoding] = useState(false)
  const [leafletReady, setLeafletReady] = useState(Boolean(typeof window !== 'undefined' && window.L))

  const hasCoords = ok(lat) && ok(lon)

  // Leaflet yuklanishini kuzatish
  useEffect(() => {
    if (leafletReady) return
    const timer = setInterval(() => {
      if (typeof window !== 'undefined' && window.L) {
        setLeafletReady(true)
        clearInterval(timer)
      }
    }, 100)
    return () => clearInterval(timer)
  }, [leafletReady])

  // Manzil nomini koordinatadan aniqlash (reverse geocode)
  const reverseGeocode = async (cLat, cLon) => {
    try {
      setGeocoding(true)
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${cLat}&lon=${cLon}&zoom=18&addressdetails=1`, {
        headers: { 'Accept-Language': 'uz,ru,en' }
      })
      if (res.ok) {
        const data = await res.json()
        if (data && data.display_name) {
          const parts = []
          const a = data.address || {}
          if (a.road) parts.push(a.road)
          if (a.house_number) parts.push(`${a.house_number}-uy`)
          if (a.neighbourhood || a.suburb) parts.push(a.neighbourhood || a.suburb)
          if (a.city || a.town || a.county) parts.push(a.city || a.town || a.county)

          const formatted = parts.length ? parts.join(', ') : data.display_name.split(',').slice(0, 3).join(',').trim()
          return formatted
        }
      }
    } catch {
      // Nominatim ulanmasa koordinata qoladi
    } finally {
      setGeocoding(false)
    }
    return `GPS: ${cLat.toFixed(5)}, ${cLon.toFixed(5)}`
  }

  // Koordinatani yangilash
  const handleLocationUpdate = async (newLat, newLon, autoAddress = true) => {
    setGpsError('')
    let addr = ''
    if (autoAddress) {
      addr = await reverseGeocode(newLat, newLon)
    }
    if (onChange) {
      onChange({ lat: newLat, lon: newLon, address: addr })
    }
  }

  // GPS orqali aniqlash
  const handleGPS = () => {
    setLocating(true)
    setGpsError('')

    const onPosSuccess = async (pos) => {
      setLocating(false)
      const cLat = pos.coords.latitude
      const cLon = pos.coords.longitude
      if (mapRef.current) {
        mapRef.current.setView([cLat, cLon], 16)
      }
      await handleLocationUpdate(cLat, cLon, true)
    }

    const onPosError = (err) => {
      setLocating(false)
      let msg = '⚠️ GPS ruxsati berilmadi. Iltimos, xaritani bosib uyingizni belgilang!'
      if (err.code === 1) msg = '⚠️ Qurilmada joylashuvga ruxsat berilmadi. Ruxsat bering yoki xaritani bosing!'
      if (err.code === 2) msg = '⚠️ GPS signali aniqlanmadi. Xaritadan uyingizni tanlang!'
      setGpsError(msg)
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(onPosSuccess, onPosError, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      })
    } else {
      setLocating(false)
      setGpsError('⚠️ Qurilmangizda GPS qo\'llab-quvvatlanmaydi. Xaritadan belgilang.')
    }
  }

  // Koordinatalar bo'lmasa, dastlab ochilganda foydalanuvchining turgan joyini avtomatik aniqlash
  useEffect(() => {
    if (!ok(lat) || !ok(lon)) {
      handleGPS()
    }
  }, [])

  const distanceToStore = hasCoords && ok(storeLat) && ok(storeLon) ? calcDistance(lat, lon, storeLat, storeLon) : null

  // Xarita va markerlarni yaratish / yangilash
  useEffect(() => {
    if (!leafletReady || !elRef.current) return
    const L = window.L
    if (!L) return

    if (!mapRef.current) {
      if (elRef.current._leaflet_id) delete elRef.current._leaflet_id

      const center = hasCoords ? [lat, lon] : ok(storeLat) && ok(storeLon) ? [storeLat, storeLon] : [41.3111, 69.2406]
      const zoom = hasCoords ? 16 : 13

      const map = L.map(elRef.current, {
        zoomControl: true,
        attributionControl: false
      }).setView(center, zoom)

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c']
      }).addTo(map)

      // Xaritaga bosilganda lokatsiyani yangilash
      map.on('click', (e) => {
        handleLocationUpdate(e.latlng.lat, e.latlng.lng, true)
      })

      mapRef.current = map
    }

    const map = mapRef.current

    // Do'kon markeri
    if (ok(storeLat) && ok(storeLon)) {
      if (!storeMarkerRef.current) {
        storeMarkerRef.current = L.marker([storeLat, storeLon], {
          icon: emojiIcon(L, '🏪', '#ea580c', 36),
          zIndexOffset: 500
        }).addTo(map).bindPopup(`<b>🏪 ${storeName}</b>`)
      } else {
        storeMarkerRef.current.setLatLng([storeLat, storeLon])
      }
    }

    // Mijoz markeri (suriladigan - draggable)
    if (hasCoords) {
      if (!markerRef.current) {
        const marker = L.marker([lat, lon], {
          icon: emojiIcon(L, '🏠', '#16a34a', 44),
          draggable: true,
          zIndexOffset: 1000
        }).addTo(map)

        marker.on('dragend', (e) => {
          const pos = e.target.getLatLng()
          handleLocationUpdate(pos.lat, pos.lng, true)
        })

        markerRef.current = marker
      } else {
        markerRef.current.setLatLng([lat, lon])
      }

      // Do'kon va mijoz orasidagi chiziq
      if (ok(storeLat) && ok(storeLon)) {
        if (!lineRef.current) {
          lineRef.current = L.polyline([[storeLat, storeLon], [lat, lon]], {
            color: '#3b82f6',
            weight: 3,
            dashArray: '6 6',
            opacity: 0.8
          }).addTo(map)
        } else {
          lineRef.current.setLatLngs([[storeLat, storeLon], [lat, lon]])
        }
      }
    } else {
      if (markerRef.current) {
        map.removeLayer(markerRef.current)
        markerRef.current = null
      }
      if (lineRef.current) {
        map.removeLayer(lineRef.current)
        lineRef.current = null
      }
    }

    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 150)
    const timer2 = setTimeout(() => mapRef.current?.invalidateSize(), 350)
    return () => {
      clearTimeout(timer)
      clearTimeout(timer2)
    }
  }, [hasCoords, lat, lon, storeLat, storeLon, leafletReady])

  // ResizeObserver
  useEffect(() => {
    if (!elRef.current || !window.ResizeObserver) return
    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize())
    ro.observe(elRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => () => {
    if (mapRef.current) {
      try { mapRef.current.remove() } catch (e) {}
      mapRef.current = null
    }
  }, [])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-white flex items-center gap-1.5">
          <span>📍</span> Yetkazib berish joylashuvi:
          {required && <span className="text-red-400 text-xs">* (Majburiy)</span>}
        </label>
        <button
          type="button"
          onClick={handleGPS}
          disabled={locating}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 shadow-md transition-all whitespace-nowrap active:scale-95"
        >
          {locating ? (
            <>
              <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
              Aniqlanmoqda...
            </>
          ) : (
            <>
              <span>📡</span> GPS orqali aniqlash
            </>
          )}
        </button>
      </div>

      {gpsError && (
        <div className="p-2.5 bg-amber-950/70 border border-amber-600/70 rounded-xl text-xs text-amber-200">
          {gpsError}
        </div>
      )}

      {/* Xarita konteyneri */}
      <div className="relative rounded-2xl overflow-hidden border-2 border-gray-700 bg-gray-950 shadow-inner">
        <div ref={elRef} style={{ height, width: '100%' }} />

        {/* Holat nishoni */}
        <div className="absolute top-2 left-2 z-[500] pointer-events-none">
          {hasCoords ? (
            <span className="bg-green-900/90 text-green-200 border border-green-600 text-[11px] px-2.5 py-1 rounded-full font-bold shadow-md flex items-center gap-1">
              <span>✅</span> Manzil xaritada belgilandi
              {distanceToStore && ` · 🏪 ~${distanceToStore} km`}
            </span>
          ) : (
            <span className="bg-red-950/90 text-red-200 border border-red-600 text-[11px] px-2.5 py-1 rounded-full font-bold shadow-md flex items-center gap-1 animate-pulse">
              <span>⚠️</span> Xaritada uyingizni tanlang yoki GPS bosing!
            </span>
          )}
        </div>

        {geocoding && (
          <div className="absolute bottom-2 right-2 z-[500] bg-black/75 text-gray-300 text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1">
            <span className="w-2.5 h-2.5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin"></span>
            Manzil aniqlanmoqda...
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        💡 <i>Xarita ustiga bosib yoki 🏠 belgini kerakli darvozaga surib aniq joyni ko'rsatishingiz mumkin.</i>
      </p>
    </div>
  )
}
