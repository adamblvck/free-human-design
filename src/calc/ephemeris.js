// Ephemeris backend selector.
//
// free-human-design is pure-JS by default: the `astronomia` backend needs no native
// build and no data files. A high-precision `swisseph` backend is available
// opt-in (EPHE_BACKEND=swisseph) when the native binding + ephemeris files are
// installed — it is never required.
//
// Both backends implement the same interface:
//   { name, BODIES, julianDayUT(dt), longitude(body, jdUT) }   // degrees [0,360)

const astronomiaBackend = require('./astronomia');

let _backend = null;

function parseBool(v) {
  if (v === undefined || v === null || v === '') return false;
  return String(v).toLowerCase() === 'true' || String(v) === '1';
}

function tryLoadSwisseph() {
  try {
    // eslint-disable-next-line global-require
    return require('./swisseph');
  } catch (e) {
    if (parseBool(process.env.EPHE_DEBUG) || parseBool(process.env.EPHE_STATUS)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[free-human-design] EPHE_BACKEND=swisseph requested but unavailable (${e.message.split('\n')[0]}). Falling back to astronomia.`
      );
    }
    return null;
  }
}

/**
 * Resolve the active ephemeris backend (memoized).
 * Default: astronomia. Opt into swisseph with EPHE_BACKEND=swisseph.
 */
function getBackend() {
  if (_backend) return _backend;
  if (String(process.env.EPHE_BACKEND || '').toLowerCase() === 'swisseph') {
    const sw = tryLoadSwisseph();
    if (sw) {
      _backend = sw;
      return _backend;
    }
  }
  _backend = astronomiaBackend;
  return _backend;
}

/**
 * @deprecated No-op. Kept for backward compatibility with callers that set the
 * Swiss Ephemeris data path. The default astronomia backend needs no data files;
 * the optional swisseph backend resolves EPHE_PATH itself.
 */
function ensureEphePath() {
  /* intentionally empty */
}

module.exports = { getBackend, ensureEphePath };
