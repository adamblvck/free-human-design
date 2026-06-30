// Pure-JS ephemeris backend, built on the MIT-licensed `astronomia` package.
//
// This is the DEFAULT backend for rave-engine: no native build, no `.se1` data
// files, no AGPL. It reproduces the same apparent geocentric tropical ecliptic
// longitudes that the Swiss Ephemeris (`SEFLG_SWIEPH`) produces — validated to
// the exact gate/line in the golden vectors (see test/profile.test.js).
//
// All longitudes are returned in DEGREES in [0, 360).
//
// Correctness note (the #1 trap): Swiss Ephemeris `swe_calc_ut` takes UT and
// adds ΔT internally; astronomia's planet/Sun/Moon functions take JDE = UT + ΔT.
// We convert UT → JDE once per call via `deltat.deltaT`, and keep all Julian
// Days the caller sees in UT (the engine's `_meta` JDs are UT).

const A = require('astronomia');
const data = require('astronomia/data').default;

const { normalizeAngleDegrees } = require('./mandala');

const R2D = 180 / Math.PI;

// VSOP87 planet instances (heliocentric spherical, "B" series). Built once.
const EARTH = new A.planetposition.Planet(data.vsop87Bearth);
const PLANETS = {
  mercury: new A.planetposition.Planet(data.vsop87Bmercury),
  venus: new A.planetposition.Planet(data.vsop87Bvenus),
  mars: new A.planetposition.Planet(data.vsop87Bmars),
  jupiter: new A.planetposition.Planet(data.vsop87Bjupiter),
  saturn: new A.planetposition.Planet(data.vsop87Bsaturn),
  uranus: new A.planetposition.Planet(data.vsop87Buranus),
  neptune: new A.planetposition.Planet(data.vsop87Bneptune),
};

// Bodies this backend can place directly. Earth, south_node are DERIVED by the
// caller (Earth = Sun + 180°, South Node = North Node + 180°).
const BODIES = [
  'sun',
  'moon',
  'mercury',
  'venus',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
  'pluto',
  'north_node',
];

/**
 * Julian Day (UT) from a JS Date. Mirrors swe.swe_julday(..., SE_GREG_CAL).
 * @param {Date} dt
 * @returns {number} JD in UT
 */
function julianDayUT(dt) {
  const hour =
    dt.getUTCHours() +
    dt.getUTCMinutes() / 60 +
    dt.getUTCSeconds() / 3600 +
    dt.getUTCMilliseconds() / 3600000;
  // CalendarGregorianToJD takes a fractional day.
  return A.julian.CalendarGregorianToJD(
    dt.getUTCFullYear(),
    dt.getUTCMonth() + 1,
    dt.getUTCDate() + hour / 24
  );
}

function toJDE(jdUT) {
  const cal = A.julian.JDToCalendar(jdUT);
  const yearFrac = cal.year + (cal.month - 1) / 12;
  return jdUT + A.deltat.deltaT(yearFrac) / 86400;
}

function trueObliquity(jde) {
  // mean obliquity + nutation in obliquity (Δε)
  return A.nutation.meanObliquity(jde) + A.nutation.nutation(jde)[1];
}

function sunLonDeg(jde) {
  // apparent (of-date) ecliptic longitude: includes nutation + aberration + FK5
  return A.solar.apparentVSOP87(EARTH, jde).lon * R2D;
}

function planetLonDeg(name, jde) {
  // apparent geocentric equatorial (light-time, aberration, FK5, +Δψ, true ε)
  const pos = A.elliptic.position(PLANETS[name], EARTH, jde);
  const eps = trueObliquity(jde);
  const ecl = new A.coord.Equatorial(pos.ra, pos.dec).toEcliptic(eps);
  return ecl.lon * R2D;
}

function moonLonDeg(jde) {
  // mean equinox of date, no nutation → add Δψ for apparent
  const pos = A.moonposition.position(jde);
  const dpsi = A.nutation.nutation(jde)[0];
  return (pos.lon + dpsi) * R2D;
}

function northNodeLonDeg(jde) {
  // TRUE lunar ascending node (oscillating), matching mainstream Human Design
  // calculators. astronomia returns it referenced to the mean equinox of date;
  // add Δψ for apparent.
  const dpsi = A.nutation.nutation(jde)[0];
  return (A.moonposition.trueNode(jde) + dpsi) * R2D;
}

function plutoLonDeg(jde) {
  // pluto.astrometric returns J2000 astrometric equatorial (note: fields are
  // _ra / _dec). Convert to J2000 ecliptic, precess J2000 → date, then add Δψ
  // for apparent-of-date longitude.
  //
  // IMPORTANT: EclipticPrecessor epochs are JULIAN YEARS (e.g. 2000.0), not
  // Julian Days — passing JD here silently produces nonsense.
  const astro = A.pluto.astrometric(jde, EARTH);
  const eclJ2000 = new A.coord.Equatorial(astro._ra, astro._dec).toEcliptic(
    A.nutation.meanObliquity(2451545.0)
  );
  const epochTo = 2000 + (jde - 2451545.0) / 365.25;
  const prec = new A.precess.EclipticPrecessor(2000, epochTo);
  const moved = prec.precess(new A.coord.Ecliptic(eclJ2000.lon, eclJ2000.lat));
  const dpsi = A.nutation.nutation(jde)[0];
  return (moved.lon + dpsi) * R2D;
}

/**
 * Apparent geocentric tropical ecliptic longitude of `body` at `jdUT`.
 * @param {string} body one of BODIES
 * @param {number} jdUT Julian Day in UT
 * @returns {number} longitude in degrees [0, 360)
 */
function longitude(body, jdUT) {
  const jde = toJDE(jdUT);
  let deg;
  switch (body) {
    case 'sun':
      deg = sunLonDeg(jde);
      break;
    case 'moon':
      deg = moonLonDeg(jde);
      break;
    case 'pluto':
      deg = plutoLonDeg(jde);
      break;
    case 'north_node':
      deg = northNodeLonDeg(jde);
      break;
    default:
      if (!PLANETS[body]) throw new Error(`astronomia backend: unknown body "${body}"`);
      deg = planetLonDeg(body, jde);
  }
  return normalizeAngleDegrees(deg);
}

module.exports = {
  name: 'astronomia',
  BODIES,
  julianDayUT,
  longitude,
  // exposed for reuse/debugging
  toJDE,
  trueObliquity,
};
