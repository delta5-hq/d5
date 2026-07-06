import path from 'path'
import {resolveNodeCommandBindPaths} from './nodeModulesResolver'

const existsNone = () => false
const existsOnly =
  (...paths) =>
  p =>
    paths.includes(p)

describe('resolveNodeCommandBindPaths', () => {
  describe('commands that are not node variants', () => {
    it.each([['python'], ['ruby'], ['npx'], ['bash'], ['sh'], ['deno']])(
      'returns empty array for %s regardless of args',
      command => {
        expect(resolveNodeCommandBindPaths(command, ['/srv/server.js'], existsOnly('/srv/server.js'))).toEqual([])
      },
    )
  })

  describe('node commands with no resolvable script arg', () => {
    it.each([
      ['no args', []],
      ['undefined args', undefined],
      ['flags only', ['--eval', 'console.log(1)']],
      ['inspect flags', ['--inspect', '--harmony']],
      ['unrecognised extension', ['/app/server.ts']],
      ['unrecognised extension .py', ['/app/script.py']],
    ])('%s yields empty array', (_label, args) => {
      expect(resolveNodeCommandBindPaths('node', args, existsNone)).toEqual([])
    })
  })

  describe('node command where the script does not exist on disk', () => {
    it('returns empty array', () => {
      expect(resolveNodeCommandBindPaths('node', ['/missing/server.js'], existsNone)).toEqual([])
    })
  })

  describe('script argument selection', () => {
    it('picks a script arg that is preceded by flags', () => {
      const exists = existsOnly('/app/server.js')
      const result = resolveNodeCommandBindPaths('node', ['--inspect', '/app/server.js'], exists)
      expect(result).toEqual(['/app'])
    })

    it('picks the first argument with a recognised extension when multiple exist', () => {
      const exists = existsOnly('/app/main.js', '/app/other.js')
      const result = resolveNodeCommandBindPaths('node', ['/app/main.js', '/app/other.js'], exists)
      expect(result).toEqual(['/app'])
    })

    it.each([['.js'], ['.cjs'], ['.mjs']])('recognises %s extension', ext => {
      const script = `/app/server${ext}`
      const exists = existsOnly(script)
      expect(resolveNodeCommandBindPaths('node', [script], exists)).toEqual(['/app'])
    })
  })

  describe('relative script path', () => {
    it('resolves the script path against process.cwd()', () => {
      const resolved = path.resolve(process.cwd(), 'server.js')
      const exists = existsOnly(resolved)
      const result = resolveNodeCommandBindPaths('node', ['server.js'], exists)
      expect(result).toEqual([path.dirname(resolved)])
    })
  })

  describe('no ancestor has node_modules — fallback to script dir', () => {
    it('returns the script directory as the sole bind path', () => {
      const exists = existsOnly('/srv/app/server.js')
      expect(resolveNodeCommandBindPaths('node', ['/srv/app/server.js'], exists)).toEqual(['/srv/app'])
    })
  })

  describe('node_modules adjacent to the script file (script at project root)', () => {
    it('returns the script directory which is also the project root', () => {
      const exists = existsOnly('/project/server.js', '/project/node_modules')
      expect(resolveNodeCommandBindPaths('node', ['/project/server.js'], exists)).toEqual(['/project'])
    })
  })

  describe('node_modules in an ancestor of the script dir (standard single-package layout)', () => {
    it('returns the project root — the nearest ancestor owning node_modules', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules')
      expect(resolveNodeCommandBindPaths('node', ['/project/src/server.js'], exists)).toEqual(['/project'])
    })

    it('does not include the script subdirectory as a separate bind path', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules')
      const result = resolveNodeCommandBindPaths('node', ['/project/src/server.js'], exists)
      expect(result).not.toContain('/project/src')
    })
  })

  describe('node_modules in multiple ancestors (monorepo / hoisted-deps layout)', () => {
    it('returns the nearest project root followed by each ancestor node_modules directory', () => {
      const exists = existsOnly('/monorepo/pkg/src/server.js', '/monorepo/pkg/node_modules', '/monorepo/node_modules')
      expect(resolveNodeCommandBindPaths('node', ['/monorepo/pkg/src/server.js'], exists)).toEqual([
        '/monorepo/pkg',
        '/monorepo/node_modules',
      ])
    })

    it('accumulates all ancestor node_modules dirs when there are more than two levels', () => {
      const exists = existsOnly(
        '/root/a/b/server.js',
        '/root/a/b/node_modules',
        '/root/a/node_modules',
        '/root/node_modules',
      )
      expect(resolveNodeCommandBindPaths('node', ['/root/a/b/server.js'], exists)).toEqual([
        '/root/a/b',
        '/root/a/node_modules',
        '/root/node_modules',
      ])
    })
  })

  describe('co-located resource directories alongside node_modules', () => {
    it('includes a listed resource dir that exists beside node_modules at the project root', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules', '/project/shared-contracts')
      expect(resolveNodeCommandBindPaths('node', ['/project/src/server.js'], exists)).toEqual([
        '/project',
        '/project/shared-contracts',
      ])
    })

    it('omits a listed resource dir name when it does not exist on disk beside node_modules', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules')
      expect(resolveNodeCommandBindPaths('node', ['/project/src/server.js'], exists)).toEqual(['/project'])
    })

    it('does not include a resource dir that exists at a level with no node_modules', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules', '/project/src/shared-contracts')
      expect(resolveNodeCommandBindPaths('node', ['/project/src/server.js'], exists)).toEqual(['/project'])
    })

    it('does not include arbitrary sibling directories that are not in the co-located resource list', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules', '/project/unlisted-dir')
      expect(resolveNodeCommandBindPaths('node', ['/project/src/server.js'], exists)).toEqual(['/project'])
    })

    it('does not include co-located resource dirs when the fallback path applies (no node_modules ancestors)', () => {
      const exists = existsOnly('/srv/app/server.js', '/srv/shared-contracts')
      expect(resolveNodeCommandBindPaths('node', ['/srv/app/server.js'], exists)).toEqual(['/srv/app'])
    })

    it('includes a resource dir only at ancestor levels where both node_modules and the resource dir are present', () => {
      const exists = existsOnly(
        '/monorepo/pkg/src/server.js',
        '/monorepo/pkg/node_modules',
        '/monorepo/node_modules',
        '/monorepo/shared-contracts',
      )
      expect(resolveNodeCommandBindPaths('node', ['/monorepo/pkg/src/server.js'], exists)).toEqual([
        '/monorepo/pkg',
        '/monorepo/node_modules',
        '/monorepo/shared-contracts',
      ])
    })

    it('includes resource dirs from every ancestor level where both are present across a deep tree', () => {
      const exists = existsOnly(
        '/root/a/b/server.js',
        '/root/a/b/node_modules',
        '/root/a/b/shared-contracts',
        '/root/a/node_modules',
        '/root/node_modules',
        '/root/shared-contracts',
      )
      expect(resolveNodeCommandBindPaths('node', ['/root/a/b/server.js'], exists)).toEqual([
        '/root/a/b',
        '/root/a/node_modules',
        '/root/node_modules',
        '/root/a/b/shared-contracts',
        '/root/shared-contracts',
      ])
    })
  })

  describe('node-jiti command', () => {
    it('applies the same resolution strategy as node', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules')
      expect(resolveNodeCommandBindPaths('node-jiti', ['/project/src/server.js'], exists)).toEqual(['/project'])
    })

    it('falls back to script dir when no node_modules ancestor exists', () => {
      const exists = existsOnly('/srv/app/server.js')
      expect(resolveNodeCommandBindPaths('node-jiti', ['/srv/app/server.js'], exists)).toEqual(['/srv/app'])
    })

    it('includes co-located resource directories using the same strategy as node', () => {
      const exists = existsOnly('/project/src/server.js', '/project/node_modules', '/project/shared-contracts')
      expect(resolveNodeCommandBindPaths('node-jiti', ['/project/src/server.js'], exists)).toEqual([
        '/project',
        '/project/shared-contracts',
      ])
    })
  })
})
