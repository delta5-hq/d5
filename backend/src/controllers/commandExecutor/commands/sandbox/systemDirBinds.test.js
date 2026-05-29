import {SYSTEM_DIRS, buildSystemDirArgs} from './systemDirBinds'

const existsNone = () => false
const existsAll = () => true
const existsOnly =
  (...paths) =>
  p =>
    paths.includes(p)

const extractRoBindTargets = args => args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])

describe('SYSTEM_DIRS', () => {
  it('is a non-empty frozen array', () => {
    expect(Array.isArray(SYSTEM_DIRS)).toBe(true)
    expect(SYSTEM_DIRS.length).toBeGreaterThan(0)
    expect(Object.isFrozen(SYSTEM_DIRS)).toBe(true)
  })

  it('contains /usr where the node binary typically lives', () => {
    expect(SYSTEM_DIRS).toContain('/usr')
  })

  it('contains /lib and /lib64 for the dynamic linker', () => {
    expect(SYSTEM_DIRS).toContain('/lib')
    expect(SYSTEM_DIRS).toContain('/lib64')
  })

  it('contains /etc/ssl for TLS certificate verification', () => {
    expect(SYSTEM_DIRS).toContain('/etc/ssl')
  })
})

describe('buildSystemDirArgs', () => {
  it('returns empty array when no system directories exist', () => {
    expect(buildSystemDirArgs(existsNone)).toEqual([])
  })

  it('produces a --ro-bind source dest pair for each existing directory', () => {
    const args = buildSystemDirArgs(existsOnly('/usr', '/lib'))
    const targets = extractRoBindTargets(args)
    expect(targets).toContain('/usr')
    expect(targets).toContain('/lib')
  })

  it('omits directories that do not exist', () => {
    const args = buildSystemDirArgs(existsOnly('/usr'))
    const targets = extractRoBindTargets(args)
    expect(targets).not.toContain('/lib')
    expect(targets).not.toContain('/lib64')
  })

  it('emits exactly two tokens per directory (source and dest are identical)', () => {
    const args = buildSystemDirArgs(existsOnly('/usr'))
    const usrIndex = args.indexOf('--ro-bind')
    expect(args[usrIndex + 1]).toBe('/usr')
    expect(args[usrIndex + 2]).toBe('/usr')
  })

  it('preserves SYSTEM_DIRS order in the output', () => {
    const args = buildSystemDirArgs(existsAll)
    const targets = extractRoBindTargets(args)
    const dirsInOutput = targets.filter(t => SYSTEM_DIRS.includes(t))
    expect(dirsInOutput).toEqual([...SYSTEM_DIRS])
  })

  it('produces (3 × N) tokens for N existing directories', () => {
    const args = buildSystemDirArgs(existsAll)
    expect(args.length).toBe(SYSTEM_DIRS.length * 3)
  })
})
