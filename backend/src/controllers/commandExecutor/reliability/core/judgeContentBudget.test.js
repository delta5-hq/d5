import {
  computePerForkContentBudget,
  computePerForkContentBudgetFromResolvedModels,
  isDegradedInput,
  MAX_PER_FORK_CHARS,
  DEGRADED_INPUT_THRESHOLD_CHARS,
} from './judgeContentBudget'

jest.mock('../../commands/utils/langchain/getLLM', () => ({
  Model: {
    Claude: 'Claude',
    OpenAI: 'OpenAI',
    Deepseek: 'Deepseek',
    Qwen: 'Qwen',
    YandexGPT: 'YandexGPT',
    CustomLLM: 'CustomLLM',
  },
}))

const {Model} = require('../../commands/utils/langchain/getLLM')

describe('computePerForkContentBudget', () => {
  describe('degenerate nForks inputs', () => {
    it('nForks=0 returns MAX_PER_FORK_CHARS', () => {
      expect(computePerForkContentBudget(0, [Model.OpenAI])).toBe(MAX_PER_FORK_CHARS)
    })

    it('nForks<0 treated as nForks=0: returns MAX_PER_FORK_CHARS', () => {
      expect(computePerForkContentBudget(-1, [Model.OpenAI])).toBe(MAX_PER_FORK_CHARS)
    })

    it('nForks=1 allocates the full capped budget (no splitting)', () => {
      expect(computePerForkContentBudget(1, [Model.Claude])).toBe(MAX_PER_FORK_CHARS)
    })
  })

  describe('degenerate family inputs', () => {
    it('empty configuredFamilies falls back to the conservative fallback window', () => {
      const budget = computePerForkContentBudget(1, [])
      expect(budget).toBeGreaterThan(0)
      expect(budget).toBeLessThanOrEqual(MAX_PER_FORK_CHARS)
    })

    it('unknown family key uses same fallback as empty families (consistent fallback path)', () => {
      const budgetUnknown = computePerForkContentBudget(2, ['UnknownProvider'])
      const budgetEmpty = computePerForkContentBudget(2, [])
      expect(budgetUnknown).toBe(budgetEmpty)
    })

    it('multiple unknown families treated the same as a single unknown family', () => {
      const budgetOne = computePerForkContentBudget(3, ['UnknownA'])
      const budgetTwo = computePerForkContentBudget(3, ['UnknownA', 'UnknownB'])
      expect(budgetOne).toBe(budgetTwo)
    })
  })

  describe('floor guarantee', () => {
    it('result is always at least MIN_CHARS_FLOOR regardless of nForks', () => {
      const budget = computePerForkContentBudget(100_000, [Model.YandexGPT])
      expect(budget).toBeGreaterThanOrEqual(50)
    })
  })

  describe('ceiling guarantee', () => {
    it('result never exceeds MAX_PER_FORK_CHARS even for nForks=1 with the largest context family', () => {
      expect(computePerForkContentBudget(1, [Model.Claude])).toBe(MAX_PER_FORK_CHARS)
    })

    it('result never exceeds MAX_PER_FORK_CHARS for any configured family', () => {
      for (const family of [Model.Claude, Model.OpenAI, Model.Deepseek]) {
        expect(computePerForkContentBudget(1, [family])).toBeLessThanOrEqual(MAX_PER_FORK_CHARS)
      }
    })
  })

  describe('budget ordering reflects context window size', () => {
    it('larger context window produces larger per-fork budget at the same nForks', () => {
      const nForks = 50
      const claude = computePerForkContentBudget(nForks, [Model.Claude])
      const deepseek = computePerForkContentBudget(nForks, [Model.Deepseek])
      const qwen = computePerForkContentBudget(nForks, [Model.Qwen])
      const yandex = computePerForkContentBudget(nForks, [Model.YandexGPT])
      expect(claude).toBeGreaterThan(deepseek)
      expect(deepseek).toBeGreaterThan(qwen)
      expect(qwen).toBeGreaterThan(yandex)
    })

    it('constrained family determines budget when mixed with larger families', () => {
      const mixedBudget = computePerForkContentBudget(2, [Model.Claude, Model.YandexGPT])
      const yandexOnlyBudget = computePerForkContentBudget(2, [Model.YandexGPT])
      expect(mixedBudget).toBe(yandexOnlyBudget)
    })
  })

  describe('large-context families give generous per-fork budget', () => {
    it.each([
      [Model.Claude, 2],
      [Model.OpenAI, 2],
      [Model.Claude, 10],
    ])('%s with nForks=%d stays well above degraded threshold', (family, nForks) => {
      const budget = computePerForkContentBudget(nForks, [family])
      expect(budget).toBeGreaterThan(DEGRADED_INPUT_THRESHOLD_CHARS)
    })
  })

  describe('budget decreases monotonically as nForks grows', () => {
    it('budget strictly decreases across a range of fork counts for a constrained family', () => {
      const forkCounts = [2, 5, 20, 100]
      const budgets = forkCounts.map(n => computePerForkContentBudget(n, [Model.YandexGPT]))
      for (let i = 1; i < budgets.length; i++) {
        expect(budgets[i]).toBeLessThan(budgets[i - 1])
      }
    })

    it('budget is non-increasing across a range of fork counts for a large-context family', () => {
      const forkCounts = [1, 2, 5, 10]
      const budgets = forkCounts.map(n => computePerForkContentBudget(n, [Model.Claude]))
      for (let i = 1; i < budgets.length; i++) {
        expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1])
      }
    })
  })
})

describe('isDegradedInput', () => {
  it('returns false when budget is above the threshold', () => {
    expect(isDegradedInput(DEGRADED_INPUT_THRESHOLD_CHARS + 1)).toBe(false)
  })

  it('returns false for very large budget values (well above threshold)', () => {
    expect(isDegradedInput(MAX_PER_FORK_CHARS)).toBe(false)
  })

  it('returns true when budget equals the threshold (boundary is inclusive)', () => {
    expect(isDegradedInput(DEGRADED_INPUT_THRESHOLD_CHARS)).toBe(true)
  })

  it('returns true when budget is below the threshold', () => {
    expect(isDegradedInput(DEGRADED_INPUT_THRESHOLD_CHARS - 1)).toBe(true)
  })

  it('returns true for zero budget (no content is always degraded)', () => {
    expect(isDegradedInput(0)).toBe(true)
  })

  it('returns true for the floor budget produced at very high fork count (always degraded)', () => {
    expect(isDegradedInput(computePerForkContentBudget(100_000, [Model.YandexGPT]))).toBe(true)
  })
})

describe('computePerForkContentBudgetFromResolvedModels', () => {
  it('budget is determined by the smallest positive chunkSize among resolved models', () => {
    const smallChunkSize = 8_000
    const largeChunkSize = 200_000
    const budgetWithMix = computePerForkContentBudgetFromResolvedModels(2, [
      {chunkSize: largeChunkSize},
      {chunkSize: smallChunkSize},
    ])
    const budgetWithSmallOnly = computePerForkContentBudgetFromResolvedModels(2, [{chunkSize: smallChunkSize}])
    expect(budgetWithMix).toBe(budgetWithSmallOnly)
  })

  it('large resolved context window allows large N without family-level under-allocation', () => {
    const resolvedBudget = computePerForkContentBudgetFromResolvedModels(50, [{chunkSize: 200_000}])
    const familyFallbackBudget = computePerForkContentBudget(50, [Model.YandexGPT])

    expect(resolvedBudget).toBeGreaterThan(DEGRADED_INPUT_THRESHOLD_CHARS)
    expect(resolvedBudget).toBeGreaterThan(familyFallbackBudget)
  })

  it('small resolved context window produces degraded budget even for a nominally large-context family', () => {
    const budget = computePerForkContentBudgetFromResolvedModels(10, [{chunkSize: 2_000}])

    expect(isDegradedInput(budget)).toBe(true)
  })

  it('falls back safely when no resolved model has a positive finite chunkSize', () => {
    const budget = computePerForkContentBudgetFromResolvedModels(2, [
      {chunkSize: 0},
      {chunkSize: -1},
      {chunkSize: Number.NaN},
      {},
    ])

    expect(budget).toBe(computePerForkContentBudget(2, []))
  })

  it('Infinity chunkSize is filtered as non-finite and falls back to the conservative default', () => {
    const budget = computePerForkContentBudgetFromResolvedModels(2, [{chunkSize: Infinity}])

    expect(budget).toBe(computePerForkContentBudget(2, []))
  })

  it('null and undefined resolvedModels are treated as empty and fall back to the conservative default', () => {
    expect(computePerForkContentBudgetFromResolvedModels(2, null)).toBe(computePerForkContentBudget(2, []))
    expect(computePerForkContentBudgetFromResolvedModels(2, undefined)).toBe(computePerForkContentBudget(2, []))
  })

  it('Infinity chunkSize mixed with valid chunkSizes — only valid sizes contribute to the minimum', () => {
    const budget = computePerForkContentBudgetFromResolvedModels(2, [{chunkSize: Infinity}, {chunkSize: 8_000}])

    expect(budget).toBe(computePerForkContentBudgetFromResolvedModels(2, [{chunkSize: 8_000}]))
  })

  describe('degenerate nForks inputs mirror the family-based function', () => {
    it('nForks=0 returns MAX_PER_FORK_CHARS regardless of resolved model chunkSize', () => {
      expect(computePerForkContentBudgetFromResolvedModels(0, [{chunkSize: 8_000}])).toBe(MAX_PER_FORK_CHARS)
    })

    it('nForks=1 allocates the full capped budget for any positive chunkSize', () => {
      expect(computePerForkContentBudgetFromResolvedModels(1, [{chunkSize: 200_000}])).toBe(MAX_PER_FORK_CHARS)
      expect(computePerForkContentBudgetFromResolvedModels(1, [{chunkSize: 8_000}])).toBe(MAX_PER_FORK_CHARS)
    })

    it('nForks<0 treated as nForks=0: returns MAX_PER_FORK_CHARS', () => {
      expect(computePerForkContentBudgetFromResolvedModels(-1, [{chunkSize: 8_000}])).toBe(MAX_PER_FORK_CHARS)
    })
  })

  describe('degenerate model list inputs', () => {
    it('empty resolvedModels array falls back to the conservative default — identical to null', () => {
      expect(computePerForkContentBudgetFromResolvedModels(2, [])).toBe(computePerForkContentBudget(2, []))
    })
  })

  describe('budget decreases monotonically as nForks grows for a given chunkSize', () => {
    it('budget is non-increasing across a range of fork counts for a fixed chunkSize', () => {
      const forkCounts = [2, 5, 20, 100]
      const budgets = forkCounts.map(n => computePerForkContentBudgetFromResolvedModels(n, [{chunkSize: 32_000}]))
      for (let i = 1; i < budgets.length; i++) {
        expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1])
      }
    })

    it('very small chunkSize produces monotonically decreasing budget', () => {
      const forkCounts = [2, 5, 20]
      const budgets = forkCounts.map(n => computePerForkContentBudgetFromResolvedModels(n, [{chunkSize: 4_000}]))
      for (let i = 1; i < budgets.length; i++) {
        expect(budgets[i]).toBeLessThanOrEqual(budgets[i - 1])
      }
    })
  })
})
