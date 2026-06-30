// OPTIONAL high-precision backend, built on the native `swisseph` binding.
//
// This file is only loaded when EPHE_BACKEND=swisseph AND the native binding +
// ephemeris files are actually available. `swisseph` is an optional dependency:
// the package works fully without it (the pure-JS `astronomia` backend is the
// default). Note that `swisseph` is AGPL/commercial and ships Astrodienst data
// files, so it is never required for the published package.
//
// Exposes the same interface as ./astronomia.js so the two are interchangeable:
//   { name, BODIES, julianDayUT(dt), longitude(body, jdUT) }

const path = require('path');
const fs = require('fs');

const { normalizeAngleDegrees } = require('./mandala');

// Loaded lazily — require() of the native binding can throw on ABI mismatch.
const swe = require('swisseph');

const BODY_TO_SE = {
  sun: swe.SE_SUN,
  moon: swe.SE_MOON,
  mercury: swe.SE_MERCURY,
  venus: swe.SE_VENUS,
  mars: swe.SE_MARS,
  jupiter: swe.SE_JUPITER,
  saturn: swe.SE_SATURN,
  uranus: swe.SE_URANUS,
  neptune: swe.SE_NEPTUNE,
  pluto: swe.SE_PLUTO,
  north_node: swe.SE_TRUE_NODE,
};

const BODIES = Object.keys(BODY_TO_SE);
const FLAGS = swe.SEFLG_SWIEPH | swe.SEFLG_SPEED;

let _ephePathSet = false;

function isReadableDir(dirPath) {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch (_e) {
    return false;
  }
}

function ensureEphePath() {
  if (_ephePathSet) return;
  const configured = process.env.EPHE_PATH;
  let ephePath = null;
  if (configured && isReadableDir(path.resolve(configured))) {
    ephePath = path.resolve(configured);
  } else {
    // swisseph ships its own ephe/ folder; use it as a fallback.
    try {
      const pkg = require.resolve('swisseph/package.json');
      const candidate = path.join(path.dirname(pkg), 'ephe');
      if (isReadableDir(candidate)) ephePath = candidate;
    } catch (_e) {
      /* ignore */
    }
  }
  if (ephePath) swe.swe_set_ephe_path(ephePath);
  _ephePathSet = true;
}

function julianDayUT(dt) {
  const hour =
    dt.getUTCHours() +
    dt.getUTCMinutes() / 60 +
    dt.getUTCSeconds() / 3600 +
    dt.getUTCMilliseconds() / 3600000;
  return swe.swe_julday(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), hour, swe.SE_GREG_CAL);
}

function longitude(body, jdUT) {
  ensureEphePath();
  const id = BODY_TO_SE[body];
  if (id === undefined) throw new Error(`swisseph backend: unknown body "${body}"`);
  const r = swe.swe_calc_ut(jdUT, id, FLAGS);
  if (!r || !Number.isFinite(r.longitude)) {
    throw new Error(`swisseph backend: swe_calc_ut failed for "${body}" (${r && r.error})`);
  }
  return normalizeAngleDegrees(r.longitude);
}

module.exports = { name: 'swisseph', BODIES, julianDayUT, longitude };
