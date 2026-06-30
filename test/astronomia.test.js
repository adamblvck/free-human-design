const astronomia = require('../src/calc/astronomia');
const { computeActivations } = require('../src/calc/profile');
const { parseBirthToUtc } = require('../src/birth/parseBirth');
const { normalizeAngleDegrees } = require('../src/calc/mandala');

// Line width on the mandala wheel = 360 / 64 / 6 degrees.
const LINE_WIDTH_DEG = 360 / 64 / 6;
const THIRTY_ARCSEC_DEG = 30 / 3600;

describe('astronomia backend', () => {
  it('exposes the expected interface', () => {
    expect(astronomia.name).toBe('astronomia');
    expect(typeof astronomia.julianDayUT).toBe('function');
    expect(typeof astronomia.longitude).toBe('function');
    expect(astronomia.BODIES).toEqual(
      expect.arrayContaining(['sun', 'moon', 'mercury', 'pluto', 'north_node'])
    );
  });

  it('reproduces the fixture personality Sun JD and longitude', () => {
    const dt = new Date('1972-08-02T07:30:00.000Z');
    expect(astronomia.julianDayUT(dt)).toBeCloseTo(2441531.8125, 6);
    const sun = astronomia.longitude('sun', 2441531.8125);
    // Personality Sun should land in gate 33 line 3 (~130.09°).
    expect(sun).toBeGreaterThan(129);
    expect(sun).toBeLessThan(131);
  });

  it('returns every body in [0, 360)', () => {
    for (const body of astronomia.BODIES) {
      const lon = astronomia.longitude(body, 2441531.8125);
      expect(lon).toBeGreaterThanOrEqual(0);
      expect(lon).toBeLessThan(360);
    }
  });

  it('throws on an unknown body', () => {
    expect(() => astronomia.longitude('nibiru', 2441531.8125)).toThrow();
  });

  // Guard: warn loudly if any fixture body sits within ~30" of a line boundary,
  // where a future ephemeris change could silently flip the line number.
  it('fixture bodies are not perched on a line boundary', () => {
    const birthUtc = parseBirthToUtc({
      birthdate: '1972-08-02',
      birthtime: '14:30',
      timezone: 'Asia/Bangkok',
    });
    const { personality, design } = computeActivations({ birthUtc });
    const near = [];
    for (const a of [...personality, ...design]) {
      const within = normalizeAngleDegrees(a.longitude) % LINE_WIDTH_DEG;
      const dist = Math.min(within, LINE_WIDTH_DEG - within);
      if (dist < THIRTY_ARCSEC_DEG) {
        near.push(`${a.stream}.${a.body} (${dist * 3600}″ from edge)`);
      }
    }
    // This isn't a hard failure of correctness, but if it ever trips we want to
    // know the golden vectors are fragile to sub-arcminute ephemeris drift.
    expect(near).toEqual([]);
  });
});
