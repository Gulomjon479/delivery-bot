// Haversine formulasi bo'yicha ikki koordinata orasidagi masofani (km) hisoblash
function getDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const nLat1 = Number(lat1), nLon1 = Number(lon1);
  const nLat2 = Number(lat2), nLon2 = Number(lon2);
  if (!Number.isFinite(nLat1) || !Number.isFinite(nLon1) || !Number.isFinite(nLat2) || !Number.isFinite(nLon2)) return null;

  const R = 6371; // Yer radiusi (km)
  const dLat = (nLat2 - nLat1) * Math.PI / 180;
  const dLon = (nLon2 - nLon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * Math.PI / 180) * Math.cos(nLat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Kuryer qabul qilishi mumkin bo'lgan maksimal radius (km)
const MAX_COURIER_RADIUS_KM = 20.0;

// Masofa bo'yicha kuryer ulushini hisoblash (1 km narxi bo'yicha, minimal 1 km)
function calculateCourierFee(sellerLat, sellerLon, customerLat, customerLon, pricePerKm = 3000) {
  const rate = Math.max(0, Math.round(Number(pricePerKm) || 0));
  const rawDist = getDistanceKm(sellerLat, sellerLon, customerLat, customerLon);
  if (rawDist === null) {
    return { distanceKm: 1, billedKm: 1, courierFee: rate };
  }
  const distanceKm = Number(rawDist.toFixed(1));
  const billedKm = Math.max(1, distanceKm);
  const courierFee = Math.round(billedKm * rate);
  return { distanceKm, billedKm, courierFee };
}

module.exports = {
  getDistanceKm,
  calculateCourierFee,
  MAX_COURIER_RADIUS_KM
};
