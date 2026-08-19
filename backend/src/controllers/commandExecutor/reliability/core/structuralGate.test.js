import {passesStructuralGate, passesCommodityGate, MIN_SUBSTANTIVE_CHARS} from './structuralGate'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const EMPTY_INPUTS = [null, undefined, '', '   ', '\n\t']

const REFUSAL_FIXTURES_EN = [
  "I'm sorry, I cannot help with that.",
  'I am sorry, I cannot assist with this.',
  'I cannot help with this request.',
  'I cannot assist with generating that content.',
  'I cannot provide information about that.',
  'I cannot create content of that nature.',
  'I cannot write that kind of content.',
  "I am afraid I can't do that.",
  "I'm afraid I cannot comply.",
  'As an AI, I cannot generate harmful content.',
  'As a language model, I cannot assist with that.',
  'Sorry, as an AI language model I cannot help.',
  "I'd prefer not to do that.",
  "Unfortunately, I can't help with this.",
  'Unfortunately, I cannot complete this request.',
  "Unfortunately, I don't have the ability to do that.",
]

const REFUSAL_FIXTURES_RU = [
  'Извините, я не могу помочь с этим.',
  'Извините, но я не буду выполнять это.',
  'Прошу прощения, но я не могу помочь.',
  'К сожалению, я не могу выполнить это.',
  'К сожалению, не в состоянии предоставить эту информацию.',
  'Я не могу помочь с этим запросом.',
  'Я не могу создать такой контент.',
  'Я не могу написать подобный текст.',
  'Я не буду помогать с этим.',
  'Я боюсь, что не могу это сделать.',
  'Как языковая модель, я не могу создавать вредоносный контент.',
  'Как ИИ, я не могу генерировать такой материал.',
]

const REFUSAL_FIXTURES = [...REFUSAL_FIXTURES_EN, ...REFUSAL_FIXTURES_RU]

const SUBSTANTIVE_FIXTURES = [
  'The top 5 competitors are Acme Corp, Beta Inc, Gamma Ltd, Delta Co, and Epsilon LLC.',
  'Market analysis: The sector grew 12% year-over-year driven by increased digital adoption.',
  'Here are three recommendations for improving your workflow efficiency.',
  'I think the best approach would be to start with the core infrastructure.',
  'Based on the data provided, revenue projections indicate strong growth potential.',
]

describe('passesStructuralGate — exclusive: truncation floor', () => {
  describe('below floor → rejects', () => {
    it.each(['Yes.', 'No.', 'Done.', 'OK', 'Sure.', '1. Item'])('rejects short word "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
    })

    it('rejects text of exactly MIN_SUBSTANTIVE_CHARS - 1 characters', () => {
      expect(passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS - 1))).toBe(false)
    })
  })

  describe('at or above floor → passes', () => {
    it('passes text of exactly MIN_SUBSTANTIVE_CHARS characters (floor is inclusive)', () => {
      expect(passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS))).toBe(true)
    })

    it.each(SUBSTANTIVE_FIXTURES)('passes substantive text: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(true)
    })
  })

  describe('rejection check order — refusal check fires before truncation check', () => {
    it('rejects a short refusal without reaching the truncation check', () => {
      const shortRefusal = "I'm sorry."
      expect(shortRefusal.trim().length).toBeLessThan(MIN_SUBSTANTIVE_CHARS)
      expect(passesStructuralGate(shortRefusal)).toBe(false)
    })
  })

  describe('truncation log includes character count', () => {
    let log

    beforeEach(() => {
      log = jest.requireMock('debug')
      log.mockClear()
    })

    it('logs the character count and "output too short" reason', () => {
      const input = 'Too short.'
      passesStructuralGate(input)
      const rejections = log.mock.calls.filter(([fmt]) => fmt === '%s rejected: %s')
      expect(rejections).toHaveLength(1)
      expect(rejections[0][2]).toMatch(/output too short/)
      expect(rejections[0][2]).toContain(String(input.trim().length))
    })
  })
})

describe('passesCommodityGate — exclusive: no truncation floor', () => {
  describe('any non-empty non-refusal output passes regardless of length', () => {
    it.each(['a', '1', 'x'])('passes single-character output "%s"', text => {
      expect(passesCommodityGate(text)).toBe(true)
    })

    it('passes text of exactly MIN_SUBSTANTIVE_CHARS - 1 characters', () => {
      expect(passesCommodityGate('a'.repeat(MIN_SUBSTANTIVE_CHARS - 1))).toBe(true)
    })

    it.each(['hello', 'yes', 'no', '42', 'No.', 'Done.', 'Ok', 'True'])('passes short reply "%s"', text => {
      expect(passesCommodityGate(text)).toBe(true)
    })

    it.each(SUBSTANTIVE_FIXTURES)('passes substantive text: "%s"', text => {
      expect(passesCommodityGate(text)).toBe(true)
    })
  })
})

describe('shared base behavior — applies identically to both gates', () => {
  describe('empty input rejection', () => {
    it.each(EMPTY_INPUTS)('both gates reject %p', input => {
      expect(passesStructuralGate(input)).toBe(false)
      expect(passesCommodityGate(input)).toBe(false)
    })
  })

  describe('refusal pattern rejection — EN and RU', () => {
    it.each(REFUSAL_FIXTURES)('both gates reject refusal: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
      expect(passesCommodityGate(text)).toBe(false)
    })
  })

  describe('refusal detection is anchored to the start of the text (after trimStart)', () => {
    it.each([
      'I cannot determine the exact cause — here are three hypotheses.',
      'The main reason I cannot confirm this is the limited dataset.',
      'Implementing this feature requires three steps.',
    ])('EN: passes non-refusal containing a refusal keyword mid-sentence: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(true)
      expect(passesCommodityGate(text)).toBe(true)
    })

    it.each([
      'Я не могу определить точную причину — вот три гипотезы.',
      'Главная причина, по которой я не могу подтвердить это, — ограниченные данные.',
      'Реализация этой функции требует трёх шагов.',
    ])('RU: passes non-refusal containing a refusal keyword mid-sentence: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(true)
      expect(passesCommodityGate(text)).toBe(true)
    })

    it.each([
      "\nI'm sorry, I cannot help with that.",
      '   As an AI, I cannot generate harmful content.',
      '\nИзвините, я не могу помочь с этим.',
      '   Как языковая модель, я не могу создавать вредоносный контент.',
    ])('both gates reject leading-whitespace refusal after trimStart: "%s"', text => {
      expect(passesStructuralGate(text)).toBe(false)
      expect(passesCommodityGate(text)).toBe(false)
    })
  })

  describe('forkIndex is an observability parameter that does not alter the verdict', () => {
    const substantive = 'a'.repeat(MIN_SUBSTANTIVE_CHARS)

    it.each([0, 1, 99, null, undefined])('passing inputs pass both gates regardless of forkIndex=%s', forkIndex => {
      expect(passesStructuralGate(substantive, forkIndex)).toBe(true)
      expect(passesCommodityGate('hello', forkIndex)).toBe(true)
    })

    it.each([0, 1, 99, null, undefined])('failing inputs fail both gates regardless of forkIndex=%s', forkIndex => {
      expect(passesStructuralGate('', forkIndex)).toBe(false)
      expect(passesCommodityGate('', forkIndex)).toBe(false)
    })
  })

  describe('structured debug log on every rejection', () => {
    let log

    beforeEach(() => {
      log = jest.requireMock('debug')
      log.mockClear()
    })

    const rejectionCalls = () => log.mock.calls.filter(([fmt]) => fmt === '%s rejected: %s')

    it.each([0, 3, 99])('uses fork-%i label for forkIndex=%i — identical across both gates', forkIndex => {
      passesStructuralGate('', forkIndex)
      const structuralLabel = rejectionCalls()[0][1]
      log.mockClear()

      passesCommodityGate('', forkIndex)
      const commodityLabel = rejectionCalls()[0][1]

      expect(structuralLabel).toBe(`fork-${forkIndex}`)
      expect(commodityLabel).toBe(`fork-${forkIndex}`)
    })

    it.each([null, undefined])('uses fork-? label for forkIndex=%s — identical across both gates', forkIndex => {
      passesStructuralGate('', forkIndex)
      const structuralLabel = rejectionCalls()[0][1]
      log.mockClear()

      passesCommodityGate('', forkIndex)
      const commodityLabel = rejectionCalls()[0][1]

      expect(structuralLabel).toBe('fork-?')
      expect(commodityLabel).toBe('fork-?')
    })

    it('logs empty-output rejection with the exact reason string', () => {
      passesStructuralGate('')
      expect(rejectionCalls()[0]).toEqual(['%s rejected: %s', 'fork-?', 'empty output'])
    })

    it('logs refusal-pattern rejection with a reason that includes the matched prefix', () => {
      passesStructuralGate("I'm sorry, I cannot help with that.")
      expect(rejectionCalls()[0][2]).toMatch(/^refusal pattern matched/)
    })

    it('emits exactly one log entry per rejected call — no double-logging', () => {
      passesStructuralGate('')
      expect(rejectionCalls()).toHaveLength(1)
      log.mockClear()
      passesCommodityGate('')
      expect(rejectionCalls()).toHaveLength(1)
    })

    it('emits no log entry when a call passes', () => {
      passesStructuralGate('a'.repeat(MIN_SUBSTANTIVE_CHARS))
      passesCommodityGate('hello')
      expect(rejectionCalls()).toHaveLength(0)
    })
  })
})

describe('parity contract — truncation floor is the sole behavioral difference between the two gates', () => {
  it('below floor: structural gate rejects, commodity gate passes', () => {
    const belowFloor = 'a'.repeat(MIN_SUBSTANTIVE_CHARS - 1)
    expect(passesStructuralGate(belowFloor)).toBe(false)
    expect(passesCommodityGate(belowFloor)).toBe(true)
  })

  it('at floor: both gates pass (floor is inclusive)', () => {
    const atFloor = 'a'.repeat(MIN_SUBSTANTIVE_CHARS)
    expect(passesStructuralGate(atFloor)).toBe(true)
    expect(passesCommodityGate(atFloor)).toBe(true)
  })

  it('above floor: both gates pass', () => {
    const aboveFloor = 'a'.repeat(MIN_SUBSTANTIVE_CHARS + 1)
    expect(passesStructuralGate(aboveFloor)).toBe(true)
    expect(passesCommodityGate(aboveFloor)).toBe(true)
  })

  it('short refusal fails both gates — refusal check fires before truncation check', () => {
    const shortRefusal = "I'm sorry."
    expect(shortRefusal.trim().length).toBeLessThan(MIN_SUBSTANTIVE_CHARS)
    expect(passesStructuralGate(shortRefusal)).toBe(false)
    expect(passesCommodityGate(shortRefusal)).toBe(false)
  })
})

describe('deterministic failure signals — gate before prose judging', () => {
  const substantiveErrorText =
    'HTTP 500 upstream tool failed but this prose is long enough to pass the current text checks.'

  it.each([
    ['MCP isError', {isError: true}],
    ['HTTP lower non-2xx boundary', {httpStatus: 199}],
    ['HTTP upper non-2xx boundary', {httpStatus: 300}],
    ['HTTP 500', {httpStatus: 500}],
    ['SSH nonzero exit', {exitCode: 1}],
    ['runtime failure status', {status: 'runtime-failed'}],
    ['execution error node', {executionStatus: 'error'}],
  ])('rejects %s even when prose is substantive', (_, signal) => {
    expect(passesStructuralGate(substantiveErrorText, 0, signal)).toBe(false)
  })

  it.each([
    ['HTTP lower success boundary', {httpStatus: 200}],
    ['HTTP upper success boundary', {httpStatus: 299}],
    ['SSH zero exit', {exitCode: 0}],
    ['MCP non-error result', {isError: false}],
  ])('passes identical prose for %s', (_, signal) => {
    expect(passesStructuralGate(substantiveErrorText, 0, signal)).toBe(true)
  })

  it('commodity gate also rejects deterministic hard failures', () => {
    expect(passesCommodityGate(substantiveErrorText, 0, {isError: true})).toBe(false)
  })
})
