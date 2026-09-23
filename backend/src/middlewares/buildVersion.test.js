import version from '../version/bakedVersion'
import buildVersion from './buildVersion'

const runMiddleware = async () => {
  const ctx = {status: null, body: null}
  await buildVersion(ctx)
  return ctx
}

const withEnv = async (envValue, fn) => {
  const saved = process.env.BUILD_VERSION
  try {
    if (envValue === undefined) delete process.env.BUILD_VERSION
    else process.env.BUILD_VERSION = envValue
    await fn()
  } finally {
    if (saved === undefined) delete process.env.BUILD_VERSION
    else process.env.BUILD_VERSION = saved
  }
}

describe('buildVersion middleware', () => {
  it('responds HTTP 200', async () => {
    const ctx = await runMiddleware()
    expect(ctx.status).toBe(200)
  })

  it('response body is exactly {version: <baked-value>} with no extra keys', async () => {
    const ctx = await runMiddleware()
    expect(Object.keys(ctx.body)).toStrictEqual(['version'])
    expect(ctx.body.version).toBe(version)
  })

  it('version is a non-empty string', async () => {
    const ctx = await runMiddleware()
    expect(typeof ctx.body.version).toBe('string')
    expect(ctx.body.version.trim()).not.toBe('')
  })

  describe('runtime process environment cannot override the baked version', () => {
    it.each([
      ['absent (undefined)', undefined],
      ['empty string', ''],
      ['short git sha', 'a1b2c3d'],
      ['full 40-char sha', '4b825dc642cb6eb9a060e54bf8d69288fbee4904'],
      ['commit+tree composite format', '4b825dc642cb6eb9a060e54bf8d69288fbee4904+abc123def'],
      ['semver tag', 'v2.3.1-rc.4'],
      ['branch-qualified ref', 'refs/heads/feature/360-validate'],
    ])('%s: returns the baked constant unchanged', async (_label, envValue) => {
      await withEnv(envValue, async () => {
        const ctx = await runMiddleware()
        expect(ctx.body.version).toBe(version)
      })
    })
  })
})
