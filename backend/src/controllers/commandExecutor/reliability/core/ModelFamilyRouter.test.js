import {STRENGTH_TIERS, getConfiguredFamilies, selfJudgingGuard, selectJurors} from './ModelFamilyRouter'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const mkSettings = (...families) => {
  const s = {}
  for (const f of families) {
    if (f === 'OpenAI') s.openai = {apiKey: 'sk-test'}
    else if (f === 'Claude') s.claude = {apiKey: 'claude-test'}
    else if (f === 'Qwen') s.qwen = {apiKey: 'qwen-test'}
    else if (f === 'Deepseek') s.deepseek = {apiKey: 'ds-test'}
    else if (f === 'YandexGPT') s.yandex = {apiKey: 'ya-test'}
    else if (f === 'CustomLLM') s.custom_llm = {apiRootUrl: 'http://custom'}
  }
  return s
}

describe('STRENGTH_TIERS', () => {
  it('Claude and OpenAI are tier 1 (strongest)', () => {
    expect(STRENGTH_TIERS['Claude']).toBe(1)
    expect(STRENGTH_TIERS['OpenAI']).toBe(1)
  })

  it('Deepseek and Qwen are tier 2', () => {
    expect(STRENGTH_TIERS['Deepseek']).toBe(2)
    expect(STRENGTH_TIERS['Qwen']).toBe(2)
  })

  it('YandexGPT and CustomLLM are tier 3', () => {
    expect(STRENGTH_TIERS['YandexGPT']).toBe(3)
    expect(STRENGTH_TIERS['CustomLLM']).toBe(3)
  })
})

describe('getConfiguredFamilies', () => {
  it('returns empty array when no settings', () => {
    expect(getConfiguredFamilies(null)).toEqual([])
    expect(getConfiguredFamilies({})).toEqual([])
  })

  it('returns only configured families', () => {
    const s = mkSettings('OpenAI', 'Qwen')
    const families = getConfiguredFamilies(s)
    expect(families).toContain('OpenAI')
    expect(families).toContain('Qwen')
    expect(families).not.toContain('Claude')
  })

  it('returns families sorted by tier (strongest first)', () => {
    const s = mkSettings('YandexGPT', 'Qwen', 'Claude')
    const families = getConfiguredFamilies(s)
    expect(families[0]).toBe('Claude')
    expect(families[1]).toBe('Qwen')
    expect(families[2]).toBe('YandexGPT')
  })
})

describe('selfJudgingGuard', () => {
  it('returns cross-family judge when alternatives exist', () => {
    const s = mkSettings('OpenAI', 'Claude')
    const result = selfJudgingGuard('OpenAI', s)
    expect(result.judgeFamily).toBe('Claude')
    expect(result.sameFamily).toBe(false)
    expect(result.warning).toBeUndefined()
  })

  it('falls back to same family when only one provider configured', () => {
    const s = mkSettings('OpenAI')
    const result = selfJudgingGuard('OpenAI', s)
    expect(result.judgeFamily).toBe('OpenAI')
    expect(result.sameFamily).toBe(true)
    expect(result.warning).toBe('single-provider')
  })

  it('returns no-providers-configured warning when settings empty', () => {
    const result = selfJudgingGuard('OpenAI', {})
    expect(result.sameFamily).toBe(true)
    expect(result.warning).toBe('no-providers-configured')
  })

  it('picks strongest non-generator family', () => {
    const s = mkSettings('Claude', 'Deepseek', 'YandexGPT')
    const result = selfJudgingGuard('Claude', s)
    expect(result.judgeFamily).toBe('Deepseek')
    expect(result.sameFamily).toBe(false)
  })
})

describe('selectJurors', () => {
  it('selects n=1 juror cross-family', () => {
    const s = mkSettings('OpenAI', 'Claude')
    const jurors = selectJurors(1, 'OpenAI', s)
    expect(jurors).toHaveLength(1)
    expect(jurors[0].family).toBe('Claude')
    expect(jurors[0].duplicate).toBe(false)
  })

  it('selects diverse jurors up to available families', () => {
    const s = mkSettings('Claude', 'OpenAI', 'Qwen')
    const jurors = selectJurors(3, 'Claude', s)
    expect(jurors).toHaveLength(3)
    const families = jurors.map(j => j.family)
    expect(new Set(families).size).toBe(3)
  })

  it('fills jury with duplicates when n > available families', () => {
    const s = mkSettings('OpenAI')
    const jurors = selectJurors(3, 'Claude', s)
    expect(jurors).toHaveLength(3)
    const duplicates = jurors.filter(j => j.duplicate)
    expect(duplicates).toHaveLength(2)
  })

  it('marks all jurors as duplicate when no providers configured', () => {
    const jurors = selectJurors(2, 'OpenAI', {})
    expect(jurors).toHaveLength(2)
    jurors.forEach(j => expect(j.duplicate).toBe(true))
  })

  it('prefers non-generator families in jury', () => {
    const s = mkSettings('OpenAI', 'Claude', 'Qwen')
    const jurors = selectJurors(2, 'OpenAI', s)
    const families = jurors.map(j => j.family)
    expect(families).not.toContain('OpenAI')
  })
  it('uses tier-99 fallback for a generatorFamily not registered in STRENGTH_TIERS', () => {
    const s = mkSettings('Claude', 'OpenAI')
    const jurors = selectJurors(2, 'UnknownModel', s)
    expect(jurors).toHaveLength(2)
    expect(jurors.every(j => !j.duplicate)).toBe(true)
  })
})

describe('isConfigured credential validation', () => {
  it.each([
    ['whitespace-only apiKey', {openai: {apiKey: '   '}}],
    ['empty string apiKey', {openai: {apiKey: ''}}],
    ['absent apiKey field', {openai: {}}],
    ['empty apiRootUrl for CustomLLM', {custom_llm: {apiRootUrl: ''}}],
    ['whitespace-only apiRootUrl for CustomLLM', {custom_llm: {apiRootUrl: '  '}}],
  ])('excludes provider when credential has %s', (_, settings) => {
    expect(getConfiguredFamilies(settings)).toHaveLength(0)
  })

  it('includes CustomLLM when apiRootUrl is a non-empty string', () => {
    expect(getConfiguredFamilies({custom_llm: {apiRootUrl: 'http://my-llm'}})).toContain('CustomLLM')
  })
})
