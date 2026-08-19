import fs from 'fs'
import path from 'path'
import {
  buildReliabilityMetadata,
  buildDiscardedFork,
  buildJudgeInputMetadata,
  buildJudgeQualityWarning,
  buildPerCriterionVerdictEntry,
  buildForkRankingEntry,
  buildValidateRetryWithheldReliabilityMetadata,
} from './reliabilityMetadataFields'

const FIXTURE_PATH = path.resolve(
  __dirname,
  '../../../../../../backend-v2/internal/modules/workflow/testdata/reliability_metadata_maximal.json',
)

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'))

// Arrays use only their first element — shape matters, not element count.
function collectKeyPaths(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object') return []
  if (Array.isArray(obj)) {
    if (obj.length === 0) return []
    return collectKeyPaths(obj[0], `${prefix}[0]`)
  }
  return Object.entries(obj).flatMap(([k, v]) => {
    const kPath = prefix ? `${prefix}.${k}` : k
    return [kPath, ...collectKeyPaths(v, kPath)]
  })
}

function sortedKeyPaths(obj) {
  return collectKeyPaths(obj).sort()
}

function makeSentinelProxy(base, tag) {
  return new Proxy(base, {
    get(target, prop) {
      if (typeof prop !== 'string') return undefined
      const v = target[prop]
      return v !== undefined ? v : `__sentinel_${tag}_${prop}`
    },
  })
}

function sourceFilesMatching(dir, pattern) {
  const results = []
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      results.push(...sourceFilesMatching(fullPath, pattern))
    } else if (entry.isFile() && entry.name.endsWith('.js') && !entry.name.endsWith('.test.js')) {
      if (pattern.test(fs.readFileSync(fullPath, 'utf8'))) results.push(fullPath)
    }
  }
  return results
}

const maximalVerdict = {
  winnerForkIndex: 0,
  perCriterionVerdict: [
    {
      criterionId: 'v1',
      criterion: 'must include revenue numbers',
      forkRankings: [
        {forkIndex: 0, rank: 1},
        {forkIndex: 1, rank: 2},
      ],
    },
  ],
  mode: 'strict',
  selectionLayer: 'fallback',
  noSignal: false,
  tiebreakUsed: true,
  judgeInput: {
    candidateCount: 2,
    perForkBudgetChars: 5000,
    degradedInput: false,
    resolvedJudgeFamilies: ['openai'],
  },
  judgeQualityWarnings: [{condition: 'singleProvider', severity: 'high'}],
  failureCause: 'structural-gate',
  remediationHint: 'revise-prompt',
  allGateFiltered: true,
  suppressed: true,
  cause: 'side-effecting-alias',
  requestedN: 3,
  generatorOnlyJudge: true,
  judgeReasoningRequested: true,
  retryWithheld: true,
  requestedRetry: 2,
}

const maximalLoserFork = {
  forkIndex: 1,
  status: 'criteria-failed',
  failedAt: 'must include revenue numbers',
  reason: 'context deadline exceeded',
  attempts: 3,
}

describe('reliabilityMetadata field-set contract', () => {
  describe('maximal engine output matches the declared fixture shape (both directions)', () => {
    it('buildReliabilityMetadata with all fields populated produces exactly the fixture key-path set', () => {
      const forkResults = [
        {
          forkIndex: 0,
          status: 'ok',
          suppressed: true,
          cause: 'side-effecting-alias',
          requestedN: 3,
        },
        maximalLoserFork,
      ]
      const raw = buildReliabilityMetadata(maximalVerdict, forkResults, 1, 2)
      expect(sortedKeyPaths(JSON.parse(JSON.stringify(raw)))).toEqual(sortedKeyPaths(fixture))
    })

    it('buildDiscardedFork with all optional fields populated produces exactly the fixture discardedForks[0] key set', () => {
      expect(Object.keys(buildDiscardedFork(maximalLoserFork)).sort()).toEqual(
        Object.keys(fixture.discardedForks[0]).sort(),
      )
    })

    it('buildReliabilityMetadata emits exactly the fixture fields even when verdict properties are absent (sentinel-proxy confirms no new field escapes persistence)', () => {
      const verdictProxy = makeSentinelProxy(maximalVerdict, 'verdict')
      const loserForkProxy = makeSentinelProxy(maximalLoserFork, 'fork')
      const forkResults = [{forkIndex: 0, status: 'ok'}, loserForkProxy]
      const raw = buildReliabilityMetadata(verdictProxy, forkResults, 1, 2)
      expect(sortedKeyPaths(JSON.parse(JSON.stringify(raw)))).toEqual(sortedKeyPaths(fixture))
    })

    it('buildDiscardedFork emits exactly the fixture discardedForks[0] fields even when fork properties are absent (sentinel-proxy confirms no new field escapes persistence)', () => {
      const loserForkProxy = makeSentinelProxy(maximalLoserFork, 'fork')
      expect(Object.keys(buildDiscardedFork(loserForkProxy)).sort()).toEqual(
        Object.keys(fixture.discardedForks[0]).sort(),
      )
    })
  })

  describe('fixture is internally consistent as a contract artifact', () => {
    it('fixture top-level key set matches the Go ReliabilityMetadata field names', () => {
      expect(Object.keys(fixture).sort()).toEqual([
        'allGateFiltered',
        'cause',
        'discardedForks',
        'eligible',
        'failureCause',
        'fallbackUsed',
        'generatorOnlyJudge',
        'judgeInput',
        'judgeQualityWarnings',
        'judgeReasoningRequested',
        'mode',
        'noSignal',
        'perCriterionVerdict',
        'remediationHint',
        'requestedN',
        'requestedRetry',
        'retryWithheld',
        'selectionLayer',
        'suppressed',
        'tiebreakUsed',
        'total',
        'winnerForkIndex',
      ])
    })

    it('fixture discardedForks[0] contains all declared DiscardedFork optional fields', () => {
      const df = fixture.discardedForks[0]
      expect(df).toHaveProperty('failedAt')
      expect(df).toHaveProperty('reason')
      expect(df).toHaveProperty('attempts')
    })
  })
})

describe('reliabilityMetadata construction chokepoint', () => {
  it('no production source file constructs reliabilityMetadata via object literal outside reliabilityMetadataFields.js', () => {
    const commandExecutorRoot = path.resolve(__dirname, '../..')
    const directObjectLiteral = /\.reliabilityMetadata\s*=\s*\{/
    const violators = sourceFilesMatching(commandExecutorRoot, directObjectLiteral).filter(
      f => !f.endsWith('reliabilityMetadataFields.js'),
    )
    expect(violators).toEqual([])
  })
})

describe('nested builder field-set contract — sentinel-proxy confirms no sub-field escapes persistence', () => {
  it('buildJudgeInputMetadata emits exactly the fixture.judgeInput fields', () => {
    const inputProxy = makeSentinelProxy(
      {
        candidateCount: 2,
        perForkBudget: 5000,
        resolvedModels: [{judgeFamily: 'openai'}],
      },
      'diag',
    )
    const result = buildJudgeInputMetadata(inputProxy)
    expect(Object.keys(result).sort()).toEqual(Object.keys(fixture.judgeInput).sort())
  })

  it('buildJudgeQualityWarning emits exactly the fixture.judgeQualityWarnings[0] fields', () => {
    const inputProxy = makeSentinelProxy({condition: 'singleProvider', severity: 'high'}, 'warning')
    const result = buildJudgeQualityWarning(inputProxy)
    expect(Object.keys(result).sort()).toEqual(Object.keys(fixture.judgeQualityWarnings[0]).sort())
  })

  it('buildPerCriterionVerdictEntry emits exactly the fixture.perCriterionVerdict[0] fields', () => {
    const inputProxy = makeSentinelProxy(
      {
        criterionId: 'v1',
        criterion: 'must include revenue numbers',
        forkRankings: [{forkIndex: 0, rank: 1}],
      },
      'pvcEntry',
    )
    const result = buildPerCriterionVerdictEntry(inputProxy)
    expect(Object.keys(result).sort()).toEqual(Object.keys(fixture.perCriterionVerdict[0]).sort())
  })

  it('buildForkRankingEntry emits exactly the fixture.perCriterionVerdict[0].forkRankings[0] fields', () => {
    const inputProxy = makeSentinelProxy({forkIndex: 0, rank: 1}, 'ranking')
    const result = buildForkRankingEntry(inputProxy)
    expect(Object.keys(result).sort()).toEqual(Object.keys(fixture.perCriterionVerdict[0].forkRankings[0]).sort())
  })
})

describe('nested builder construction chokepoints', () => {
  it('no production source file constructs judgeInput via object literal outside reliabilityMetadataFields.js', () => {
    const commandExecutorRoot = path.resolve(__dirname, '../..')
    const directObjectLiteral = /perForkBudgetChars\s*:/
    const violators = sourceFilesMatching(commandExecutorRoot, directObjectLiteral).filter(
      f => !f.endsWith('reliabilityMetadataFields.js'),
    )
    expect(violators).toEqual([])
  })
})

describe('validate retry-withheld metadata builder', () => {
  it('emits the persisted retry-withheld signal shape', () => {
    expect(
      buildValidateRetryWithheldReliabilityMetadata({
        cause: 'side-effecting-alias',
        requestedRetry: 2,
        passedCount: 0,
        total: 1,
      }),
    ).toEqual(
      expect.objectContaining({
        mode: 'invalid',
        retryWithheld: true,
        cause: 'side-effecting-alias',
        requestedRetry: 2,
        failureCause: 'criteria-failed',
      }),
    )
  })
})
