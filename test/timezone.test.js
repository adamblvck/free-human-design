const { searchTimezones } = require('../src/timezone/search');

describe('searchTimezones', () => {
  it('returns [] for empty/whitespace queries', () => {
    expect(searchTimezones('')).toEqual([]);
    expect(searchTimezones('   ')).toEqual([]);
    expect(searchTimezones(null)).toEqual([]);
    expect(searchTimezones(undefined)).toEqual([]);
  });

  it('finds Tokyo as Asia/Tokyo with the right offset', () => {
    const r = searchTimezones('tokyo');
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].ianaName).toBe('Asia/Tokyo');
    // JST is UTC+9, no DST.
    expect(r[0].currentOffsetMinutes).toBe(540);
    expect(r[0].label).toMatch(/^Asia\/Tokyo \+09:00/);
  });

  it('matches via province/state — "bali" → Asia/Makassar', () => {
    const r = searchTimezones('bali');
    const ianas = r.map((x) => x.ianaName);
    expect(ianas).toContain('Asia/Makassar');
  });

  it('matches an exact IANA name', () => {
    const r = searchTimezones('America/Los_Angeles');
    expect(r[0].ianaName).toBe('America/Los_Angeles');
  });

  it('matches a partial city in the second IANA segment', () => {
    const r = searchTimezones('los_ang');
    const ianas = r.map((x) => x.ianaName);
    expect(ianas).toContain('America/Los_Angeles');
  });

  it('respects the limit option', () => {
    const r = searchTimezones('america', { limit: 3 });
    expect(r.length).toBeLessThanOrEqual(3);
  });

  it('deduplicates by IANA name', () => {
    const r = searchTimezones('asia');
    const ianas = r.map((x) => x.ianaName);
    expect(new Set(ianas).size).toBe(ianas.length);
  });
});
