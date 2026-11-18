// deviation-lib — pure, network-free helpers for the heuristic-vs-reference study.
//
// The runner (scripts/deviation-study.js) does the I/O (HTTP + caching). Everything
// here is deterministic and side-effect free so test/deviation-sample.test.js can
// exercise the comparison math on a committed fixture without touching the network.
//
// What we measure: for a birth moment, both engines place the 13 bodygraph
// bodies (× personality/design) on the ecliptic. free-human-design uses astronomia
// (VSOP87 + abridged lunar theory) — the "heuristic". The
// reference engine is Swiss-Ephemeris based. We compare
// the two ecliptic longitudes body-by-body and bin the disagreement by era.

const { computeActivations, signedAngleDiff } = require('../src/calc/profile');
const { parseBirthToUtc } = require('../src/birth/parseBirth');
const { iching_map } = require('../src/calc/mandala');
const { locationForTimezone } = require('../src/timezone/location');

// ---------------------------------------------------------------------------
// Deterministic sampling (seeded, so a resumed run reproduces the same births).
// ---------------------------------------------------------------------------

// A spread of IANA zones across the globe. Real zones (not Etc/GMT) so the study
// exercises the same timezone→UTC path a real user hits. lat/lng come from each
// zone's representative city via locationForTimezone().
const TZ_POOL = [
  'Pacific/Auckland', 'Australia/Sydney', 'Asia/Tokyo', 'Asia/Shanghai',
  'Asia/Bangkok', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/Moscow',
  'Europe/Athens', 'Europe/Brussels', 'Europe/London', 'Atlantic/Reykjavik',
  'America/Sao_Paulo', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'Africa/Cairo',
  'Africa/Johannesburg', 'Africa/Lagos', 'Asia/Jerusalem', 'Asia/Karachi',
  'America/Mexico_City', 'America/Argentina/Buenos_Aires', 'Europe/Warsaw',
  'Europe/Istanbul', 'Asia/Singapore', 'Australia/Perth',
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate `count` birth samples spanning [yearStart, yearEnd] inclusive.
 * Deterministic for a given seed. Uses day 1..28 so every (year, month) is valid.
 * @returns {Array<{ id, birthdate, birthtime, timezone, lat, lng, city, year }>}
 */
function generateSamples({ count, yearStart, yearEnd, seed = 20260715 } = {}) {
  const rnd = mulberry32(seed);
  const span = yearEnd - yearStart + 1;
  const out = [];
  for (let i = 0; i < count; i += 1) {
    const timezone = TZ_POOL[Math.floor(rnd() * TZ_POOL.length)];
    const loc = locationForTimezone(timezone) || { lat: 0, lng: 0, city: null };
    const year = yearStart + Math.floor(rnd() * span);
    const month = 1 + Math.floor(rnd() * 12);
    const day = 1 + Math.floor(rnd() * 28);
    const hour = Math.floor(rnd() * 24);
    const minute = Math.floor(rnd() * 60);
    const birthdate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const birthtime = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    out.push({
      id: `${birthdate}T${birthtime}_${timezone}`,
      birthdate,
      birthtime,
      timezone,
      lat: loc.lat,
      lng: loc.lng,
      city: loc.city || null,
      year,
    });
  }
  return out;
}

/** The PUT body the reference engine expects (ints + IANA tz + coords). */
function referenceRequestBody(sample) {
  const [y, m, d] = sample.birthdate.split('-').map(Number);
  const [hh, mm] = sample.birthtime.split(':').map(Number);
  return {
    year: y, month: m, day: d, hour: hh, minute: mm,
    timezone: sample.timezone, lat: sample.lat, lng: sample.lng,
  };
}

// ---------------------------------------------------------------------------
// Parsing the reference response into { body → { longitude, gate, line } }.
// ---------------------------------------------------------------------------

// Reference planet.name → rave body key.
const NAME_TO_BODY = {
  sun: 'sun', earth: 'earth', moon: 'moon',
  mercury: 'mercury', venus: 'venus', mars: 'mars', jupiter: 'jupiter',
  saturn: 'saturn', uranus: 'uranus', neptune: 'neptune', pluto: 'pluto',
  'north node': 'north_node', 'north_node': 'north_node', northnode: 'north_node',
  'true node': 'north_node', rahu: 'north_node',
  'south node': 'south_node', 'south_node': 'south_node', southnode: 'south_node',
  ketu: 'south_node',
};

function bodyFromName(name) {
  return NAME_TO_BODY[String(name || '').trim().toLowerCase()] || null;
}

/** The gate.line number of a placement: `value`, or the first numeric field. */
function placementValue(item) {
  if (item.value !== undefined) return item.value;
  return Object.values(item).find((v) => typeof v === 'number');
}

function lineFromValue(value) {
  const s = String(value ?? '');
  const dot = s.indexOf('.');
  if (dot < 0) return null;
  const line = Number(s.slice(dot + 1));
  return Number.isFinite(line) ? line : null;
}

/**
 * Normalize one reference stream (array OR keyed object) to
 * { body: { longitude, gate, line } }. `planet.position.location` is the
 * absolute tropical ecliptic longitude in degrees.
 */
function parseReferenceStream(stream) {
  const items = Array.isArray(stream) ? stream : Object.values(stream || {});
  const out = {};
  for (const item of items) {
    if (!item || !item.planet) continue;
    const body = bodyFromName(item.planet.name);
    if (!body) continue;
    const loc = item.planet.position && item.planet.position.location;
    const longitude = Number(loc);
    if (!Number.isFinite(longitude)) continue;
    out[body] = {
      longitude: ((longitude % 360) + 360) % 360,
      gate: Number(item.information && item.information.number) || null,
      line: lineFromValue(placementValue(item)),
    };
  }
  return out;
}

/** Pull { personality, design } from a raw reference-engine response. */
function parseReferenceResponse(raw) {
  // The two streams sit under `placements`, or under whichever root key holds them.
  const root = (raw && (raw.placements
    || Object.values(raw).find((v) => v && v.personality && v.design))) || raw || {};
  return {
    personality: parseReferenceStream(root.personality),
    design: parseReferenceStream(root.design),
  };
}

// ---------------------------------------------------------------------------
// Comparison.
// ---------------------------------------------------------------------------

// Global line index on the 384-line wheel (mirrors reference-charts.test.js).
function wheelIndex(gate, line) {
  const i = iching_map.indexOf(gate);
  if (i < 0) return null;
  return i * 6 + (line - 1);
}
function wheelLineSteps(gateA, lineA, gateB, lineB) {
  const a = wheelIndex(gateA, lineA);
  const b = wheelIndex(gateB, lineB);
  if (a == null || b == null) return null;
  const d = Math.abs(a - b);
  return Math.min(d, 64 * 6 - d);
}

/** |shortest angular difference| in degrees. */
function deltaDegrees(a, b) {
  return Math.abs(signedAngleDiff(a, b));
}

/**
 * Compare rave's activations against a parsed reference response for one sample.
 * @returns {Array<row>} one row per (stream, body) present on both sides.
 */
function compareSample(sample, referenceParsed) {
  const rave = computeActivations({ birthUtc: parseBirthToUtc(sample) });
  const raveByStream = {
    personality: Object.fromEntries(rave.personality.map((a) => [a.body, a])),
    design: Object.fromEntries(rave.design.map((a) => [a.body, a])),
  };
  const rows = [];
  for (const stream of ['personality', 'design']) {
    const off = referenceParsed[stream] || {};
    for (const [body, o] of Object.entries(off)) {
      const r = raveByStream[stream][body];
      if (!r) continue;
      const dDeg = deltaDegrees(r.longitude, o.longitude);
      rows.push({
        year: sample.year,
        timezone: sample.timezone,
        stream,
        body,
        raveLon: r.longitude,
        offLon: o.longitude,
        deltaDeg: dDeg,
        deltaArcmin: dDeg * 60,
        gateMatch: o.gate != null ? r.gate === o.gate : null,
        lineMatch: o.line != null ? r.line === o.line : null,
        wheelSteps: o.gate != null && o.line != null
          ? wheelLineSteps(r.gate, r.line, o.gate, o.line) : null,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Aggregation by 20-year bucket.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// profile placements → (stream, body).
//
// Mirrors computeHexagramProfile() in src/calc/profile.js. This is the subset of
// the 26 activations that a hexagram profile actually reads. Note
// what it never touches: Pluto, Neptune, and the lunar nodes — precisely the
// bodies that dominate the heuristic's deviation — so placement-level accuracy is
// markedly higher than the all-26-body figure.
const PROFILE_KEYS = {
  p_sun: { stream: 'personality', body: 'sun' },
  p_earth: { stream: 'personality', body: 'earth' },
  d_sun: { stream: 'design',      body: 'sun' },
  d_earth: { stream: 'design',      body: 'earth' },
  p_mercury: { stream: 'personality', body: 'mercury' },
  p_venus: { stream: 'personality', body: 'venus' },
  p_mars: { stream: 'personality', body: 'mars' },
  p_jupiter: { stream: 'personality', body: 'jupiter' },
  d_moon: { stream: 'design',      body: 'moon' },
  d_venus: { stream: 'design',      body: 'venus' },
  d_mars: { stream: 'design',      body: 'mars' },
  d_jupiter: { stream: 'design',      body: 'jupiter' },
  d_saturn: { stream: 'design',      body: 'saturn' },
  d_uranus: { stream: 'design',      body: 'uranus' },
};

const SPHERE_BY_KEY = (() => {
  const m = {};
  for (const [sphere, { stream, body }] of Object.entries(PROFILE_KEYS)) {
    m[`${stream}|${body}`] = sphere;
  }
  return m;
})();

/** The sphere name a comparison row belongs to, or null if it's not a sphere body. */
function profileKeyForRow(row) {
  return SPHERE_BY_KEY[`${row.stream}|${row.body}`] || null;
}

function bucketStart(year, width = 20) {
  return Math.floor(year / width) * width;
}

function stats(values) {
  const v = values.filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  const n = v.length;
  if (!n) return { n: 0, mean: null, median: null, p95: null, max: null };
  const sum = v.reduce((s, x) => s + x, 0);
  const q = (p) => v[Math.min(n - 1, Math.floor(p * (n - 1)))];
  return {
    n,
    mean: sum / n,
    median: q(0.5),
    p95: q(0.95),
    max: v[n - 1],
  };
}

function rate(bools) {
  const b = bools.filter((x) => x === true || x === false);
  if (!b.length) return null;
  return b.filter(Boolean).length / b.length;
}

/**
 * Aggregate comparison rows into 20-year buckets.
 * @returns {{ width, buckets: Array<bucketStat>, byBody: Object, overall: object }}
 */
function aggregate(rows, { width = 20 } = {}) {
  const byBucket = new Map();
  for (const row of rows) {
    const start = bucketStart(row.year, width);
    if (!byBucket.has(start)) byBucket.set(start, []);
    byBucket.get(start).push(row);
  }
  const buckets = [...byBucket.keys()].sort((a, b) => a - b).map((start) => {
    const rs = byBucket.get(start);
    return {
      bucketStart: start,
      bucketEnd: start + width - 1,
      samples: new Set(rs.map((r) => `${r.year}|${r.timezone}`)).size,
      rows: rs.length,
      deltaArcmin: stats(rs.map((r) => r.deltaArcmin)),
      gateMatch: rate(rs.map((r) => r.gateMatch)),
      lineMatch: rate(rs.map((r) => r.lineMatch)),
      // Pluto is the body whose Δ grows most with era (long-term orbit is the
      // hardest to approximate); tracked separately so the era trend is visible.
      plutoArcmin: stats(rs.filter((r) => r.body === 'pluto').map((r) => r.deltaArcmin)),
    };
  });

  const bodies = [...new Set(rows.map((r) => r.body))];
  const byBody = {};
  for (const body of bodies) {
    const rs = rows.filter((r) => r.body === body);
    byBody[body] = {
      deltaArcmin: stats(rs.map((r) => r.deltaArcmin)),
      gateMatch: rate(rs.map((r) => r.gateMatch)),
      lineMatch: rate(rs.map((r) => r.lineMatch)),
    };
  }

  return {
    width,
    buckets,
    byBody,
    overall: {
      rows: rows.length,
      deltaArcmin: stats(rows.map((r) => r.deltaArcmin)),
      gateMatch: rate(rows.map((r) => r.gateMatch)),
      lineMatch: rate(rows.map((r) => r.lineMatch)),
    },
  };
}

/**
 * Same aggregation, but limited to the profile placements and broken out
 * per sphere. Overall + buckets use only sphere-relevant rows (so the era curve
 * reflects what a real profile experiences); `byKey` gives each sphere's Δ.
 * @returns {{ width, buckets, byBody, overall, byKey, keyCount }}
 */
function aggregateProfile(rows, { width = 20 } = {}) {
  const relevant = rows.filter((r) => profileKeyForRow(r));
  const base = aggregate(relevant, { width });
  const byKey = {};
  for (const sphere of Object.keys(PROFILE_KEYS)) {
    const rs = relevant.filter((r) => profileKeyForRow(r) === sphere);
    byKey[sphere] = {
      stream: PROFILE_KEYS[sphere].stream,
      body: PROFILE_KEYS[sphere].body,
      deltaArcmin: stats(rs.map((r) => r.deltaArcmin)),
      gateMatch: rate(rs.map((r) => r.gateMatch)),
      lineMatch: rate(rs.map((r) => r.lineMatch)),
    };
  }
  return { ...base, byKey, keyCount: Object.keys(PROFILE_KEYS).length };
}

module.exports = {
  TZ_POOL,
  mulberry32,
  generateSamples,
  referenceRequestBody,
  bodyFromName,
  lineFromValue,
  parseReferenceStream,
  parseReferenceResponse,
  wheelLineSteps,
  deltaDegrees,
  compareSample,
  bucketStart,
  stats,
  rate,
  aggregate,
  PROFILE_KEYS,
  profileKeyForRow,
  aggregateProfile,
};
