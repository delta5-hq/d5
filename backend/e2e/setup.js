/**
 * DEPRECATED: This file is being phased out in favor of universal HTTP-only testing
 * Use test-data-factory.js httpSetup instead
 */

export const setupDb = async () => {
  console.log('DEPRECATED: Use httpSetup.setupDb() from test-data-factory.js')
}

export const teardownDb = async () => {
  console.log('DEPRECATED: Use httpSetup.teardownDb() from test-data-factory.js')
}

/* DEPRECATED: All tests should use HTTP-only mode */
export const isHttpMode = () => {
  console.warn('DEPRECATED: isHttpMode() should not be used. All tests run in HTTP-only mode.')
  return true
}
