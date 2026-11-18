// Mandala / hexagram mapping helpers.
//
// Ported from preliminaries/gk_hex_profile.py to keep math identical.

const pi2 = Math.PI * 2;

// The wheel has 64 slices, each slice can be further subdivided into lines/colors/tones.
const hex_width = pi2 / 64;
const line_width = hex_width / 6;
const color_width = line_width / 6;
const tone_width = color_width / 6;
const base_width = tone_width / 5;

// start counting at 55, but this requires an offset in radiance!
const iching_map = [
  55, 37, 63, 22, 36, 25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8,
  20, 16, 35, 45, 12, 15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29,
  59, 40, 64, 47, 6, 46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14,
  34, 9, 5, 26, 11, 10, 58, 38, 54, 61, 60, 41, 19, 13, 49, 30,
];

const DEG_TO_RADIANS = Math.PI / 180;
const LINE_SEGMENT = 1 / 6;

function neutron_stream_pos(radians_position) {
  // (2*line_width - 1*color_width - 1*tone_width) plus additional offset.
  const offset = 2 * line_width - 1 * color_width - 1 * tone_width + 3 * base_width;
  const offset_calc = (360 * DEG_TO_RADIANS) / 64 * 5 + offset;
  return (((radians_position + offset_calc) / pi2) * 64) % 64;
}

function map_on_hexagram(fractal_line) {
  const fractal_bin = Math.floor(fractal_line);
  const hexagram = iching_map[fractal_bin];

  const remainder = fractal_line - fractal_bin;
  const line = Math.floor(remainder / LINE_SEGMENT) + 1;

  const color_bucket = remainder - LINE_SEGMENT * Math.floor(remainder / LINE_SEGMENT);
  const color = Math.floor(color_bucket / LINE_SEGMENT) + 1;

  return { hexagram, line, color };
}

function map_mandala_hexagram(radians_position) {
  const bin_value = neutron_stream_pos(radians_position);
  return map_on_hexagram(bin_value);
}

function normalizeAngleDegrees(angle) {
  // [0, 360)
  const out = angle % 360;
  return out < 0 ? out + 360 : out;
}

function mapLongitudeDegrees(lonDeg) {
  const lon = normalizeAngleDegrees(lonDeg);
  return map_mandala_hexagram(lon * DEG_TO_RADIANS);
}

module.exports = {
  mapLongitudeDegrees,
  normalizeAngleDegrees,
  // expose for debugging
  iching_map,
};
