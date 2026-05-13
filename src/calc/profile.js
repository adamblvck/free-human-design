const swe = require('swisseph');

const { mapLongitudeDegrees, normalizeAngleDegrees } = require('./mandala');
const { ensureEphePath: ensureEphePathShared } = require('./ephemeris');

function ensureEphePath() {
  // Centralized in ./ephemeris so we can print a one-time status check when needed.
  // Enable with: EPHE_STATUS=true
  ensureEphePathShared({ label: 'profile' });
}

function jdUtcFromDate(dt) {
  // JS Date is ms since epoch; use UTC getters.
  const year = dt.getUTCFullYear();
  const month = dt.getUTCMonth() + 1;
  const day = dt.getUTCDate();
  const hour =
    dt.getUTCHours() +
    dt.getUTCMinutes() / 60 +
    dt.getUTCSeconds() / 3600 +
    dt.getUTCMilliseconds() / 3600000;

  return swe.swe_julday(year, month, day, hour, swe.SE_GREG_CAL);
}

function signedAngleDiff(a, b) {
  // minimal signed difference (a - b) in degrees within [-180, 180)
  return ((a - b + 540) % 360) - 180;
}

function sunLongitudeDegrees(jdUt, flags) {
  const res = swe.swe_calc_ut(jdUt, swe.SE_SUN, flags);
  return res.longitude;
}

function findPreviousSolarLongitude(jdUt, deltaDegrees, flags) {
  const currentSun = sunLongitudeDegrees(jdUt, flags);
  const target = normalizeAngleDegrees(currentSun - deltaDegrees);

  let highJd = jdUt;
  let step = 1.0; // days
  let lowJd = highJd - step;

  let highDiff = signedAngleDiff(sunLongitudeDegrees(highJd, flags), target);
  let lowDiff = signedAngleDiff(sunLongitudeDegrees(lowJd, flags), target);

  let iterations = 0;
  const maxIterations = 365;

  // Walk back until we bracket the crossing.
  while (lowDiff > 0 && iterations < maxIterations) {
    lowJd -= step;
    lowDiff = signedAngleDiff(sunLongitudeDegrees(lowJd, flags), target);
    iterations += 1;
  }

  if (lowDiff > 0) {
    throw new Error('Failed to bracket previous solar longitude');
  }

  // Binary search for the crossing.
  for (let i = 0; i < 50; i += 1) {
    const mid = 0.5 * (lowJd + highJd);
    const midDiff = signedAngleDiff(sunLongitudeDegrees(mid, flags), target);
    if (midDiff > 0) {
      highJd = mid;
      highDiff = midDiff;
    } else {
      lowJd = mid;
      lowDiff = midDiff;
    }
  }

  return 0.5 * (lowJd + highJd);
}

function getPlanetAtJd(jdUt, planetId, flags) {
  const r = swe.swe_calc_ut(jdUt, planetId, flags);
  return {
    longitude: r.longitude,
    longitudeSpeed: r.longitudeSpeed,
  };
}

function mapPlanetToGKLine(planet) {
  const { hexagram, line } = mapLongitudeDegrees(planet.longitude);
  return { gk: hexagram, line };
}

function mapPlanetToGateLineColor(planet) {
  const { hexagram, line, color } = mapLongitudeDegrees(planet.longitude);
  return {
    gate: hexagram,
    hexagram,
    line,
    color,
    longitude: planet.longitude,
    longitude_speed: planet.longitudeSpeed,
    retrograde: planet.longitudeSpeed < 0,
  };
}

function computeProfileSpheres({ birthUtc }) {
  ensureEphePath();

  // HD typically uses tropical; speeds are needed for retrograde flags later.
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;

  const jdPersonality = jdUtcFromDate(birthUtc);
  const jdDesign = findPreviousSolarLongitude(jdPersonality, 88.0, flags);

  // Personality bodies
  const pSun = getPlanetAtJd(jdPersonality, swe.SE_SUN, flags);
  const pMercury = getPlanetAtJd(jdPersonality, swe.SE_MERCURY, flags);
  const pVenus = getPlanetAtJd(jdPersonality, swe.SE_VENUS, flags);
  const pMars = getPlanetAtJd(jdPersonality, swe.SE_MARS, flags);
  const pJupiter = getPlanetAtJd(jdPersonality, swe.SE_JUPITER, flags);

  // Design bodies
  const dSun = getPlanetAtJd(jdDesign, swe.SE_SUN, flags);
  const dMoon = getPlanetAtJd(jdDesign, swe.SE_MOON, flags);
  const dVenus = getPlanetAtJd(jdDesign, swe.SE_VENUS, flags);
  const dMars = getPlanetAtJd(jdDesign, swe.SE_MARS, flags);
  const dJupiter = getPlanetAtJd(jdDesign, swe.SE_JUPITER, flags);
  const dSaturn = getPlanetAtJd(jdDesign, swe.SE_SATURN, flags);
  const dUranus = getPlanetAtJd(jdDesign, swe.SE_URANUS, flags);

  // Earth is opposite Sun in HD.
  const pEarth = { longitude: normalizeAngleDegrees(pSun.longitude + 180), longitudeSpeed: pSun.longitudeSpeed };
  const dEarth = { longitude: normalizeAngleDegrees(dSun.longitude + 180), longitudeSpeed: dSun.longitudeSpeed };

  // Map per setup doc:
  // - p_sun = Life's Work
  // - p_earth = Evolution
  // - d_sun = Radiance
  // - d_earth = Purpose
  // - p_venus = IQ
  // - p_mars = EQ
  // - p_jupiter = Pearl
  // - p_mercury = Relating
  // - d_moon = Attraction
  // - d_venus = SQ
  // - d_mars = Core
  // - d_jupiter = Culture
  // - d_saturn = Core Stability
  // - d_uranus = Creativity

  return {
    lifeswork: mapPlanetToGKLine(pSun),
    // evolution: mapPlanetToGKLine(pEarth),
    // radiance: mapPlanetToGKLine(dSun),
    purpose: mapPlanetToGKLine(dEarth),

    iq: mapPlanetToGKLine(pVenus),
    eq: mapPlanetToGKLine(pMars),
    pearl: mapPlanetToGKLine(pJupiter),
    relating: mapPlanetToGKLine(pMercury),

    attraction: mapPlanetToGKLine(dMoon),
    sq: mapPlanetToGKLine(dVenus),
    core: mapPlanetToGKLine(dMars),
    culture: mapPlanetToGKLine(dJupiter),
    stability: mapPlanetToGKLine(dSaturn),
    creativity: mapPlanetToGKLine(dUranus),

    // Useful metadata (not persisted directly yet)
    _meta: {
      jd_personality: jdPersonality,
      jd_design: jdDesign,
    },
  };
}

function computeEngineTest({ birthUtc }) {
  ensureEphePath();

  // HD typically uses tropical; speeds are needed for retrograde flags later.
  const flags = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;

  const jdPersonality = jdUtcFromDate(birthUtc);
  const jdDesign = findPreviousSolarLongitude(jdPersonality, 88.0, flags);

  // Personality bodies
  const pSun = getPlanetAtJd(jdPersonality, swe.SE_SUN, flags);
  const pMercury = getPlanetAtJd(jdPersonality, swe.SE_MERCURY, flags);
  const pVenus = getPlanetAtJd(jdPersonality, swe.SE_VENUS, flags);
  const pMars = getPlanetAtJd(jdPersonality, swe.SE_MARS, flags);
  const pJupiter = getPlanetAtJd(jdPersonality, swe.SE_JUPITER, flags);

  // Design bodies
  const dSun = getPlanetAtJd(jdDesign, swe.SE_SUN, flags);
  const dMoon = getPlanetAtJd(jdDesign, swe.SE_MOON, flags);
  const dVenus = getPlanetAtJd(jdDesign, swe.SE_VENUS, flags);
  const dMars = getPlanetAtJd(jdDesign, swe.SE_MARS, flags);
  const dJupiter = getPlanetAtJd(jdDesign, swe.SE_JUPITER, flags);
  const dSaturn = getPlanetAtJd(jdDesign, swe.SE_SATURN, flags);
  const dUranus = getPlanetAtJd(jdDesign, swe.SE_URANUS, flags);

  // Earth is opposite Sun in HD.
  const pEarth = { longitude: normalizeAngleDegrees(pSun.longitude + 180), longitudeSpeed: pSun.longitudeSpeed };
  const dEarth = { longitude: normalizeAngleDegrees(dSun.longitude + 180), longitudeSpeed: dSun.longitudeSpeed };

  return {
    // Return a debug-friendly, explicit split of "personality" (p_) and "design" (d_).
    p_: {
      sun: mapPlanetToGateLineColor(pSun),
      earth: mapPlanetToGateLineColor(pEarth),
      mercury: mapPlanetToGateLineColor(pMercury),
      venus: mapPlanetToGateLineColor(pVenus),
      mars: mapPlanetToGateLineColor(pMars),
      jupiter: mapPlanetToGateLineColor(pJupiter),
    },
    d_: {
      sun: mapPlanetToGateLineColor(dSun),
      earth: mapPlanetToGateLineColor(dEarth),
      moon: mapPlanetToGateLineColor(dMoon),
      venus: mapPlanetToGateLineColor(dVenus),
      mars: mapPlanetToGateLineColor(dMars),
      jupiter: mapPlanetToGateLineColor(dJupiter),
      saturn: mapPlanetToGateLineColor(dSaturn),
      uranus: mapPlanetToGateLineColor(dUranus),
    },
    // Also include the "spheres" mapping used by profile/event logic, for cross-checking.
    spheres: computeProfileSpheres({ birthUtc }),
    _meta: {
      jd_personality: jdPersonality,
      jd_design: jdDesign,
    },
  };
}

module.exports = {
  computeProfileSpheres,
  computeEngineTest,
  jdUtcFromDate,
  // Exported for reuse in global transit scanning (design stream).
  // NOTE: This computes "Design time" by finding the previous Sun longitude crossing
  // at (currentSun - 88°), matching HD "design" definition used elsewhere in this repo.
  findPreviousSolarLongitude,
  signedAngleDiff,
};
