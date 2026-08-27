export const MOCK_PASS_RATE_ENV = 'MOCK_PASS_RATE'

const parsePassRate = () => {
  const envVal = process.env[MOCK_PASS_RATE_ENV]
  if (!envVal) return 1
  const raw = Number(envVal)
  return Number.isFinite(raw) && raw >= 0 && raw <= 1 ? raw : 1
}

export class MockGeneratorFailureError extends Error {
  constructor() {
    super(`Mock generator forced to fail — raise ${MOCK_PASS_RATE_ENV} above 0 to allow successes`)
    this.name = 'MockGeneratorFailureError'
  }
}

const shouldFail = passRate => passRate <= 0 || (passRate < 1 && Math.random() >= passRate)

export const assertGeneratorAllowed = () => {
  if (shouldFail(parsePassRate())) throw new MockGeneratorFailureError()
}
