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
 * `deltaDegrees` behind its value at `jdUt`. Used to locate the bodygraph
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

function mapPlanetToHexagramLine(planet) {
  const { hexagram, line } = mapLongitudeDegrees(planet.longitude);
  return { hexagram: hexagram, line };
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

function computeHexagramProfile({ birthUtc }) {
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

  // Earth is opposite Sun on the wheel.
  const pEarth = deriveOpposite(pSun);
  const dEarth = deriveOpposite(dSun);

  // Keys are p_<body> (Personality) and d_<body> (Design).
  return {
    p_sun: mapPlanetToHexagramLine(pSun),
    p_earth: mapPlanetToHexagramLine(pEarth),
    d_sun: mapPlanetToHexagramLine(dSun),
    d_earth: mapPlanetToHexagramLine(dEarth),

    p_venus: mapPlanetToHexagramLine(pVenus),
    p_mars: mapPlanetToHexagramLine(pMars),
    p_jupiter: mapPlanetToHexagramLine(pJupiter),
    p_mercury: mapPlanetToHexagramLine(pMercury),

    d_moon: mapPlanetToHexagramLine(dMoon),
    d_venus: mapPlanetToHexagramLine(dVenus),
    d_mars: mapPlanetToHexagramLine(dMars),
    d_jupiter: mapPlanetToHexagramLine(dJupiter),
    d_saturn: mapPlanetToHexagramLine(dSaturn),
    d_uranus: mapPlanetToHexagramLine(dUranus),

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
    hexagrams: computeHexagramProfile({ birthUtc }),
    _meta: {
      jd_personality: jdPersonality,
      jd_design: jdDesign,
    },
  };
}

// Full activation set: all 13 bodies in BOTH streams (26 gates),
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
 * Compute the 26 activations (13 bodies × personality + design).
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
  computeHexagramProfile,
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
