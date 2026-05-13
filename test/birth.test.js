const { parseBirthToUtc, BirthParseError } = require('../src/birth/parseBirth');

describe('parseBirthToUtc', () => {
  it('parses padded ISO date + HH:mm into the right UTC instant', () => {
    const utc = parseBirthToUtc({
      birthdate: '1972-08-02',
      birthtime: '14:30',
      timezone: 'Asia/Bangkok',
    });
    // Bangkok is UTC+7 year-round, no DST.
    expect(utc.toISOString()).toBe('1972-08-02T07:30:00.000Z');
  });

  it('accepts loose YYYY-M-D and H:mm formats', () => {
    // birthdate accepts unpadded month/day; birthtime accepts unpadded hour but
    // requires 2-digit minutes (matches event-horizon-api's regex).
    const utc = parseBirthToUtc({
      birthdate: '1972-8-2',
      birthtime: '9:05',
      timezone: 'Asia/Bangkok',
    });
    expect(utc.toISOString()).toBe('1972-08-02T02:05:00.000Z');
  });

  it('honors HH:mm:ss seconds precision', () => {
    const utc = parseBirthToUtc({
      birthdate: '1990-01-01',
      birthtime: '00:00:30',
      timezone: 'UTC',
    });
    expect(utc.toISOString()).toBe('1990-01-01T00:00:30.000Z');
  });

  it('throws BirthParseError when fields are missing', () => {
    expect(() =>
      parseBirthToUtc({ birthdate: '1990-01-01', birthtime: '12:00' })
    ).toThrow(BirthParseError);
    expect(() =>
      parseBirthToUtc({ birthtime: '12:00', timezone: 'UTC' })
    ).toThrow(BirthParseError);
  });

  it('throws BirthParseError on invalid date/time format', () => {
    expect(() =>
      parseBirthToUtc({ birthdate: '02/08/1972', birthtime: '14:30', timezone: 'UTC' })
    ).toThrow(BirthParseError);
    expect(() =>
      parseBirthToUtc({ birthdate: '1972-08-02', birthtime: '2:30 PM', timezone: 'UTC' })
    ).toThrow(BirthParseError);
  });

  it('throws BirthParseError on invalid timezone', () => {
    expect(() =>
      parseBirthToUtc({ birthdate: '1972-08-02', birthtime: '14:30', timezone: 'Mars/Olympus' })
    ).toThrow(BirthParseError);
  });

  it('rejects out-of-range months/days/hours', () => {
    expect(() =>
      parseBirthToUtc({ birthdate: '1972-13-02', birthtime: '14:30', timezone: 'UTC' })
    ).toThrow(BirthParseError);
    expect(() =>
      parseBirthToUtc({ birthdate: '1972-08-32', birthtime: '14:30', timezone: 'UTC' })
    ).toThrow(BirthParseError);
    expect(() =>
      parseBirthToUtc({ birthdate: '1972-08-02', birthtime: '24:00', timezone: 'UTC' })
    ).toThrow(BirthParseError);
  });
});
