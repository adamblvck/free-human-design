module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  // swe_calc_ut on first call after the .se1 files load can be a touch slow on cold start.
  testTimeout: 15000,
};
