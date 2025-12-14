export default {
  testTimeout: 60000,
  testEnvironment: 'node',
  transform: {
    '^.+\\.js$': 'babel-jest',
  },
  setupFilesAfterEnv: ['<rootDir>/setupAfterEnv.js'],
  testMatch: ['<rootDir>/**/*.e2e.test.js'],
  reporters: ['default', 'jest-junit'],
  maxWorkers: 2,
}
