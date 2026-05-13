const { DateTime } = require('luxon');

/**
 * BirthParseError carries an HTTP-ish status code so a thin adapter (e.g. an
 * Express handler) can map it back to a 400 response. We keep a plain class
 * here so the engine doesn't need to know about Express.
 */
class BirthParseError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'BirthParseError';
    this.statusCode = statusCode;
  }
}

function parseYmdLoose(v) {
  // Accept both ISO-padded and non-padded dates:
  // - YYYY-MM-DD
  // - YYYY-M-D
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(v || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return { year, month, day };
}

function parseHmsLoose(v) {
  // Accept:
  // - HH:mm
  // - H:mm
  // - HH:mm:ss
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(String(v || '').trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const second = m[3] === undefined ? 0 : Number(m[3]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || !Number.isFinite(second)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  if (second < 0 || second > 59) return null;
  return { hour, minute, second };
}

function parseBirthToUtc({ birthdate, birthtime, timezone }) {
  if (!birthdate || !birthtime || !timezone) {
    throw new BirthParseError('manual mode requires birthdate, birthtime, timezone');
  }

  // birthdate: YYYY-MM-DD (or YYYY-M-D), birthtime: HH:mm (or H:mm) or HH:mm:ss
  //
  // NOTE:
  // Luxon `DateTime.fromISO()` is strict about ISO padding (e.g. it rejects "1972-8-2").
  // We normalize by parsing components and building a DateTime from an object instead.
  const dateParts = parseYmdLoose(birthdate);
  const timeParts = parseHmsLoose(birthtime);
  if (!dateParts || !timeParts) {
    throw new BirthParseError(
      'Invalid birthdate/birthtime format. Expected birthdate "YYYY-MM-DD" (or "YYYY-M-D") and birthtime "HH:mm" (or "H:mm") optionally with seconds "HH:mm:ss".'
    );
  }

  const dt = DateTime.fromObject({ ...dateParts, ...timeParts }, { zone: timezone });
  if (!dt.isValid) {
    throw new BirthParseError(
      `Invalid datetime/timezone: ${dt.invalidReason || 'unknown'} (birthdate=${birthdate}, birthtime=${birthtime}, timezone=${timezone})`
    );
  }

  return dt.toUTC().toJSDate();
}

module.exports = { parseBirthToUtc, BirthParseError };
