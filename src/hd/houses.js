// Extended astrology: chart angles (Ascendant, Descendant, MC, IC) and house
// cusps (Whole Sign, Equal, Placidus).
//
// These need NO ephemeris — only local sidereal time and the obliquity of the
// ecliptic — so they are computed purely from Julian Day (UT) + geographic
// latitude/longitude using the MIT `astronomia` package for sidereal time and
// obliquity.

const A = require('astronomia');
const { normalizeAngleDegrees, mapLongitudeDegrees } = require('../calc/mandala');

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

const SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
];

function signOf(lonDeg) {
  const lon = normalizeAngleDegrees(lonDeg);
  const idx = Math.floor(lon / 30);
  return {
    sign: SIGNS[idx],
    signIndex: idx,
    degInSign: lon - idx * 30,
  };
}

/**
 * Greenwich Apparent Sidereal Time in degrees for a Julian Day (UT).
 * astronomia returns seconds of time; convert to degrees (×15/3600).
 */
function gastDegrees(jdUT) {
  return normalizeAngleDegrees((A.sidereal.apparent(jdUT) / 3600) * 15);
}

function trueObliquityDeg(jdUT) {
  // mean obliquity + nutation in obliquity, in degrees
  return (A.nutation.meanObliquity(jdUT) + A.nutation.nutation(jdUT)[1]) * R2D;
}

/**
 * Right Ascension of the Midheaven (Local Apparent Sidereal Time) in degrees.
 * @param {number} jdUT
 * @param {number} lngEast geographic longitude, degrees east (negative = west)
 */
function ramcDegrees(jdUT, lngEast) {
  return normalizeAngleDegrees(gastDegrees(jdUT) + lngEast);
}

/**
 * Ecliptic longitude of a point on the ecliptic (β=0) given its right ascension.
 * λ = atan2(sin α, cos α · cos ε)
 */
function eclipticLonFromRA(raDeg, epsDeg) {
  const ra = raDeg * D2R;
  const eps = epsDeg * D2R;
  return normalizeAngleDegrees(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(eps)) * R2D);
}

function declOfEclipticPoint(lonDeg, epsDeg) {
  return Math.asin(Math.sin(epsDeg * D2R) * Math.sin(lonDeg * D2R)) * R2D;
}

/**
 * Compute the four chart angles.
 * @param {{ jdUT: number, lat: number, lng: number }} args  lat/lng in degrees
 *        (lat north +, lng east +)
 * @returns {{ ascendant, descendant, mc, ic }} each { longitude, sign, signIndex, degInSign, gateLine }
 */
function computeAngles({ jdUT, lat, lng }) {
  const eps = trueObliquityDeg(jdUT);
  const ramc = ramcDegrees(jdUT, lng);
  const ramcR = ramc * D2R;
  const epsR = eps * D2R;
  const phiR = lat * D2R;

  const mc = normalizeAngleDegrees(
    Math.atan2(Math.sin(ramcR), Math.cos(ramcR) * Math.cos(epsR)) * R2D
  );

  let asc = normalizeAngleDegrees(
    Math.atan2(
      Math.cos(ramcR),
      -(Math.sin(ramcR) * Math.cos(epsR) + Math.tan(phiR) * Math.sin(epsR))
    ) * R2D
  );

  // The Ascendant must lie in the rising semicircle, i.e. 0..180° east of the
  // MC. If the formula landed on the opposite point, flip it.
  if (normalizeAngleDegrees(asc - mc) > 180) {
    asc = normalizeAngleDegrees(asc + 180);
  }

  const decorate = (lon) => ({
    longitude: lon,
    ...signOf(lon),
    gateLine: (() => {
      const m = mapLongitudeDegrees(lon);
      return { gate: m.hexagram, line: m.line };
    })(),
  });

  return {
    ascendant: decorate(asc),
    descendant: decorate(normalizeAngleDegrees(asc + 180)),
    mc: decorate(mc),
    ic: decorate(normalizeAngleDegrees(mc + 180)),
    _meta: { ramc, obliquity: eps },
  };
}

// Iterative Placidus intermediate cusp (houses 11, 12, 2, 3).
// Solves for the ecliptic point whose RA divides its day/night semi-arc in the
// Placidus ratio. Returns null if the point is circumpolar (Placidus undefined,
// typically |lat| > ~66°).
function placidusIntermediate(ramc, eps, lat, which) {
  // which: '11' | '12' | '2' | '3'
  const phiR = lat * D2R;
  const epsR = eps * D2R;

  // target RA(SA, NA) per cusp; SA = semidiurnal arc, NA = 180 - SA
  function targetRA(SA) {
    const NA = 180 - SA;
    switch (which) {
      case '11':
        return ramc + (1 / 3) * SA;
      case '12':
        return ramc + (2 / 3) * SA;
      case '2':
        return ramc + SA + (1 / 3) * NA;
      case '3':
        return ramc + SA + (2 / 3) * NA;
      default:
        throw new Error(`bad cusp ${which}`);
    }
  }

  // initial offsets 30/60/120/150
  const initialOffset = { 11: 30, 12: 60, 2: 120, 3: 150 }[which];
  let ra = ramc + initialOffset;

  for (let i = 0; i < 100; i += 1) {
    const lon = eclipticLonFromRA(ra, eps);
    const decl = declOfEclipticPoint(lon, eps);
    const cosSA = -Math.tan(phiR) * Math.tan(decl * D2R);
    if (cosSA <= -1 || cosSA >= 1) return null; // circumpolar → Placidus fails
    const SA = Math.acos(cosSA) * R2D;
    const next = targetRA(SA);
    if (Math.abs(normalizeAngleDegrees(next - ra + 180) - 180) < 1e-9) {
      ra = next;
      break;
    }
    ra = next;
  }
  return eclipticLonFromRA(ra, eps);
}

/**
 * Compute the 12 house cusps for a given system.
 * @param {{ jdUT, lat, lng, system?: 'whole'|'equal'|'placidus' }} args
 * @returns {{ system, cusps: Array<{ house, longitude, sign, degInSign }>, angles, fallback? }}
 */
function computeHouses({ jdUT, lat, lng, system = 'placidus' }) {
  const angles = computeAngles({ jdUT, lat, lng });
  const asc = angles.ascendant.longitude;
  const mc = angles.mc.longitude;
  const eps = angles._meta.obliquity;
  const ramc = angles._meta.ramc;

  const sys = String(system).toLowerCase();
  let cuspLons = new Array(12);
  let usedSystem = sys;
  let fallback;

  if (sys === 'whole') {
    const base = Math.floor(normalizeAngleDegrees(asc) / 30) * 30;
    for (let i = 0; i < 12; i += 1) cuspLons[i] = normalizeAngleDegrees(base + i * 30);
  } else if (sys === 'equal') {
    for (let i = 0; i < 12; i += 1) cuspLons[i] = normalizeAngleDegrees(asc + i * 30);
  } else {
    // placidus
    const c11 = placidusIntermediate(ramc, eps, lat, '11');
    const c12 = placidusIntermediate(ramc, eps, lat, '12');
    const c2 = placidusIntermediate(ramc, eps, lat, '2');
    const c3 = placidusIntermediate(ramc, eps, lat, '3');
    if ([c11, c12, c2, c3].some((x) => x === null)) {
      // Polar latitude: fall back to whole sign.
      fallback = 'placidus undefined at this latitude — fell back to whole sign';
      usedSystem = 'whole';
      const base = Math.floor(normalizeAngleDegrees(asc) / 30) * 30;
      for (let i = 0; i < 12; i += 1) cuspLons[i] = normalizeAngleDegrees(base + i * 30);
    } else {
      cuspLons[0] = asc; // 1
      cuspLons[1] = c2; // 2
      cuspLons[2] = c3; // 3
      cuspLons[3] = normalizeAngleDegrees(mc + 180); // 4 (IC)
      cuspLons[4] = normalizeAngleDegrees(c11 + 180); // 5
      cuspLons[5] = normalizeAngleDegrees(c12 + 180); // 6
      cuspLons[6] = normalizeAngleDegrees(asc + 180); // 7 (Desc)
      cuspLons[7] = normalizeAngleDegrees(c2 + 180); // 8
      cuspLons[8] = normalizeAngleDegrees(c3 + 180); // 9
      cuspLons[9] = mc; // 10 (MC)
      cuspLons[10] = c11; // 11
      cuspLons[11] = c12; // 12
    }
  }

  const cusps = cuspLons.map((lon, i) => ({
    house: i + 1,
    longitude: lon,
    ...signOf(lon),
  }));

  return { system: usedSystem, requestedSystem: sys, fallback, cusps, angles };
}

module.exports = {
  SIGNS,
  signOf,
  computeAngles,
  computeHouses,
  // exposed for testing
  gastDegrees,
  trueObliquityDeg,
  ramcDegrees,
  eclipticLonFromRA,
};
