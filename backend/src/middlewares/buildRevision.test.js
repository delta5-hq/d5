import revision from '../revision/bakedRevision'
import buildRevision from './buildRevision'

const runMiddleware = async () => {
  const ctx = {status: null, body: null}
  await buildRevision(ctx)
  return ctx
}

const withEnv = async (envValue, fn) => {
  const saved = process.env.BUILD_REVISION
  try {
    if (envValue === undefined) delete process.env.BUILD_REVISION
    else process.env.BUILD_REVISION = envValue
    await fn()
  } finally {
    if (saved === undefined) delete process.env.BUILD_REVISION
    else process.env.BUILD_REVISION = saved
  }
}

describe('buildRevision middleware', () => {
  it('responds HTTP 200', async () => {
    const ctx = await runMiddleware()
    expect(ctx.status).toBe(200)
  })

  it('response body is exactly {revision: <baked-value>} with no extra keys', async () => {
    const ctx = await runMiddleware()
    expect(Object.keys(ctx.body)).toStrictEqual(['revision'])
    expect(ctx.body.revision).toBe(revision)
  })

  it('revision is a non-empty string', async () => {
    const ctx = await runMiddleware()
    expect(typeof ctx.body.revision).toBe('string')
    expect(ctx.body.revision.trim().length).toBeGreaterThan(0)
  })

  describe('runtime process environment cannot override the baked revision', () => {
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
        expect(ctx.body.revision).toBe(revision)
      })
    })
  })
})
