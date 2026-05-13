export default {
  testTimeout: 60000,
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/setupAfterEnv.js'],
  testMatch: ['<rootDir>/**/*.e2e.test.js'],
  reporters: ['default', 'jest-junit'],
  // Suites share fixed user IDs and each beforeEach deleteMany's shared collections;
  // parallel workers wipe each other's in-flight writes.
  maxWorkers: 1,
}
