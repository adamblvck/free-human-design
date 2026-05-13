const { parseBirthToUtc, BirthParseError } = require('./birth/parseBirth');
const {
  computeEngineTest,
  computeProfileSpheres,
  jdUtcFromDate,
  findPreviousSolarLongitude,
  signedAngleDiff,
} = require('./calc/profile');
const { mapLongitudeDegrees, normalizeAngleDegrees } = require('./calc/mandala');
const { ensureEphePath } = require('./calc/ephemeris');
const { searchTimezones, formatOffset } = require('./timezone/search');

/**
 * High-level entry point: take human-friendly birth strings (date/time/timezone)
 * and return the same `engine` payload that the API's /maintenance/engine_test
 * endpoint produces, with the parsed input echoed back for traceability.
 *
 * @param {{ birthdate: string, birthtime: string, timezone: string }} input
 * @returns {{
 *   input: {
 *     birthdate: string,
 *     birthtime: string,
 *     timezone: string,
 *     birth_utc: string
 *   },
 *   engine: { p_: object, d_: object, spheres: object, _meta: object }
 * }}
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

  // Birth parsing
  parseBirthToUtc,
  BirthParseError,

  // Engine internals (parity with event-horizon-api)
  computeEngineTest,
  computeProfileSpheres,
  jdUtcFromDate,
  findPreviousSolarLongitude,
  signedAngleDiff,

  // Mandala helpers
  mapLongitudeDegrees,
  normalizeAngleDegrees,

  // Ephemeris path management (mostly internal, exposed for power users)
  ensureEphePath,

  // Timezone autocomplete
  searchTimezones,
  formatOffset,
};
