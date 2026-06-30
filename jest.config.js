module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.js'],
  // First astronomia/ephemeris call can be a touch slow on cold start.
  testTimeout: 15000,
  // Coverage: measure the library source only (not the CLI or scripts).
  collectCoverageFrom: ['src/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/', '/src/calc/swisseph.js'],
  coverageReporters: ['text-summary', 'json-summary'],
};
