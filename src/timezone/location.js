// Resolve a representative geographic location (lat/lng) for an IANA timezone.
//
// The extended-astrology section (Ascendant / MC / houses) needs a birth
// LOCATION, not just a timezone. To let a user "just pick the timezone they were
// born in" and still get angles, we derive a representative location from the
// most-populous city in that timezone (data from `city-timezones`). An explicit
// { lat, lng } always overrides this.

const cityTimezones = require('city-timezones');

let _byTz = null;

// Index cityMapping by IANA timezone → most-populous city, built once.
function buildIndex() {
  if (_byTz) return _byTz;
  const byTz = new Map();
  for (const c of cityTimezones.cityMapping) {
    if (!c || !c.timezone || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    const existing = byTz.get(c.timezone);
    if (!existing || (c.pop || 0) > (existing.pop || 0)) {
      byTz.set(c.timezone, c);
    }
  }
  _byTz = byTz;
  return _byTz;
}

/**
 * Representative location for an IANA timezone (its most-populous city).
 * @param {string} ianaName e.g. "Asia/Bangkok"
 * @returns {{ lat:number, lng:number, city:string, province:string|null,
 *   country:string|null, source:'timezone-city' }|null}
 */
function locationForTimezone(ianaName) {
  if (!ianaName) return null;
  const hit = buildIndex().get(ianaName);
  if (!hit) return null;
  return {
    lat: hit.lat,
    lng: hit.lng,
    city: hit.city || hit.city_ascii || null,
    province: hit.province || null,
    country: hit.country || null,
    source: 'timezone-city',
  };
}

/**
 * Normalize a location input. Accepts either explicit coordinates or falls back
 * to the timezone's representative city.
 *
 * @param {{ lat?:number, lng?:number, timezone?:string }} input
 * @returns {{ lat:number, lng:number, source:string, city?, country? }|null}
 */
function resolveLocation(input = {}) {
  const { lat, lng, timezone } = input;
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, source: 'explicit' };
  }
  if (timezone) {
    const loc = locationForTimezone(timezone);
    if (loc) return loc;
  }
  return null;
}

module.exports = { locationForTimezone, resolveLocation };
