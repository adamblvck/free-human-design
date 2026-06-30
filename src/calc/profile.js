const { mapLongitudeDegrees, normalizeAngleDegrees } = require('./mandala');
const { getBackend, ensureEphePath } = require('./ephemeris');

// Longitude speed is computed by central difference (only the sign is consumed,
// for the `retrograde` flag, so this is extremely robust across backends).
const SPEED_H = 0.5; // days

function jdUtcFromDate(dt) {
  return getBackend().julianDayUT(dt);
}

function signedAngleDiff(a, b) {
  // minimal signed difference (a - b) in degrees within [-180, 180)
  return ((a - b + 540) % 360) - 180;
}

function bodyLongitude(body, jdUt) {
  return getBackend().longitude(body, jdUt);
}

function bodyLongitudeSpeed(body, jdUt) {
  const hi = bodyLongitude(body, jdUt + SPEED_H);
  const lo = bodyLongitude(body, jdUt - SPEED_H);
  return signedAngleDiff(hi, lo) / (2 * SPEED_H);
}

function sunLongitudeDegrees(jdUt) {
  return bodyLongitude('sun', jdUt);
}

/**
 * Find the previous Julian Day (UT) at which the Sun's longitude was
 * `deltaDegrees` behind its value at `jdUt`. Used to locate the Human Design
 * "design" moment (88° of solar arc before birth).
 *
 * @param {number} jdUt
 * @param {number} deltaDegrees
 * @param {*} [_flags] deprecated/ignored (kept for backward compatibility)
 */
function findPreviousSolarLongitude(jdUt, deltaDegrees, _flags) {
  const currentSun = sunLongitudeDegrees(jdUt);
  const target = normalizeAngleDegrees(currentSun - deltaDegrees);

  let highJd = jdUt;
  const step = 1.0; // days
  let lowJd = highJd - step;

  let lowDiff = signedAngleDiff(sunLongitudeDegrees(lowJd), target);

  let iterations = 0;
  const maxIterations = 365;

  // Walk back until we bracket the crossing.
  while (lowDiff > 0 && iterations < maxIterations) {
    lowJd -= step;
    lowDiff = signedAngleDiff(sunLongitudeDegrees(lowJd), target);
    iterations += 1;
  }

  if (lowDiff > 0) {
    throw new Error('Failed to bracket previous solar longitude');
  }

  // Binary search for the crossing.
  for (let i = 0; i < 50; i += 1) {
    const mid = 0.5 * (lowJd + highJd);
    const midDiff = signedAngleDiff(sunLongitudeDegrees(mid), target);
    if (midDiff > 0) {
      highJd = mid;
    } else {
      lowJd = mid;
    }
  }

  return 0.5 * (lowJd + highJd);
}

function getBody(jdUt, body) {
  return {
    longitude: bodyLongitude(body, jdUt),
    longitudeSpeed: bodyLongitudeSpeed(body, jdUt),
  };
}

function deriveOpposite(planet) {
  // Earth = Sun + 180°, South Node = North Node + 180°. Speed carries over.
  return {
    longitude: normalizeAngleDegrees(planet.longitude + 180),
    longitudeSpeed: planet.longitudeSpeed,
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

// The two stream moments shared by every computation below.
function streamMoments({ birthUtc }) {
  const jdPersonality = jdUtcFromDate(birthUtc);
  const jdDesign = findPreviousSolarLongitude(jdPersonality, 88.0);
  return { jdPersonality, jdDesign };
}

function computeProfileSpheres({ birthUtc }) {
  const { jdPersonality, jdDesign } = streamMoments({ birthUtc });

  // Personality bodies
  const pSun = getBody(jdPersonality, 'sun');
  const pMercury = getBody(jdPersonality, 'mercury');
  const pVenus = getBody(jdPersonality, 'venus');
  const pMars = getBody(jdPersonality, 'mars');
  const pJupiter = getBody(jdPersonality, 'jupiter');

  // Design bodies
  const dSun = getBody(jdDesign, 'sun');
  const dMoon = getBody(jdDesign, 'moon');
  const dVenus = getBody(jdDesign, 'venus');
  const dMars = getBody(jdDesign, 'mars');
  const dJupiter = getBody(jdDesign, 'jupiter');
  const dSaturn = getBody(jdDesign, 'saturn');
  const dUranus = getBody(jdDesign, 'uranus');

  // Earth is opposite Sun in HD.
  const pEarth = deriveOpposite(pSun);
  const dEarth = deriveOpposite(dSun);

  // Sphere → body map (parity with event-horizon-api):
  // - p_sun = Life's Work,  p_earth = Evolution
  // - d_sun = Radiance,     d_earth = Purpose
  // - p_venus = IQ,  p_mars = EQ,  p_jupiter = Pearl,  p_mercury = Relating
  // - d_moon = Attraction, d_venus = SQ, d_mars = Core, d_jupiter = Culture
  // - d_saturn = Core Stability, d_uranus = Creativity
  return {
    lifeswork: mapPlanetToGKLine(pSun),
    evolution: mapPlanetToGKLine(pEarth),
    radiance: mapPlanetToGKLine(dSun),
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

    _meta: {
      jd_personality: jdPersonality,
      jd_design: jdDesign,
    },
  };
}

function computeEngineTest({ birthUtc }) {
  const { jdPersonality, jdDesign } = streamMoments({ birthUtc });

  // Personality bodies
  const pSun = getBody(jdPersonality, 'sun');
  const pMercury = getBody(jdPersonality, 'mercury');
  const pVenus = getBody(jdPersonality, 'venus');
  const pMars = getBody(jdPersonality, 'mars');
  const pJupiter = getBody(jdPersonality, 'jupiter');

  // Design bodies
  const dSun = getBody(jdDesign, 'sun');
  const dMoon = getBody(jdDesign, 'moon');
  const dVenus = getBody(jdDesign, 'venus');
  const dMars = getBody(jdDesign, 'mars');
  const dJupiter = getBody(jdDesign, 'jupiter');
  const dSaturn = getBody(jdDesign, 'saturn');
  const dUranus = getBody(jdDesign, 'uranus');

  const pEarth = deriveOpposite(pSun);
  const dEarth = deriveOpposite(dSun);

  return {
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
    spheres: computeProfileSpheres({ birthUtc }),
    _meta: {
      jd_personality: jdPersonality,
      jd_design: jdDesign,
    },
  };
}

// Full Human Design activation set: all 13 bodies in BOTH streams (26 gates),
// used to derive the bodygraph (centers / channels). Earth and South Node are
// derived from Sun / North Node.
const HD_BODIES = [
  'sun',
  'earth',
  'moon',
  'north_node',
  'south_node',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
];

function activationAt(jdUt, body) {
  let planet;
  if (body === 'earth') planet = deriveOpposite(getBody(jdUt, 'sun'));
  else if (body === 'south_node') planet = deriveOpposite(getBody(jdUt, 'north_node'));
  else planet = getBody(jdUt, body);

  const { hexagram, line, color } = mapLongitudeDegrees(planet.longitude);
  return {
    body,
    gate: hexagram,
    line,
    color,
    longitude: planet.longitude,
    retrograde: planet.longitudeSpeed < 0,
  };
}

/**
 * Compute the 26 Human Design activations (13 bodies × personality + design).
 * @param {{ birthUtc: Date }} args
 * @returns {{
 *   personality: Array<object>,
 *   design: Array<object>,
 *   _meta: { jd_personality: number, jd_design: number }
 * }}
 */
function computeActivations({ birthUtc }) {
  const { jdPersonality, jdDesign } = streamMoments({ birthUtc });
  const personality = HD_BODIES.map((b) => ({ stream: 'personality', ...activationAt(jdPersonality, b) }));
  const design = HD_BODIES.map((b) => ({ stream: 'design', ...activationAt(jdDesign, b) }));
  return {
    personality,
    design,
    _meta: { jd_personality: jdPersonality, jd_design: jdDesign },
  };
}

module.exports = {
  computeProfileSpheres,
  computeEngineTest,
  computeActivations,
  jdUtcFromDate,
  // Exported for reuse in global transit scanning (design stream).
  findPreviousSolarLongitude,
  signedAngleDiff,
  // Kept exported for backward compatibility (now a no-op).
  ensureEphePath,
  HD_BODIES,
};
