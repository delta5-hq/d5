import {
  JUDGE_DEFAULT_ENSEMBLE,
  JUDGE_DEFAULT_SAMPLES,
  JUDGE_MAX_ENSEMBLE,
  JUDGE_MAX_SAMPLES,
  readJudgeEnsemble,
  readJudgeFamily,
  readJudgeOptions,
  readJudgeReasoning,
  readJudgeSamples,
} from './judgeOptions'

describe('readJudgeFamily', () => {
  describe('valid family names', () => {
    it.each([
      [':judge=claude', 'claude'],
      [':judge=openai', 'openai'],
      [':judge=deepseek', 'deepseek'],
      [':judge=qwen', 'qwen'],
      [':judge=yandex', 'yandex'],
      [':judge=custom_llm', 'custom_llm'],
    ])('extracts %s → %s', (input, expected) => {
      expect(readJudgeFamily(input)).toBe(expected)
    })

    it('normalises to lowercase', () => {
      expect(readJudgeFamily(':judge=Claude')).toBe('claude')
      expect(readJudgeFamily(':judge=OPENAI')).toBe('openai')
    })

    it('extracts from a command string with other params', () => {
      expect(readJudgeFamily('/chat :n=3 :judge=claude some prompt')).toBe('claude')
    })
  })

  describe('absent or invalid input', () => {
    it('returns null when :judge= not present', () => {
      expect(readJudgeFamily('/chat :n=3 some prompt')).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(readJudgeFamily('')).toBeNull()
    })

    it('returns null for null', () => {
      expect(readJudgeFamily(null)).toBeNull()
    })

    it('returns null for undefined', () => {
      expect(readJudgeFamily(undefined)).toBeNull()
    })

    it('returns null when :judge= is present but carries no value', () => {
      expect(readJudgeFamily(':judge=')).toBeNull()
    })
  })
})

describe('readJudgeReasoning', () => {
  it('returns true when :judge_reasoning=true present', () => {
    expect(readJudgeReasoning('/chat :n=2 :judge_reasoning=true')).toBe(true)
  })

  it('returns false when :judge_reasoning absent', () => {
    expect(readJudgeReasoning('/chat :n=2 prompt')).toBe(false)
  })

  it('returns false for :judge_reasoning=false (not the exact sentinel)', () => {
    expect(readJudgeReasoning(':judge_reasoning=false')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(readJudgeReasoning('')).toBe(false)
  })

  it('returns false for null', () => {
    expect(readJudgeReasoning(null)).toBe(false)
  })
})

describe('readJudgeSamples', () => {
  describe('valid values', () => {
    it('extracts :judge_samples=3', () => {
      expect(readJudgeSamples(':judge_samples=3')).toBe(3)
    })

    it('extracts from multi-param command string', () => {
      expect(readJudgeSamples('/chat :n=2 :judge_samples=2 prompt')).toBe(2)
    })
  })

  describe('boundaries', () => {
    it('clamps to JUDGE_MAX_SAMPLES', () => {
      expect(readJudgeSamples(`:judge_samples=${JUDGE_MAX_SAMPLES + 10}`)).toBe(JUDGE_MAX_SAMPLES)
    })

    it('treats 0 as default', () => {
      expect(readJudgeSamples(':judge_samples=0')).toBe(JUDGE_DEFAULT_SAMPLES)
    })

    it('returns default when absent', () => {
      expect(readJudgeSamples('/chat prompt')).toBe(JUDGE_DEFAULT_SAMPLES)
    })

    it('returns default for null', () => {
      expect(readJudgeSamples(null)).toBe(JUDGE_DEFAULT_SAMPLES)
    })

    it('accepts 1 as a valid lower bound', () => {
      expect(readJudgeSamples(':judge_samples=1')).toBe(1)
    })

    it('returns default for a negative value — the regex only captures unsigned integers', () => {
      expect(readJudgeSamples(':judge_samples=-1')).toBe(JUDGE_DEFAULT_SAMPLES)
    })

    it('returns default for a non-numeric value', () => {
      expect(readJudgeSamples(':judge_samples=abc')).toBe(JUDGE_DEFAULT_SAMPLES)
    })
  })
})

describe('readJudgeEnsemble', () => {
  describe('valid values', () => {
    it('extracts :judge_ensemble=2', () => {
      expect(readJudgeEnsemble(':judge_ensemble=2')).toBe(2)
    })

    it('extracts from multi-param command string', () => {
      expect(readJudgeEnsemble('/chat :n=3 :judge_ensemble=3 prompt')).toBe(3)
    })
  })

  describe('boundaries', () => {
    it('clamps to JUDGE_MAX_ENSEMBLE', () => {
      expect(readJudgeEnsemble(`:judge_ensemble=${JUDGE_MAX_ENSEMBLE + 10}`)).toBe(JUDGE_MAX_ENSEMBLE)
    })

    it('treats 0 as default', () => {
      expect(readJudgeEnsemble(':judge_ensemble=0')).toBe(JUDGE_DEFAULT_ENSEMBLE)
    })

    it('returns default when absent', () => {
      expect(readJudgeEnsemble('/chat prompt')).toBe(JUDGE_DEFAULT_ENSEMBLE)
    })

    it('returns default for null', () => {
      expect(readJudgeEnsemble(null)).toBe(JUDGE_DEFAULT_ENSEMBLE)
    })

    it('accepts 1 as a valid lower bound', () => {
      expect(readJudgeEnsemble(':judge_ensemble=1')).toBe(1)
    })

    it('returns default for a negative value — the regex only captures unsigned integers', () => {
      expect(readJudgeEnsemble(':judge_ensemble=-1')).toBe(JUDGE_DEFAULT_ENSEMBLE)
    })

    it('returns default for a non-numeric value', () => {
      expect(readJudgeEnsemble(':judge_ensemble=xyz')).toBe(JUDGE_DEFAULT_ENSEMBLE)
    })
  })
})

describe('readJudgeOptions', () => {
  it('returns all defaults when command has no judge params', () => {
    const opts = readJudgeOptions('/chat :n=3 some prompt')
    expect(opts).toEqual({
      judgeFamily: null,
      judgeReasoning: false,
      judgeSamples: JUDGE_DEFAULT_SAMPLES,
      judgeEnsemble: JUDGE_DEFAULT_ENSEMBLE,
    })
  })

  it('extracts all params from a fully annotated command string', () => {
    const opts = readJudgeOptions(
      '/chat :n=3 :judge=claude :judge_reasoning=true :judge_samples=3 :judge_ensemble=2 prompt',
    )
    expect(opts).toEqual({
      judgeFamily: 'claude',
      judgeReasoning: true,
      judgeSamples: 3,
      judgeEnsemble: 2,
    })
  })

  it('returns default ensemble=1 when :judge_ensemble absent', () => {
    expect(readJudgeOptions(':n=3').judgeEnsemble).toBe(1)
  })

  it('returns default samples=1 when :judge_samples absent', () => {
    expect(readJudgeOptions(':n=3').judgeSamples).toBe(1)
  })
})
