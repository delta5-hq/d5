import { test, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  COMPLETION_SUFFIX_RE,
  COMMODITY_FULL_SUCCESS_SUFFIX_RE,
  COMMODITY_OUTCOME_SUFFIX_RE,
  VALIDATE_VERDICT_RE,
  VALIDATE_FAIL_RE,
  ELECT_FALLBACK_SUFFIX_RE,
} from './suffix-patterns'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

type SuffixGrammarShapes = { engineSuffixShapes: string[] }

const BACKEND_SHAPES: SuffixGrammarShapes = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../backend/src/controllers/commandExecutor/reliability/core/suffixGrammarShapes.json'),
    'utf8',
  ),
)

// Adding a new engine shape to the backend requires a matching case below.
const ENGINE_OUTPUT_WITH_COMPLETION_SYMBOL: [string, string][] = [
  ['commodity/elect all K of N succeeded',              'Task [✓ 2/3]'],
  ['commodity/elect partial with degraded judge input',  'Task [✓ 2/3 ⚠]'],
  ['validate passed after N retries',                    'Task [✓ +2]'],
  ['validate passed on first attempt',                   'Task [✓]'],
  ['commodity/elect zero of N eligible',                'Task [✗ 0/3]'],
  ['validate all retries exhausted',                     'Task [✗ 3×]'],
  ['validate retry withheld on side-effecting command',  'Task [✗ ⊘]'],
  ['validate invalid criterion',                         'Task [✗ !]'],
]

const ENGINE_OUTPUT_WARNING_ONLY: [string, string][] = [
  ['elect no judge signal in strict mode',  'Task [⚠ ∅]'],
  ['elect fallback winner committed',        'Task [⚠ 0/3]'],
]

// ─── Parity with canonical backend grammar ────────────────────────────────────

test.describe('canonical engine shape count parity', () => {
  test('ENGINE_OUTPUT_WITH_COMPLETION_SYMBOL covers every ✓/✗ engine shape', () => {
    const completionShapeCount = BACKEND_SHAPES.engineSuffixShapes.filter(
      s => s.startsWith('✓') || s.startsWith('✗'),
    ).length
    expect(ENGINE_OUTPUT_WITH_COMPLETION_SYMBOL).toHaveLength(completionShapeCount)
  })

  test('ENGINE_OUTPUT_WARNING_ONLY covers every ⚠ engine shape', () => {
    const warningShapeCount = BACKEND_SHAPES.engineSuffixShapes.filter(s => s.startsWith('⚠')).length
    expect(ENGINE_OUTPUT_WARNING_ONLY).toHaveLength(warningShapeCount)
  })
})

// ─── COMPLETION_SUFFIX_RE ────────────────────────────────────────────────────

test.describe('COMPLETION_SUFFIX_RE — broad execution-gate detector', () => {
  for (const [label, title] of ENGINE_OUTPUT_WITH_COMPLETION_SYMBOL) {
    test(`matches ${label}`, () => {
      expect(title).toMatch(COMPLETION_SUFFIX_RE)
    })
  }

  for (const [label, title] of ENGINE_OUTPUT_WARNING_ONLY) {
    test(`does not match ⚠-only shape: ${label}`, () => {
      expect(title).not.toMatch(COMPLETION_SUFFIX_RE)
    })
  }

  test('does not match a plain user bracket with no completion symbol', () => {
    expect('Task [review pending]').not.toMatch(COMPLETION_SUFFIX_RE)
  })
})

// ─── COMMODITY_FULL_SUCCESS_SUFFIX_RE ─────────────────────────────────────────

test.describe('COMMODITY_FULL_SUCCESS_SUFFIX_RE — exact K=N all-succeeded form', () => {
  for (const n of [1, 2, 3, 5]) {
    test(`matches [✓ ${n}/${n}] for n=${n}`, () => {
      expect(`Task [✓ ${n}/${n}]`).toMatch(COMMODITY_FULL_SUCCESS_SUFFIX_RE(n))
    })
  }

  test('does not match partial success [✓ 1/2] for n=2', () => {
    expect('Task [✓ 1/2]').not.toMatch(COMMODITY_FULL_SUCCESS_SUFFIX_RE(2))
  })

  test('does not match mismatched total [✓ 3/3] for n=2', () => {
    expect('Task [✓ 3/3]').not.toMatch(COMMODITY_FULL_SUCCESS_SUFFIX_RE(2))
  })

  test('does not match degraded form [✓ 2/2 ⚠] — warning state is not clean full success', () => {
    expect('Task [✓ 2/2 ⚠]').not.toMatch(COMMODITY_FULL_SUCCESS_SUFFIX_RE(2))
  })
})

// ─── COMMODITY_OUTCOME_SUFFIX_RE ──────────────────────────────────────────────

test.describe('COMMODITY_OUTCOME_SUFFIX_RE — fraction reporting for commodity/elect nodes', () => {
  const matchCases: [string, string][] = [
    ['all succeeded',           'Task [✓ 3/3]'],
    ['partial success',         'Task [✓ 1/3]'],
    ['all failed',              'Task [✗ 0/3]'],
    ['partial with warning',    'Task [✓ 2/3 ⚠]'],
  ]

  const rejectCases: [string, string][] = [
    ['validate pass (no fraction)',       'Task [✓]'],
    ['validate retry pass (no fraction)', 'Task [✓ +2]'],
    ['validate all retries exhausted',    'Task [✗ 3×]'],
    ['validate invalid criterion',        'Task [✗ !]'],
    ['elect fallback (⚠ symbol)',         'Task [⚠ 0/3]'],
  ]

  for (const [label, title] of matchCases) {
    test(`matches ${label}: "${title}"`, () => {
      expect(title).toMatch(COMMODITY_OUTCOME_SUFFIX_RE)
    })
  }

  for (const [label, title] of rejectCases) {
    test(`does not match ${label}: "${title}"`, () => {
      expect(title).not.toMatch(COMMODITY_OUTCOME_SUFFIX_RE)
    })
  }

  test('extracts successCount and total as capture groups from [✓ 2/3]', () => {
    const match = 'Task [✓ 2/3]'.match(COMMODITY_OUTCOME_SUFFIX_RE)
    expect(match).not.toBeNull()
    expect(match![2]).toBe('2')
    expect(match![3]).toBe('3')
  })

  test('extracts zero successCount from [✗ 0/5] and status symbol ✗', () => {
    const match = 'Task [✗ 0/5]'.match(COMMODITY_OUTCOME_SUFFIX_RE)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('✗')
    expect(match![2]).toBe('0')
    expect(match![3]).toBe('5')
  })

  test('extracts groups from degraded form [✓ 2/3 ⚠] — warning flag does not disturb fraction capture', () => {
    const match = 'Task [✓ 2/3 ⚠]'.match(COMMODITY_OUTCOME_SUFFIX_RE)
    expect(match).not.toBeNull()
    expect(match![1]).toBe('✓')
    expect(match![2]).toBe('2')
    expect(match![3]).toBe('3')
  })
})

// ─── VALIDATE_VERDICT_RE ──────────────────────────────────────────────────────

test.describe('VALIDATE_VERDICT_RE — any validate outcome (pass or fail)', () => {
  const matchCases: [string, string][] = [
    ['pass on first attempt',  'Task [✓]'],
    ['pass after retries',     'Task [✓ +3]'],
    ['all retries exhausted',  'Task [✗ 3×]'],
  ]

  const rejectCases: [string, string][] = [
    ['commodity fraction',     'Task [✓ 2/3]'],
    ['commodity zero',         'Task [✗ 0/3]'],
    ['invalid criterion',      'Task [✗ !]'],
    ['elect fallback',        'Task [⚠ 0/3]'],
    ['no judge signal',        'Task [⚠ ∅]'],
  ]

  for (const [label, title] of matchCases) {
    test(`matches ${label}: "${title}"`, () => {
      expect(title).toMatch(VALIDATE_VERDICT_RE)
    })
  }

  for (const [label, title] of rejectCases) {
    test(`does not match ${label}: "${title}"`, () => {
      expect(title).not.toMatch(VALIDATE_VERDICT_RE)
    })
  }
})

// ─── VALIDATE_FAIL_RE ─────────────────────────────────────────────────────────

test.describe('VALIDATE_FAIL_RE — validate failure only (all retries exhausted)', () => {
  test('matches all-retries-exhausted form [✗ 3×]', () => {
    expect('Task [✗ 3×]').toMatch(VALIDATE_FAIL_RE)
  })

  test('matches single-retry-exhausted form [✗ 1×]', () => {
    expect('Task [✗ 1×]').toMatch(VALIDATE_FAIL_RE)
  })

  test('does not match validate pass on first attempt [✓]', () => {
    expect('Task [✓]').not.toMatch(VALIDATE_FAIL_RE)
  })

  test('does not match validate retry pass [✓ +2]', () => {
    expect('Task [✓ +2]').not.toMatch(VALIDATE_FAIL_RE)
  })

  test('does not match commodity failure [✗ 0/3]', () => {
    expect('Task [✗ 0/3]').not.toMatch(VALIDATE_FAIL_RE)
  })

  test('does not match invalid criterion [✗ !]', () => {
    expect('Task [✗ !]').not.toMatch(VALIDATE_FAIL_RE)
  })
})

// ─── ELECT_FALLBACK_SUFFIX_RE ────────────────────────────────────────────────

test.describe('ELECT_FALLBACK_SUFFIX_RE — elect committed a fallback winner when all forks failed', () => {
  test('matches [⚠ 0/3] — zero of N forks met criteria, fallback committed', () => {
    expect('Task [⚠ 0/3]').toMatch(ELECT_FALLBACK_SUFFIX_RE)
  })

  test('matches single-fork fallback [⚠ 0/1]', () => {
    expect('Task [⚠ 0/1]').toMatch(ELECT_FALLBACK_SUFFIX_RE)
  })

  test('does not match no-judge-signal form [⚠ ∅]', () => {
    expect('Task [⚠ ∅]').not.toMatch(ELECT_FALLBACK_SUFFIX_RE)
  })

  test('does not match a non-zero eligible fraction — only 0/N is a fallback', () => {
    expect('Task [⚠ 1/3]').not.toMatch(ELECT_FALLBACK_SUFFIX_RE)
  })

  test('does not match commodity success [✓ 2/3]', () => {
    expect('Task [✓ 2/3]').not.toMatch(ELECT_FALLBACK_SUFFIX_RE)
  })
})

// ─── VALIDATE_FAIL_RE is a strict subset of VALIDATE_VERDICT_RE ──────────────

test.describe('VALIDATE_FAIL_RE is a strict subset of VALIDATE_VERDICT_RE', () => {
  const FAIL_CASES = ['Task [✗ 1×]', 'Task [✗ 3×]']

  for (const title of FAIL_CASES) {
    test(`"${title}" matches VALIDATE_FAIL_RE and therefore also VALIDATE_VERDICT_RE`, () => {
      expect(title).toMatch(VALIDATE_FAIL_RE)
      expect(title).toMatch(VALIDATE_VERDICT_RE)
    })
  }
})

// ─── Invalid criterion [✗ !] — matched by COMPLETION_SUFFIX_RE only ──────────

test.describe('invalid criterion [✗ !] — matched by COMPLETION_SUFFIX_RE only, not by any categorizing regex', () => {
  const INVALID_CRITERION = 'Task [✗ !]'

  test('matches COMPLETION_SUFFIX_RE — execution did complete, result was an invalid criterion error', () => {
    expect(INVALID_CRITERION).toMatch(COMPLETION_SUFFIX_RE)
  })

  test('does not match COMMODITY_OUTCOME_SUFFIX_RE — no fraction N/M produced', () => {
    expect(INVALID_CRITERION).not.toMatch(COMMODITY_OUTCOME_SUFFIX_RE)
  })

  test('does not match VALIDATE_VERDICT_RE — not a retried-pass or retry-exhausted outcome', () => {
    expect(INVALID_CRITERION).not.toMatch(VALIDATE_VERDICT_RE)
  })

  test('does not match VALIDATE_FAIL_RE — retry count N× form is absent', () => {
    expect(INVALID_CRITERION).not.toMatch(VALIDATE_FAIL_RE)
  })
})
