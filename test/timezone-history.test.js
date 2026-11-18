const { parseBirthToUtc } = require('../src/birth/parseBirth');
const { DateTime } = require('luxon');

// Birth charts are historical by nature, so the engine must honour the FULL
// IANA history of each zone — wartime double summer time, one-off DST years,
// standard-offset changes, pre-standardisation local mean time — not just
// modern rules. Offset resolution flows through Luxon, which uses the runtime's
// IANA/ICU timezone database.
//
// These vectors lock known-correct historical offsets so a runtime shipping a
// stale or stripped tz database (which would silently corrupt 20th-century
// charts — see the Boise 1974 case) fails loudly here instead.

describe('runtime timezone database sanity', () => {
  it('has timezone support with historical data (full ICU)', () => {
    // A canary: if this throws or the offset is wrong, the runtime's tz data is
    // unusable for historical charts.
    const dt = DateTime.fromObject({ year: 1944, month: 7, day: 1 }, { zone: 'Europe/London' });
    expect(dt.isValid).toBe(true);
  });
});

describe('historical IANA offsets (20th century)', () => {
  const cases = [
    // label, input, expected UTC instant
    ['US year-round DST 1974 — Chicago, January (CDT, UTC-5)',
      { birthdate: '1974-01-15', birthtime: '12:00', timezone: 'America/Chicago' }, '1974-01-15T17:00:00.000Z'],
    ['US year-round DST 1974 — Boise, August (MDT, UTC-6)',
      { birthdate: '1974-08-02', birthtime: '12:00', timezone: 'America/Boise' }, '1974-08-02T18:00:00.000Z'],
    ['US standard time before late-April DST start — Chicago, March 1969 (CST, UTC-6)',
      { birthdate: '1969-03-11', birthtime: '03:00', timezone: 'America/Chicago' }, '1969-03-11T09:00:00.000Z'],
    ['US summer DST 1965 — New York (EDT, UTC-4)',
      { birthdate: '1965-07-01', birthtime: '12:00', timezone: 'America/New_York' }, '1965-07-01T16:00:00.000Z'],
    ['Poland did NOT observe DST in 1970 — Warsaw (CET, UTC+1)',
      { birthdate: '1970-06-04', birthtime: '04:00', timezone: 'Europe/Warsaw' }, '1970-06-04T03:00:00.000Z'],
    ['British Double Summer Time WWII — London, 1944 (UTC+2)',
      { birthdate: '1944-07-01', birthtime: '12:00', timezone: 'Europe/London' }, '1944-07-01T10:00:00.000Z'],
    ['British Double Summer Time 1947 — London (UTC+2)',
      { birthdate: '1947-06-01', birthtime: '12:00', timezone: 'Europe/London' }, '1947-06-01T10:00:00.000Z'],
    ['India half-hour offset — Kolkata, 1950 (UTC+5:30)',
      { birthdate: '1950-01-01', birthtime: '12:00', timezone: 'Asia/Kolkata' }, '1950-01-01T06:30:00.000Z'],
    ['Nepal before its 1986 change — Kathmandu, 1980 (UTC+5:30)',
      { birthdate: '1980-01-01', birthtime: '12:00', timezone: 'Asia/Kathmandu' }, '1980-01-01T06:30:00.000Z'],
    ['Nepal after its 1986 change — Kathmandu, 1990 (UTC+5:45)',
      { birthdate: '1990-01-01', birthtime: '12:00', timezone: 'Asia/Kathmandu' }, '1990-01-01T06:15:00.000Z'],
    ['Southern-hemisphere summer DST — Sydney, January 1990 (AEDT, UTC+11)',
      { birthdate: '1990-01-15', birthtime: '12:00', timezone: 'Australia/Sydney' }, '1990-01-15T01:00:00.000Z'],
    ['Pre-standardisation Local Mean Time — Paris, 1910 (Paris Mean Time, +0:09:21)',
      { birthdate: '1910-06-01', birthtime: '12:00', timezone: 'Europe/Paris' }, '1910-06-01T11:50:39.000Z'],
  ];

  for (const [label, input, expected] of cases) {
    it(label, () => {
      expect(parseBirthToUtc(input).toISOString()).toBe(expected);
    });
  }
});

describe('DST transition edge cases (deterministic resolution)', () => {
  it('resolves a spring-forward nonexistent local time forward into DST', () => {
    // 02:30 never existed on 2021-03-14 in New York; Luxon shifts it to 03:30 EDT.
    const utc = parseBirthToUtc({ birthdate: '2021-03-14', birthtime: '02:30', timezone: 'America/New_York' });
    expect(utc.toISOString()).toBe('2021-03-14T07:30:00.000Z');
  });

  it('resolves a fall-back ambiguous local time to the earlier offset', () => {
    // 01:30 occurs twice on 2021-11-07 in New York; Luxon picks the earlier (EDT).
    const utc = parseBirthToUtc({ birthdate: '2021-11-07', birthtime: '01:30', timezone: 'America/New_York' });
    expect(utc.toISOString()).toBe('2021-11-07T05:30:00.000Z');
  });
});
