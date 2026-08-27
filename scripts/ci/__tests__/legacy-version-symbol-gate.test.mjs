import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CI_HELPERS = path.join(__dirname, '..', '..', 'ci-helpers.sh')

const SCANNED_DIRECTORIES = [
  'scripts',
  'backend-v2',
  'frontend/src',
  'frontend/plugins',
  'backend/src',
  'backend/scripts',
  '.github/docs',
]

const OLD_MAKE_TARGET = 'check-no-stale-' + 'revision'
const OLD_SHELL_FUNCTION = 'check_no_stale_' + 'revision'

const RETIRED_SYMBOLS = [
  ['BUILD_REVISION', 'backend-v2/Dockerfile'],
  ['bakeRevision', 'backend/package.json'],
  ['bakedRevision', 'backend/src/version/reference.js'],
  ['buildRevision', 'backend/src/middlewares/reference.js'],
  ['revisionPlugin', 'frontend/plugins/reference.ts'],
  ['revision-plugin', 'frontend/plugins/reference.ts'],
  ['build-revision', 'frontend/src/reference.ts'],
  ['probe-revision', 'Makefile'],
  [OLD_MAKE_TARGET, 'Makefile'],
  [OLD_SHELL_FUNCTION, 'scripts/legacy.sh'],
  ['BuildRevision', 'backend-v2/internal/config/reference.go'],
]

function write(root, relPath, content = '') {
  const fullPath = path.join(root, relPath)
  mkdirSync(path.dirname(fullPath), {recursive: true})
  writeFileSync(fullPath, content, 'utf8')
}

function withFixture(fn) {
  const root = mkdtempSync(path.join(tmpdir(), 'legacy-version-symbol-gate-'))

  try {
    for (const dir of SCANNED_DIRECTORIES) mkdirSync(path.join(root, dir), {recursive: true})
    mkdirSync(path.join(root, 'backend'), {recursive: true})
    cpSync(CI_HELPERS, path.join(root, 'scripts', 'ci-helpers.sh'))
    write(root, 'backend/package.json', '{"scripts":{}}\n')
    write(root, 'Makefile', 'lint:\n\t@echo ok\n')
    write(root, '.github/docs/lessons-360.md', 'Lessons use version naming.\n')

    fn(root)
  } finally {
    rmSync(root, {recursive: true, force: true})
  }
}

function runGate(root) {
  try {
    const stdout = execFileSync('bash', [path.join(root, 'scripts', 'ci-helpers.sh'), 'check_no_legacy_version_symbols'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return {exitCode: 0, stdout, stderr: ''}
  } catch (err) {
    return {exitCode: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? ''}
  }
}

function assertClean(root) {
  const result = runGate(root)
  assert.equal(result.exitCode, 0, result.stderr)
  assert.match(result.stdout, /No legacy build-version symbols found/)
}

function assertViolation(root, expectedPath, expectedSymbol) {
  const result = runGate(root)
  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /Legacy build-version symbols found/)
  assert.match(result.stderr, new RegExp(expectedPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  assert.match(result.stderr, new RegExp(expectedSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

describe('legacy build-version symbol gate', () => {
  test('clean tree passes even though the helper contains retired-symbol scan data', () => {
    withFixture(root => {
      assertClean(root)
    })
  })

  test('git-domain prose using the word revision is allowed when no retired code-surface symbol appears', () => {
    withFixture(root => {
      write(root, 'scripts/version.test.sh', [
        '# Git tree revision prose is allowed.',
        'echo "content revision differs from committed state"',
      ].join('\n'))

      assertClean(root)
    })
  })

  test('review and lessons docs are scanned for retired code-surface symbols', () => {
    withFixture(root => {
      write(root, '.github/docs/review-entry-360.md', `Retired symbol: ${OLD_MAKE_TARGET}\n`)

      assertViolation(root, '.github/docs/review-entry-360.md', OLD_MAKE_TARGET)
    })
  })

  for (const [symbol, relPath] of RETIRED_SYMBOLS) {
    test(`fails when retired symbol ${symbol} appears in ${relPath}`, () => {
      withFixture(root => {
        write(root, relPath, `retired=${symbol}\n`)

        assertViolation(root, relPath, symbol)
      })
    })
  }

  test('reports every scanned location that contains a retired symbol', () => {
    withFixture(root => {
      write(root, 'Makefile', `lint: ${OLD_MAKE_TARGET}\n`)
      write(root, 'scripts/legacy.sh', `${OLD_SHELL_FUNCTION} "$@"\n`)

      const result = runGate(root)

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /Makefile/)
      assert.match(result.stderr, /scripts\/legacy\.sh/)
      assert.match(result.stderr, new RegExp(OLD_MAKE_TARGET))
      assert.match(result.stderr, new RegExp(OLD_SHELL_FUNCTION))
    })
  })
})
