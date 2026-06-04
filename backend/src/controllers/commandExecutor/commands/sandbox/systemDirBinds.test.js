import {SYSTEM_DIRS, buildSystemDirArgs} from './systemDirBinds'

const existsNone = () => false
const existsAll = () => true
const existsOnly =
  (...paths) =>
  p =>
    paths.includes(p)

const extractRoBindTriples = args =>
  args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args.slice(i, i + 3)] : acc), [])

const extractRoBindTargets = args => extractRoBindTriples(args).map(([, target]) => target)

describe('SYSTEM_DIRS', () => {
  it('is a non-empty frozen array', () => {
    expect(Array.isArray(SYSTEM_DIRS)).toBe(true)
    expect(SYSTEM_DIRS.length).toBeGreaterThan(0)
    expect(Object.isFrozen(SYSTEM_DIRS)).toBe(true)
  })

  it('does not contain duplicate mount roots', () => {
    expect(new Set(SYSTEM_DIRS).size).toBe(SYSTEM_DIRS.length)
  })

  it.each([['/usr'], ['/opt'], ['/lib'], ['/lib64'], ['/etc/ssl']])(
    'contains %s for executable, loader, and TLS runtime support',
    dir => {
      expect(SYSTEM_DIRS).toContain(dir)
    },
  )
})

describe('buildSystemDirArgs', () => {
  it('returns empty array when no system directories exist', () => {
    expect(buildSystemDirArgs(existsNone)).toEqual([])
  })

  it.each([
    [['/usr'], [['--ro-bind', '/usr', '/usr']]],
    [['/opt'], [['--ro-bind', '/opt', '/opt']]],
    [
      ['/usr', '/lib'],
      [
        ['--ro-bind', '/usr', '/usr'],
        ['--ro-bind', '/lib', '/lib'],
      ],
    ],
  ])('produces read-only self-bind triples for existing directories: %j', (existingDirs, expectedTriples) => {
    expect(extractRoBindTriples(buildSystemDirArgs(existsOnly(...existingDirs)))).toEqual(expectedTriples)
  })

  it('omits directories that do not exist', () => {
    const args = buildSystemDirArgs(existsOnly('/usr'))
    const targets = extractRoBindTargets(args)

    expect(targets).toContain('/usr')
    expect(targets).not.toContain('/lib')
    expect(targets).not.toContain('/lib64')
    expect(targets).not.toContain('/opt')
  })

  it('preserves SYSTEM_DIRS order in the output', () => {
    const args = buildSystemDirArgs(existsAll)
    const targets = extractRoBindTargets(args)
    const dirsInOutput = targets.filter(t => SYSTEM_DIRS.includes(t))

    expect(dirsInOutput).toEqual([...SYSTEM_DIRS])
  })

  it('emits exactly one read-only self-bind triple per existing directory', () => {
    const args = buildSystemDirArgs(existsAll)
    const triples = extractRoBindTriples(args)

    expect(args.length).toBe(SYSTEM_DIRS.length * 3)
    expect(triples).toHaveLength(SYSTEM_DIRS.length)
    expect(triples).toEqual(SYSTEM_DIRS.map(dir => ['--ro-bind', dir, dir]))
  })
})
