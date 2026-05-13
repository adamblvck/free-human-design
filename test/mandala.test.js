const { mapLongitudeDegrees, normalizeAngleDegrees } = require('../src/calc/mandala');

describe('normalizeAngleDegrees', () => {
  it('wraps negatives into [0, 360)', () => {
    expect(normalizeAngleDegrees(-10)).toBeCloseTo(350, 9);
    expect(normalizeAngleDegrees(-360)).toBeCloseTo(0, 9);
    expect(normalizeAngleDegrees(720.5)).toBeCloseTo(0.5, 9);
  });

  it('returns input in range', () => {
    expect(normalizeAngleDegrees(0)).toBe(0);
    expect(normalizeAngleDegrees(180)).toBe(180);
    expect(normalizeAngleDegrees(359.999)).toBeCloseTo(359.999, 6);
  });
});

describe('mapLongitudeDegrees', () => {
  it('returns hexagram, line and color in valid ranges for 0..360', () => {
    for (let deg = 0; deg < 360; deg += 0.7) {
      const r = mapLongitudeDegrees(deg);
      expect(r.hexagram).toBeGreaterThanOrEqual(1);
      expect(r.hexagram).toBeLessThanOrEqual(64);
      expect(r.line).toBeGreaterThanOrEqual(1);
      expect(r.line).toBeLessThanOrEqual(6);
      expect(r.color).toBeGreaterThanOrEqual(1);
      expect(r.color).toBeLessThanOrEqual(6);
    }
  });

  it('is invariant under 360-degree wrap', () => {
    for (const deg of [0, 13.7, 88, 180, 270, 359.5]) {
      const a = mapLongitudeDegrees(deg);
      const b = mapLongitudeDegrees(deg + 360);
      expect(a).toEqual(b);
    }
  });

  // Golden vectors derived from event-horizon-api on 1972-08-02 14:30 Asia/Bangkok.
  // These pin specific (longitude → hexagram/line) mappings so any drift in
  // the porting of gk_hex_profile.py is caught immediately.
  it('matches known longitude → hexagram/line vectors', () => {
    expect(mapLongitudeDegrees(130.09159160633666)).toEqual(
      expect.objectContaining({ hexagram: 33, line: 3 })
    );
    expect(mapLongitudeDegrees(310.0915916063367)).toEqual(
      expect.objectContaining({ hexagram: 19, line: 3 })
    );
    expect(mapLongitudeDegrees(42.091591606299154)).toEqual(
      expect.objectContaining({ hexagram: 24, line: 5 })
    );
    expect(mapLongitudeDegrees(222.09159160629915)).toEqual(
      expect.objectContaining({ hexagram: 44, line: 5 })
    );
  });
});
