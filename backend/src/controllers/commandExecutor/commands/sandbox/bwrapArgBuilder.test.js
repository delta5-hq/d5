import {buildBwrapArgs} from './bwrapArgBuilder'

const extractRoBindTargets = args => args.reduce((acc, a, i) => (a === '--ro-bind' ? [...acc, args[i + 1]] : acc), [])

const separatorIndex = args => args.indexOf('--')

describe('buildBwrapArgs', () => {
  describe('namespace isolation flags', () => {
    it.each([['--unshare-pid'], ['--unshare-uts'], ['--unshare-ipc']])('includes %s before the -- separator', flag => {
      const args = buildBwrapArgs('node', [], {systemDirArgs: [], bindPaths: []})
      expect(args).toContain(flag)
      expect(args.indexOf(flag)).toBeLessThan(separatorIndex(args))
    })
  })

  describe('required filesystem mounts', () => {
    it.each([
      ['--proc', '/proc'],
      ['--dev', '/dev'],
      ['--tmpfs', '/tmp'],
    ])('includes %s %s before the -- separator', (flag, target) => {
      const args = buildBwrapArgs('node', [], {systemDirArgs: [], bindPaths: []})
      const idx = args.indexOf(flag)
      expect(idx).toBeGreaterThan(-1)
      expect(args[idx + 1]).toBe(target)
      expect(idx).toBeLessThan(separatorIndex(args))
    })
  })

  describe('system dir args', () => {
    it('inserts systemDirArgs verbatim before the -- separator', () => {
      const systemDirArgs = ['--ro-bind', '/usr', '/usr', '--ro-bind', '/lib', '/lib']
      const args = buildBwrapArgs('npx', [], {systemDirArgs, bindPaths: []})
      const sep = separatorIndex(args)
      const sysSlice = args.slice(0, sep)
      expect(sysSlice).toEqual(expect.arrayContaining(systemDirArgs))
    })

    it('is placed after namespace flags and before bind paths', () => {
      const systemDirArgs = ['--ro-bind', '/usr', '/usr']
      const args = buildBwrapArgs('node', ['/app/s.js'], {systemDirArgs, bindPaths: ['/project']})
      const unshareIdx = args.indexOf('--unshare-pid')
      const sysIdx = args.indexOf('--ro-bind')
      const bindIdx = args.lastIndexOf('--ro-bind')
      const sep = separatorIndex(args)
      expect(unshareIdx).toBeLessThan(sysIdx)
      expect(sysIdx).toBeLessThan(sep)
      expect(bindIdx).toBeLessThan(sep)
    })
  })

  describe('bind paths', () => {
    it('emits a --ro-bind path path triple for each bind path', () => {
      const args = buildBwrapArgs('node', [], {systemDirArgs: [], bindPaths: ['/project', '/extra/node_modules']})
      const targets = extractRoBindTargets(args)
      expect(targets).toContain('/project')
      expect(targets).toContain('/extra/node_modules')
    })

    it('uses the same path as both source and destination', () => {
      const args = buildBwrapArgs('node', [], {systemDirArgs: [], bindPaths: ['/project']})
      const idx = args.lastIndexOf('--ro-bind')
      expect(args[idx + 1]).toBe('/project')
      expect(args[idx + 2]).toBe('/project')
    })

    it('places bind paths before the -- separator', () => {
      const args = buildBwrapArgs('node', [], {systemDirArgs: [], bindPaths: ['/project']})
      const bindIdx = args.lastIndexOf('--ro-bind')
      expect(bindIdx).toBeLessThan(separatorIndex(args))
    })

    it('emits no --ro-bind entries when bindPaths is empty and systemDirArgs is empty', () => {
      const args = buildBwrapArgs('npx', [], {systemDirArgs: [], bindPaths: []})
      expect(args).not.toContain('--ro-bind')
    })
  })

  describe('-- separator and original command placement', () => {
    it('always contains exactly one -- separator', () => {
      const args = buildBwrapArgs('node', ['/app/s.js'], {systemDirArgs: [], bindPaths: []})
      expect(args.filter(a => a === '--')).toHaveLength(1)
    })

    it('places the original command immediately after --', () => {
      const args = buildBwrapArgs('node', ['/app/s.js'], {systemDirArgs: [], bindPaths: []})
      const sep = separatorIndex(args)
      expect(args[sep + 1]).toBe('node')
    })

    it('places original args after the command following --', () => {
      const args = buildBwrapArgs('npx', ['-y', '@scope/pkg'], {systemDirArgs: [], bindPaths: []})
      const sep = separatorIndex(args)
      expect(args.slice(sep + 1)).toEqual(['npx', '-y', '@scope/pkg'])
    })

    it('places only the command after -- when args is undefined', () => {
      const args = buildBwrapArgs('node', undefined, {systemDirArgs: [], bindPaths: []})
      const sep = separatorIndex(args)
      expect(args.slice(sep + 1)).toEqual(['node'])
    })

    it('places only the command after -- when args is empty', () => {
      const args = buildBwrapArgs('node', [], {systemDirArgs: [], bindPaths: []})
      const sep = separatorIndex(args)
      expect(args.slice(sep + 1)).toEqual(['node'])
    })
  })
})
