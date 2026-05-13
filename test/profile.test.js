const { computeProfile } = require('../src');

// Regression fixture for a fixed birth, captured from event-horizon-api
// (src/calc/profile.js + src/services/birthParse.js) on 1972-08-02 14:30
// Asia/Bangkok. If this drifts, the porting has changed and we want to know.
const FIXED_BIRTH = {
  birthdate: '1972-08-02',
  birthtime: '14:30',
  timezone: 'Asia/Bangkok',
};

const EXPECTED_INPUT_BIRTH_UTC = '1972-08-02T07:30:00.000Z';

const EXPECTED_PERSONALITY = {
  sun: { hexagram: 33, line: 3, retrograde: false },
  earth: { hexagram: 19, line: 3, retrograde: false },
  mercury: { hexagram: 4, line: 1, retrograde: true },
  venus: { hexagram: 12, line: 6, retrograde: false },
  mars: { hexagram: 4, line: 4, retrograde: false },
  jupiter: { hexagram: 10, line: 2, retrograde: true },
};

const EXPECTED_DESIGN = {
  sun: { hexagram: 24, line: 5, retrograde: false },
  earth: { hexagram: 44, line: 5, retrograde: false },
  moon: { hexagram: 11, line: 3, retrograde: false },
  venus: { hexagram: 12, line: 3, retrograde: false },
  mars: { hexagram: 12, line: 1, retrograde: false },
  jupiter: { hexagram: 58, line: 5, retrograde: true },
  saturn: { hexagram: 16, line: 1, retrograde: false },
  uranus: { hexagram: 57, line: 1, retrograde: true },
};

const EXPECTED_SPHERES = {
  lifeswork: { gk: 33, line: 3 },
  purpose: { gk: 44, line: 5 },
  iq: { gk: 12, line: 6 },
  eq: { gk: 4, line: 4 },
  pearl: { gk: 10, line: 2 },
  relating: { gk: 4, line: 1 },
  attraction: { gk: 11, line: 3 },
  sq: { gk: 12, line: 3 },
  core: { gk: 12, line: 1 },
  culture: { gk: 58, line: 5 },
  stability: { gk: 16, line: 1 },
  creativity: { gk: 57, line: 1 },
};

describe('computeProfile (regression)', () => {
  let result;
  beforeAll(() => {
    result = computeProfile(FIXED_BIRTH);
  });

  it('echoes parsed input including birth_utc', () => {
    expect(result.input).toEqual({
      ...FIXED_BIRTH,
      birth_utc: EXPECTED_INPUT_BIRTH_UTC,
    });
  });

  it('computes the full personality (p_) gate/line/retrograde set', () => {
    for (const [planet, expected] of Object.entries(EXPECTED_PERSONALITY)) {
      expect(result.engine.p_[planet]).toEqual(expect.objectContaining(expected));
    }
    expect(Object.keys(result.engine.p_).sort()).toEqual(
      Object.keys(EXPECTED_PERSONALITY).sort()
    );
  });

  it('computes the full design (d_) gate/line/retrograde set', () => {
    for (const [planet, expected] of Object.entries(EXPECTED_DESIGN)) {
      expect(result.engine.d_[planet]).toEqual(expect.objectContaining(expected));
    }
    expect(Object.keys(result.engine.d_).sort()).toEqual(
      Object.keys(EXPECTED_DESIGN).sort()
    );
  });

  it('matches the sphere-keyed mapping used by profile/event logic', () => {
    for (const [sphere, expected] of Object.entries(EXPECTED_SPHERES)) {
      expect(result.engine.spheres[sphere]).toEqual(expected);
    }
  });

  it('Earth is exactly opposite Sun in both streams', () => {
    const norm = (x) => ((x % 360) + 360) % 360;

    const pSunLon = result.engine.p_.sun.longitude;
    const pEarthLon = result.engine.p_.earth.longitude;
    expect(norm(pSunLon - pEarthLon)).toBeCloseTo(180, 9);

    const dSunLon = result.engine.d_.sun.longitude;
    const dEarthLon = result.engine.d_.earth.longitude;
    expect(norm(dSunLon - dEarthLon)).toBeCloseTo(180, 9);
  });

  it('design Sun is ~88° behind personality Sun', () => {
    const pSunLon = result.engine.p_.sun.longitude;
    const dSunLon = result.engine.d_.sun.longitude;
    // Signed shortest-arc difference, expected ~+88°.
    const diff = ((pSunLon - dSunLon + 540) % 360) - 180;
    expect(diff).toBeCloseTo(88, 5);
  });

  it('emits Julian Day metadata at both stream times', () => {
    expect(result.engine._meta.jd_personality).toBeCloseTo(2441531.8125, 4);
    expect(result.engine._meta.jd_design).toBeCloseTo(2441439.9158212943, 4);
  });
});
