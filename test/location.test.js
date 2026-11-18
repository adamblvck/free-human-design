const { locationForTimezone, resolveLocation } = require('../src/timezone/location');

describe('locationForTimezone', () => {
  it('returns the most-populous-city coordinates for a timezone', () => {
    const loc = locationForTimezone('Asia/Bangkok');
    expect(loc).not.toBeNull();
    expect(loc.city).toBe('Bangkok');
    expect(loc.country).toBe('Thailand');
    expect(loc.lat).toBeCloseTo(13.75, 1);
    expect(loc.lng).toBeCloseTo(100.5, 1);
    expect(loc.source).toBe('timezone-city');
  });

  it('resolves a few well-known zones to sane coordinates', () => {
    for (const tz of ['Europe/London', 'America/New_York', 'Asia/Tokyo']) {
      const loc = locationForTimezone(tz);
      expect(loc).not.toBeNull();
      expect(loc.lat).toBeGreaterThanOrEqual(-90);
      expect(loc.lat).toBeLessThanOrEqual(90);
      expect(loc.lng).toBeGreaterThanOrEqual(-180);
      expect(loc.lng).toBeLessThanOrEqual(180);
    }
  });

  it('returns null for an unknown timezone', () => {
    expect(locationForTimezone('Mars/Olympus')).toBeNull();
    expect(locationForTimezone('')).toBeNull();
    expect(locationForTimezone(undefined)).toBeNull();
  });
});

describe('resolveLocation', () => {
  it('prefers explicit coordinates over the timezone', () => {
    const loc = resolveLocation({ lat: 1.23, lng: 4.56, timezone: 'Asia/Bangkok' });
    expect(loc).toEqual({ lat: 1.23, lng: 4.56, source: 'explicit' });
  });

  it('falls back to the timezone city when no coordinates given', () => {
    const loc = resolveLocation({ timezone: 'Asia/Bangkok' });
    expect(loc.source).toBe('timezone-city');
    expect(loc.city).toBe('Bangkok');
  });

  it('returns null when nothing is resolvable', () => {
    expect(resolveLocation({})).toBeNull();
    expect(resolveLocation({ timezone: 'Mars/Olympus' })).toBeNull();
  });
});
