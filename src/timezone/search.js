const { getTimeZones } = require('@vvo/tzdb');
const cityTimezones = require('city-timezones');

// Build the tzdb index once. ~400 entries.
//
// We index by lowercased IANA name for O(1) merge lookups, and keep a flat list
// for substring scanning. Each entry carries a precomputed `searchHaystack`
// string so scoring is just a few `indexOf` calls.
let _tzIndex = null;

function buildTzIndex() {
  if (_tzIndex) return _tzIndex;
  const list = getTimeZones();
  const byIana = new Map();
  const indexed = list.map((z) => {
    const haystackParts = [
      z.name,
      z.alternativeName,
      z.abbreviation,
      z.countryName,
      z.countryCode,
      ...(z.mainCities || []),
      ...(z.group || []),
    ].filter(Boolean);

    const entry = {
      ianaName: z.name,
      alternativeName: z.alternativeName,
      countryName: z.countryName,
      countryCode: z.countryCode,
      mainCities: z.mainCities || [],
      mainCity: (z.mainCities && z.mainCities[0]) || null,
      currentOffsetMinutes: z.currentTimeOffsetInMinutes,
      rawOffsetMinutes: z.rawOffsetInMinutes,
      abbreviation: z.abbreviation,
      currentTimeFormat: z.currentTimeFormat,
      _haystack: haystackParts.join('\u0001').toLowerCase(),
      _ianaLower: z.name.toLowerCase(),
      _altLower: (z.alternativeName || '').toLowerCase(),
      _citiesLower: (z.mainCities || []).map((c) => c.toLowerCase()),
    };

    byIana.set(entry._ianaLower, entry);
    return entry;
  });

  _tzIndex = { list: indexed, byIana };
  return _tzIndex;
}

function formatOffset(minutes) {
  if (!Number.isFinite(minutes)) return '';
  const sign = minutes >= 0 ? '+' : '-';
  const abs = Math.abs(minutes);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
}

function buildLabel(entry, hintCity) {
  const offset = formatOffset(entry.currentOffsetMinutes);
  const city = hintCity || entry.mainCity;
  const cityPart = city ? ` — ${city}` : '';
  const countryPart = entry.countryName ? ` (${entry.countryName})` : '';
  return `${entry.ianaName} ${offset}${cityPart}${countryPart}`.trim();
}

/**
 * Score a tzdb entry against a lowercased query.
 * Higher is better; 0 means "no match".
 */
function scoreTzEntry(entry, q) {
  if (!q) return 0;

  // Strongest: exact IANA hit.
  if (entry._ianaLower === q) return 1000;

  // IANA prefix / contains.
  if (entry._ianaLower.startsWith(q)) return 800;
  // Match against the segment after a slash, e.g. "tokyo" → "asia/tokyo".
  const lastSegment = entry._ianaLower.split('/').pop();
  if (lastSegment.startsWith(q)) return 750;

  // City prefix.
  for (const c of entry._citiesLower) {
    if (c === q) return 700;
    if (c.startsWith(q)) return 650;
  }

  // Alternative name prefix (e.g. "central european" → "Central European Time").
  if (entry._altLower.startsWith(q)) return 500;

  // Generic contains anywhere in the haystack.
  if (entry._haystack.includes(q)) return 200;

  return 0;
}

/**
 * Search timezones by free-text query.
 *
 * Combines @vvo/tzdb (rich IANA metadata + current offsets) with
 * city-timezones (city → IANA lookup, including province/state matches like
 * "Bali" → Asia/Makassar). Results are deduplicated by IANA name and ranked
 * by a small scoring function.
 *
 * @param {string} query
 * @param {{ limit?: number }} [options]
 * @returns {Array<{
 *   ianaName: string,
 *   mainCity: string|null,
 *   countryName: string|null,
 *   currentOffsetMinutes: number,
 *   abbreviation: string|null,
 *   label: string,
 *   score: number,
 * }>}
 */
function searchTimezones(query, options = {}) {
  const limit = Number.isFinite(options.limit) ? options.limit : 10;
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];

  const { list, byIana } = buildTzIndex();

  // 1) Score every tzdb entry directly.
  const scored = new Map(); // ianaLower -> { entry, score, hintCity }
  for (const entry of list) {
    const s = scoreTzEntry(entry, q);
    if (s > 0) {
      scored.set(entry._ianaLower, { entry, score: s, hintCity: null });
    }
  }

  // 2) Mine city-timezones for province/state-level hits and fold them in.
  //    findFromCityStateProvince does case-insensitive substring matching across
  //    city, state and province, which is what makes "bali" → Asia/Makassar work.
  let cityHits = [];
  try {
    cityHits = cityTimezones.findFromCityStateProvince(q) || [];
  } catch (_e) {
    cityHits = [];
  }

  for (const hit of cityHits) {
    if (!hit || !hit.timezone) continue;
    const ianaLower = String(hit.timezone).toLowerCase();
    const entry = byIana.get(ianaLower);
    if (!entry) continue;

    // City score: lower than direct IANA/city tzdb hits (which the loop above
    // already caught), but better than a generic substring miss.
    const cityScore = 600;

    const existing = scored.get(ianaLower);
    if (!existing || existing.score < cityScore) {
      scored.set(ianaLower, { entry, score: cityScore, hintCity: hit.city });
    } else if (!existing.hintCity && hit.city) {
      // Keep the higher score, but enrich the label with the matched city name.
      existing.hintCity = hit.city;
    }
  }

  return Array.from(scored.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      // Tie-break: prefer larger populations indirectly via tzdb's "main city"
      // ordering. Falls back to alphabetical.
      return a.entry.ianaName.localeCompare(b.entry.ianaName);
    })
    .slice(0, limit)
    .map(({ entry, score, hintCity }) => ({
      ianaName: entry.ianaName,
      mainCity: entry.mainCity,
      countryName: entry.countryName,
      currentOffsetMinutes: entry.currentOffsetMinutes,
      abbreviation: entry.abbreviation,
      label: buildLabel(entry, hintCity),
      score,
    }));
}

module.exports = { searchTimezones, formatOffset };
