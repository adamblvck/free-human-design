const { parseBirthToUtc, BirthParseError } = require('./birth/parseBirth');
const {
  computeEngineTest,
  computeProfileSpheres,
  computeActivations,
  jdUtcFromDate,
  findPreviousSolarLongitude,
  signedAngleDiff,
} = require('./calc/profile');
const { mapLongitudeDegrees, normalizeAngleDegrees } = require('./calc/mandala');
const { ensureEphePath, getBackend } = require('./calc/ephemeris');
const { searchTimezones, formatOffset } = require('./timezone/search');
const { locationForTimezone, resolveLocation } = require('./timezone/location');
const {
  CENTERS,
  CENTER_LABELS,
  GATE_CENTER,
  CHANNELS,
  computeBodygraph,
} = require('./hd/bodygraph');
const { computeAngles, computeHouses, signOf, SIGNS } = require('./hd/houses');
const { computeChart } = require('./chart');

/**
 * High-level entry point: take human-friendly birth strings (date/time/timezone)
 * and return the same `engine` payload that the API's /maintenance/engine_test
 * endpoint produces, with the parsed input echoed back for traceability.
 *
 * For the full Gene Keys + Human Design + Astrology output, use `computeChart`.
 *
 * @param {{ birthdate: string, birthtime: string, timezone: string }} input
 */
function computeProfile(input) {
  const birthUtc = parseBirthToUtc(input);
  return {
    input: {
      birthdate: input.birthdate,
      birthtime: input.birthtime,
      timezone: input.timezone,
      birth_utc: birthUtc.toISOString(),
    },
    engine: computeEngineTest({ birthUtc }),
  };
}

module.exports = {
  // Top-level convenience
  computeProfile,
  computeChart,

  // Birth parsing
  parseBirthToUtc,
  BirthParseError,

  // Engine internals (parity with event-horizon-api)
  computeEngineTest,
  computeProfileSpheres,
  computeActivations,
  jdUtcFromDate,
  findPreviousSolarLongitude,
  signedAngleDiff,

  // Mandala helpers
  mapLongitudeDegrees,
  normalizeAngleDegrees,

  // Human Design bodygraph
  computeBodygraph,
  CENTERS,
  CENTER_LABELS,
  GATE_CENTER,
  CHANNELS,

  // Extended astrology
  computeAngles,
  computeHouses,
  signOf,
  SIGNS,

  // Ephemeris backend (mostly internal; exposed for power users)
  getBackend,
  ensureEphePath,

  // Timezone autocomplete + location
  searchTimezones,
  formatOffset,
  locationForTimezone,
  resolveLocation,
};
