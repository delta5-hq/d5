import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCANNER = path.join(__dirname, '..', 'scan-range-assertions.mjs')

const GUARDED_MODULES = [
  'SubtreeForkRunner',
  'commodityForkMerge',
  'commodityForkSuccess',
  'commodityParams',
  'runCommand',
]

const RANGE_MATCHERS = [
  'toBeGreaterThan',
  'toBeGreaterThanOrEqual',
  'toBeLessThan',
  'toBeLessThanOrEqual',
]

function runScanner(...roots) {
  try {
    execFileSync('node', [SCANNER, ...roots], {encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']})
    return {exitCode: 0, stderr: ''}
  } catch (err) {
    return {exitCode: err.status ?? 1, stderr: err.stderr ?? ''}
  }
}

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'range-gate-'))
  try {
    fn(dir)
  } finally {
    rmSync(dir, {recursive: true})
  }
}

function write(dir, filename, lines) {
  writeFileSync(path.join(dir, filename), lines.join('\n'), 'utf8')
}

function scanFixture(lines, filename = 'fixture.test.js') {
  let result
  withTempDir(dir => {
    write(dir, filename, lines)
    result = runScanner(dir)
  })
  return result
}

function assertViolation(lines, expectedPattern = /RANGE-VIOLATION/, filename) {
  const {exitCode, stderr} = scanFixture(lines, filename)
  assert.equal(exitCode, 1)
  assert.match(stderr, expectedPattern)
}

function assertClean(lines, filename) {
  const {exitCode, stderr} = scanFixture(lines, filename)
  assert.equal(exitCode, 0, stderr)
}

function guardedRangeAssertion(binding = 'runForks', matcher = 'toBeGreaterThan') {
  return `  expect(${binding}.mock.calls.length).${matcher}(0)`
}

describe('guarded module recognition', () => {
  for (const mod of GUARDED_MODULES) {
    test(`fires for guarded module ${mod}`, () => {
      assertViolation([
        `import { runForks } from './${mod}'`,
        "test('bad', () => {",
        guardedRangeAssertion(),
        '})',
      ])
    })
  }

  test('does not fire for an unguarded module with the same assertion shape', () => {
    assertClean([
      "import { runForks } from './ordinaryRunner'",
      "test('clean', () => {",
      guardedRangeAssertion(),
      '})',
    ])
  })
})

describe('range matcher recognition', () => {
  for (const matcher of RANGE_MATCHERS) {
    test(`fires on ${matcher} against a guarded value`, () => {
      assertViolation([
        "import { runForks } from './SubtreeForkRunner'",
        "test('bad', () => {",
        guardedRangeAssertion('runForks', matcher),
        '})',
      ], new RegExp(matcher))
    })
  }

  test('allows exact call-count assertions against guarded values', () => {
    assertClean([
      "import { runForks } from './SubtreeForkRunner'",
      "test('ok', () => {",
      '  expect(runForks).toHaveBeenCalledTimes(3)',
      '})',
    ])
  })
})

describe('import binding variants', () => {
  const cases = [
    {
      name: 'ESM named import',
      importLine: "import { runForks } from './SubtreeForkRunner'",
      binding: 'runForks',
    },
    {
      name: 'ESM named import alias',
      importLine: "import { runForks as forks } from './SubtreeForkRunner'",
      binding: 'forks',
    },
    {
      name: 'ESM default import',
      importLine: "import SubtreeForkRunner from './SubtreeForkRunner'",
      binding: 'SubtreeForkRunner',
    },
    {
      name: 'CommonJS destructured require',
      importLine: "const { runForks } = require('./SubtreeForkRunner')",
      binding: 'runForks',
    },
    {
      name: 'CommonJS destructured require alias',
      importLine: "const { runForks: forks } = require('./SubtreeForkRunner')",
      binding: 'forks',
    },
    {
      name: 'CommonJS default require',
      importLine: "const SubtreeForkRunner = require('./SubtreeForkRunner')",
      binding: 'SubtreeForkRunner',
    },
  ]

  for (const {name, importLine, binding} of cases) {
    test(`fires on ${name}`, () => {
      assertViolation([
        importLine,
        "test('bad', () => {",
        guardedRangeAssertion(binding),
        '})',
      ])
    })
  }
})

describe('file discovery boundaries', () => {
  const scannedTestFileSuffixes = [
    'test.js',
    'test.jsx',
    'test.ts',
    'test.tsx',
    'spec.js',
    'spec.jsx',
    'spec.ts',
    'spec.tsx',
    'test.mjs',
    'spec.mts',
  ]

  for (const suffix of scannedTestFileSuffixes) {
    test(`scans *.${suffix}`, () => {
      assertViolation([
        "import { runForks } from './SubtreeForkRunner'",
        "test('bad', () => {",
        guardedRangeAssertion(),
        '})',
      ], /RANGE-VIOLATION/, `violation.${suffix}`)
    })
  }

  for (const filename of ['helper.js', 'helper.ts', 'violation.e2e.ts', 'violation.story.tsx']) {
    test(`does not scan ${filename}`, () => {
      assertClean([
        "import { runForks } from './SubtreeForkRunner'",
        guardedRangeAssertion(),
      ], filename)
    })
  }

  for (const ignoredDir of ['node_modules', 'dist']) {
    test(`does not scan inside ${ignoredDir}`, () => {
      withTempDir(dir => {
        const nested = path.join(dir, ignoredDir, 'pkg')
        mkdirSync(nested, {recursive: true})
        writeFileSync(path.join(nested, 'violation.test.js'), [
          "import { runForks } from './SubtreeForkRunner'",
          "test('bad', () => {",
          guardedRangeAssertion(),
          '})',
        ].join('\n'))
        const {exitCode} = runScanner(dir)
        assert.equal(exitCode, 0)
      })
    })
  }

  test('scans test files nested inside ordinary subdirectories', () => {
    withTempDir(dir => {
      const nested = path.join(dir, 'nested', 'deep')
      mkdirSync(nested, {recursive: true})
      writeFileSync(path.join(nested, 'violation.test.js'), [
        "import { runForks } from './SubtreeForkRunner'",
        "test('bad', () => {",
        guardedRangeAssertion(),
        '})',
      ].join('\n'))
      const {exitCode, stderr} = runScanner(dir)
      assert.equal(exitCode, 1)
      assert.match(stderr, /nested\/deep\/violation\.test\.js/)
    })
  })

  test('scans every root passed on the command line', () => {
    withTempDir(dir => {
      const roots = ['root-a', 'root-b', 'root-c'].map(root => path.join(dir, root))
      roots.forEach(root => mkdirSync(root, {recursive: true}))
      writeFileSync(path.join(roots[0], 'clean.test.js'), [
        "import { runForks } from './SubtreeForkRunner'",
        "test('ok', () => {",
        '  expect(runForks).toHaveBeenCalledTimes(2)',
        '})',
      ].join('\n'))
      writeFileSync(path.join(roots[1], 'violation.test.ts'), [
        "import { runForks } from './SubtreeForkRunner'",
        "test('bad', () => {",
        guardedRangeAssertion(),
        '})',
      ].join('\n'))
      writeFileSync(path.join(roots[2], 'also-violation.spec.tsx'), [
        "import { runForks } from './SubtreeForkRunner'",
        "test('bad', () => {",
        guardedRangeAssertion('runForks', 'toBeLessThanOrEqual'),
        '})',
      ].join('\n'))

      const {exitCode, stderr} = runScanner(...roots)
      assert.equal(exitCode, 1)
      assert.match(stderr, /violation\.test\.ts/)
      assert.match(stderr, /also-violation\.spec\.tsx/)
      assert.match(stderr, /2 range-assertion violation\(s\) found/)
    })
  })

  test('multiple clean roots pass together', () => {
    withTempDir(dir => {
      const roots = ['root-a', 'root-b'].map(root => path.join(dir, root))
      roots.forEach(root => mkdirSync(root, {recursive: true}))
      writeFileSync(path.join(roots[0], 'clean.test.js'), [
        "import { runForks } from './SubtreeForkRunner'",
        "test('ok', () => {",
        '  expect(runForks).toHaveBeenCalledTimes(2)',
        '})',
      ].join('\n'))
      writeFileSync(path.join(roots[1], 'unrelated.test.ts'), [
        "import { runForks } from './ordinaryRunner'",
        "test('ok', () => {",
        guardedRangeAssertion(),
        '})',
      ].join('\n'))

      const {exitCode, stderr} = runScanner(...roots)
      assert.equal(exitCode, 0, stderr)
    })
  })
})

describe('violation reporting', () => {
  test('reports the correct total when one file contains multiple violations', () => {
    assertViolation([
      "import { runForks } from './SubtreeForkRunner'",
      "import { readCommodityN } from './commodityParams'",
      "test('bad1', () => { expect(runForks.mock.calls.length).toBeGreaterThan(0) })",
      "test('bad2', () => { expect(readCommodityN).toBeLessThan(10) })",
      "test('bad3', () => { expect(runForks.mock.instances.length).toBeGreaterThanOrEqual(1) })",
    ], /3 range-assertion violation\(s\) found/)
  })

  test('reports violations across multiple files', () => {
    withTempDir(dir => {
      write(dir, 'a.test.js', [
        "import { runForks } from './SubtreeForkRunner'",
        "test('bad', () => { expect(runForks.mock.calls.length).toBeGreaterThan(0) })",
      ])
      write(dir, 'b.test.ts', [
        "import { readCommodityN } from './commodityParams'",
        "test('bad', () => { expect(readCommodityN).toBeLessThan(10) })",
      ])
      const {exitCode, stderr} = runScanner(dir)
      assert.equal(exitCode, 1)
      assert.match(stderr, /a\.test\.js/)
      assert.match(stderr, /b\.test\.ts/)
    })
  })

  test('does not report clean files beside violating files', () => {
    withTempDir(dir => {
      write(dir, 'clean.test.js', [
        "import { runForks } from './SubtreeForkRunner'",
        "test('ok', () => { expect(runForks).toHaveBeenCalledTimes(3) })",
      ])
      write(dir, 'bad.test.js', [
        "import { runForks } from './SubtreeForkRunner'",
        "test('bad', () => { expect(runForks.mock.calls.length).toBeGreaterThan(0) })",
      ])
      const {exitCode, stderr} = runScanner(dir)
      assert.equal(exitCode, 1)
      assert.match(stderr, /bad\.test\.js/)
      assert.doesNotMatch(stderr, /clean\.test\.js/)
    })
  })
})

describe('local guarded value aliases', () => {
  for (const declarationKind of ['const', 'let', 'var']) {
    test(`fires when a guarded count is stored in a ${declarationKind} alias`, () => {
      assertViolation([
        "import { runForks } from './SubtreeForkRunner'",
        "test('alias is caught', () => {",
        `  ${declarationKind} callCount = runForks.mock.calls.length`,
        '  expect(callCount).toBeGreaterThanOrEqual(2)',
        '})',
      ], /RANGE-VIOLATION: fixture\.test\.js:4/)
    })
  }

  test('fires when a guarded count flows through chained local aliases', () => {
    assertViolation([
      "import { runForks } from './SubtreeForkRunner'",
      "test('alias chain is caught', () => {",
      '  const callCount = runForks.mock.calls.length',
      '  const observedCount = callCount',
      '  expect(observedCount).toBeLessThanOrEqual(5)',
      '})',
    ], /RANGE-VIOLATION: fixture\.test\.js:5/)
  })

  test('allows range assertions on aliases derived from unrelated values', () => {
    assertClean([
      "import { runForks } from './SubtreeForkRunner'",
      "test('unrelated alias is clean', () => {",
      '  const itemCount = unrelatedItems.length',
      '  expect(itemCount).toBeGreaterThanOrEqual(2)',
      '  expect(runForks).toHaveBeenCalledTimes(2)',
      '})',
    ])
  })
})

describe('clean boundaries', () => {
  test('allows range matchers when no guarded imports are present', () => {
    assertClean([
      "import { something } from './unrelated'",
      "test('ok', () => {",
      '  expect(items.length).toBeGreaterThan(0)',
      '})',
    ])
  })

  test('ignores commented-out range assertions', () => {
    assertClean([
      "import { runForks } from './SubtreeForkRunner'",
      "test('ok', () => {",
      '  // expect(runForks.mock.calls.length).toBeGreaterThan(0)',
      '  expect(runForks).toHaveBeenCalledTimes(1)',
      '})',
    ])
  })

  test('passes when scanned directory is empty', () => {
    withTempDir(dir => {
      const {exitCode} = runScanner(dir)
      assert.equal(exitCode, 0)
    })
  })
})
