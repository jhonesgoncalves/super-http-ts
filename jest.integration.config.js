/**
 * Integration suite — real sockets, real timeouts, no axios mock.
 *
 * Kept separate from jest.config.js so the unit suite stays fast and so the
 * fault-injection fixture is not picked up as a test file (the unit config's
 * testRegex matches every file under __tests__).
 */
module.exports = {
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testRegex: '\\.itest\\.ts$',
  testPathIgnorePatterns: ['/node_modules/', '/example/', '/lib/'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  // Real network timing; a slow CI box should not be a flake.
  testTimeout: 30_000,
  // Shared TCP ports and per-test server state do not survive parallel workers.
  maxWorkers: 1,
};
