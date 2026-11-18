// Offline guard for the deviation study's comparison math (scripts/deviation-lib).
// Uses a committed fixture (one real reference-engine response for the
// 1992-12-09 00:35 Brussels reference moment) — NO network. If the parsing,
// body-name mapping, longitude comparison, or bucketing regress, this fails.

const fixture = require('./fixtures/reference-brussels-1992.json');
const {
  generateSamples,
  parseReferenceResponse,
  parseReferenceStream,
  compareSample,
  aggregate,
  aggregateProfile,
  PROFILE_KEYS,
  profileKeyForRow,
  bucketStart,
  stats,
  rate,
  deltaDegrees,
  wheelLineSteps,
  bodyFromName,
  lineFromValue,
  referenceRequestBody,
} = require('../scripts/deviation-lib');

const { computeHexagramProfile, computeActivations } = require('../src/calc/profile');
const { parseBirthToUtc } = require('../src/birth/parseBirth');

const HD_BODIES = [
  'sun', 'earth', 'moon', 'north_node', 'south_node', 'mercury', 'venus',
  'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto',
];

describe('deviation-lib — pure helpers', () => {
  test('bodyFromName maps reference names (incl. spaces/aliases)', () => {
    expect(bodyFromName('Sun')).toBe('sun');
    expect(bodyFromName('North Node')).toBe('north_node');
    expect(bodyFromName('south_node')).toBe('south_node');
    expect(bodyFromName('Rahu')).toBe('north_node');
    expect(bodyFromName('Chiron')).toBe(null); // unknown → ignored
  });

  test('lineFromValue parses the fractional line', () => {
    expect(lineFromValue(18.5)).toBe(5);
    expect(lineFromValue('47.3')).toBe(3);
    expect(lineFromValue(47)).toBe(null);
  });

  test('deltaDegrees is the shortest arc and wraps 0/360', () => {
    expect(deltaDegrees(10, 350)).toBeCloseTo(20, 6);
    expect(deltaDegrees(359.9, 0.1)).toBeCloseTo(0.2, 6);
    expect(deltaDegrees(0, 180)).toBeCloseTo(180, 6);
  });

  test('bucketStart snaps to 20-year buckets', () => {
    expect(bucketStart(1992)).toBe(1980);
    expect(bucketStart(1600)).toBe(1600);
    expect(bucketStart(2019)).toBe(2000);
  });

  test('stats returns mean/median/p95/max', () => {
    const s = stats([1, 2, 3, 4, 100]);
    expect(s.n).toBe(5);
    expect(s.median).toBe(3);
    expect(s.max).toBe(100);
    expect(stats([]).n).toBe(0);
  });

  test('rate ignores nulls', () => {
    expect(rate([true, true, false, null])).toBeCloseTo(2 / 3, 6);
    expect(rate([null, undefined])).toBe(null);
  });

  test('wheelLineSteps counts line hops on the 384-line wheel', () => {
    expect(wheelLineSteps(18, 5, 18, 5)).toBe(0);
    expect(wheelLineSteps(18, 5, 18, 6)).toBe(1);
  });
});

describe('deviation-lib — deterministic sampling', () => {
  test('generateSamples is reproducible for a seed and respects the window', () => {
    const a = generateSamples({ count: 50, yearStart: 1600, yearEnd: 2200, seed: 42 });
    const b = generateSamples({ count: 50, yearStart: 1600, yearEnd: 2200, seed: 42 });
    expect(a).toEqual(b);
    for (const s of a) {
      expect(s.year).toBeGreaterThanOrEqual(1600);
      expect(s.year).toBeLessThanOrEqual(2200);
      expect(Number.isFinite(s.lat)).toBe(true);
      expect(Number.isFinite(s.lng)).toBe(true);
    }
  });

  test('referenceRequestBody has the ints the engine expects', () => {
    const [s] = generateSamples({ count: 1, yearStart: 1990, yearEnd: 1990, seed: 1 });
    const body = referenceRequestBody(s);
    expect(typeof body.year).toBe('number');
    expect(typeof body.month).toBe('number');
    expect(typeof body.timezone).toBe('string');
    expect(body).toHaveProperty('lat');
    expect(body).toHaveProperty('lng');
  });
});

describe('deviation-lib — parse + compare against the reference fixture', () => {
  const parsed = parseReferenceResponse(fixture.raw);
  const rows = compareSample(fixture.sample, parsed);

  test('parses all 13 HD bodies in both streams (extras ignored)', () => {
    for (const body of HD_BODIES) {
      expect(parsed.personality[body]).toBeDefined();
      expect(parsed.design[body]).toBeDefined();
    }
    // Absolute tropical longitude in [0,360).
    expect(parsed.personality.sun.longitude).toBeGreaterThanOrEqual(0);
    expect(parsed.personality.sun.longitude).toBeLessThan(360);
  });

  test('parseReferenceStream accepts a keyed object too (legacy shape)', () => {
    const keyed = { Sun: fixture.raw.placements.personality.find((i) => i.planet.name === 'Sun') };
    const out = parseReferenceStream(keyed);
    expect(out.sun).toBeDefined();
    expect(out.sun.gate).toBe(26); // Brussels 1992 personality Sun = 26.1
  });

  test('produces 26 comparison rows', () => {
    expect(rows).toHaveLength(26);
  });

  test('modern-era heuristic matches the reference engine to the exact gate', () => {
    const gateMatches = rows.filter((r) => r.gateMatch === true).length;
    expect(gateMatches).toBe(26); // Brussels 1992 — full gate agreement
  });

  test('median longitude deviation is sub-arcminute in the modern era', () => {
    const deltas = rows.map((r) => r.deltaArcmin).sort((a, b) => a - b);
    const median = deltas[Math.floor(deltas.length / 2)];
    expect(median).toBeLessThan(1); // < 1 arcminute
  });
});

describe('deviation-lib — aggregate', () => {
  const parsed = parseReferenceResponse(fixture.raw);
  const rows = compareSample(fixture.sample, parsed);
  const agg = aggregate(rows, { width: 20 });

  test('buckets the 1992 sample into 1980–1999', () => {
    expect(agg.buckets).toHaveLength(1);
    expect(agg.buckets[0].bucketStart).toBe(1980);
    expect(agg.buckets[0].bucketEnd).toBe(1999);
    expect(agg.buckets[0].rows).toBe(26);
    expect(agg.buckets[0].gateMatch).toBe(1);
  });

  test('exposes per-body and overall stats', () => {
    expect(agg.byBody.moon).toBeDefined();
    expect(agg.byBody.sun.deltaArcmin.median).toBeLessThan(1);
    expect(agg.overall.rows).toBe(26);
    expect(agg.overall.gateMatch).toBe(1);
  });
});

describe('deviation-lib — profile placement mapping & aggregation', () => {
  const birth = { birthdate: '1992-12-09', birthtime: '00:35', timezone: 'Europe/Brussels' };

  test('PROFILE_KEYS has 14 placements and never touches pluto/neptune/nodes', () => {
    expect(Object.keys(PROFILE_KEYS)).toHaveLength(14);
    const bodies = Object.values(PROFILE_KEYS).map((s) => s.body);
    for (const excluded of ['pluto', 'neptune', 'north_node', 'south_node']) {
      expect(bodies).not.toContain(excluded);
    }
  });

  test('PROFILE_KEYS matches the engine source of truth (computeHexagramProfile)', () => {
    // Each sphere's (stream, body) must land on the same gate.line the profile
    // engine reports for that sphere — proving the study reads the right activation.
    const birthUtc = parseBirthToUtc(birth);
    const spheres = computeHexagramProfile({ birthUtc });
    const act = computeActivations({ birthUtc });
    const byKey = {};
    act.personality.forEach((a) => { byKey[`personality|${a.body}`] = a; });
    act.design.forEach((a) => { byKey[`design|${a.body}`] = a; });
    for (const [name, { stream, body }] of Object.entries(PROFILE_KEYS)) {
      const a = byKey[`${stream}|${body}`];
      expect(a).toBeDefined();
      expect(spheres[name].hexagram).toBe(a.gate);
      expect(spheres[name].line).toBe(a.line);
    }
    // Spot-check the canonical sphere identities.
    expect(PROFILE_KEYS.p_sun).toEqual({ stream: 'personality', body: 'sun' });
    expect(PROFILE_KEYS.d_sun).toEqual({ stream: 'design', body: 'sun' });
    expect(PROFILE_KEYS.d_moon).toEqual({ stream: 'design', body: 'moon' });
  });

  test('profileKeyForRow tags sphere bodies and rejects non-sphere bodies', () => {
    expect(profileKeyForRow({ stream: 'personality', body: 'sun' })).toBe('p_sun');
    expect(profileKeyForRow({ stream: 'design', body: 'moon' })).toBe('d_moon');
    expect(profileKeyForRow({ stream: 'personality', body: 'moon' })).toBe(null); // p_moon is not a sphere
    expect(profileKeyForRow({ stream: 'design', body: 'pluto' })).toBe(null);
  });

  test('aggregateProfile yields the 14 placements and excludes non-sphere bodies', () => {
    const parsed = parseReferenceResponse(fixture.raw);
    const rows = compareSample(birth, parsed);
    const sph = aggregateProfile(rows, { width: 20 });
    expect(sph.keyCount).toBe(14);
    expect(Object.keys(sph.byKey)).toHaveLength(14);
    // 14 sphere activations from the fixture's 26 rows.
    expect(sph.overall.rows).toBe(14);
    // Brussels 1992 — full sphere gate agreement.
    expect(sph.overall.gateMatch).toBe(1);
    expect(sph.byKey.p_sun.body).toBe('sun');
    expect(sph.byKey.d_moon.body).toBe('moon');
    // Pluto/nodes are not represented in the sphere aggregate's byBody.
    expect(sph.byBody.pluto).toBeUndefined();
  });
});
