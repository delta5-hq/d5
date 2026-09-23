import {passesCommodityGate, readStructuralGateResult} from './structuralGate'
import {STRUCTURAL_GATE_REJECTION_REASON} from './failureSemantics'

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

describe('readStructuralGateResult — short valid output', () => {
  it.each(['Yes.', 'No.', 'Done.', 'OK', 'Sure.', '1. Item', '42', 'Elephant'])(
    'passes short non-empty non-refusal output "%s"',
    text => {
      expect(readStructuralGateResult(text).passed).toBe(true)
    },
  )

  it.each(SUBSTANTIVE_FIXTURES)('passes substantive text: "%s"', text => {
    expect(readStructuralGateResult(text).passed).toBe(true)
  })
})

describe('readStructuralGateResult — no length floor: short valid output carries reason:null', () => {
  it.each(['a', '1', 'x', 'a'.repeat(19)])(
    'short text "%s" (formerly under 20-char floor) produces {passed:true, reason:null} — no under-length category exists',
    text => {
      expect(readStructuralGateResult(text, 0)).toEqual({passed: true, reason: null})
    },
  )
})

describe('passesCommodityGate — exclusive: no truncation floor', () => {
  describe('any non-empty non-refusal output passes regardless of length', () => {
    it.each(['a', '1', 'x'])('passes single-character output "%s"', text => {
      expect(passesCommodityGate(text)).toBe(true)
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
      expect(readStructuralGateResult(input).passed).toBe(false)
      expect(passesCommodityGate(input)).toBe(false)
    })
  })

  describe('refusal pattern rejection — EN and RU', () => {
    it.each(REFUSAL_FIXTURES)('both gates reject refusal: "%s"', text => {
      expect(readStructuralGateResult(text).passed).toBe(false)
      expect(passesCommodityGate(text)).toBe(false)
    })
  })

  describe('refusal detection is anchored to the start of the text (after trimStart)', () => {
    it.each([
      'I cannot determine the exact cause — here are three hypotheses.',
      'The main reason I cannot confirm this is the limited dataset.',
      'Implementing this feature requires three steps.',
    ])('EN: passes non-refusal containing a refusal keyword mid-sentence: "%s"', text => {
      expect(readStructuralGateResult(text).passed).toBe(true)
      expect(passesCommodityGate(text)).toBe(true)
    })

    it.each([
      'Я не могу определить точную причину — вот три гипотезы.',
      'Главная причина, по которой я не могу подтвердить это, — ограниченные данные.',
      'Реализация этой функции требует трёх шагов.',
    ])('RU: passes non-refusal containing a refusal keyword mid-sentence: "%s"', text => {
      expect(readStructuralGateResult(text).passed).toBe(true)
      expect(passesCommodityGate(text)).toBe(true)
    })

    it.each([
      "\nI'm sorry, I cannot help with that.",
      '   As an AI, I cannot generate harmful content.',
      '\nИзвините, я не могу помочь с этим.',
      '   Как языковая модель, я не могу создавать вредоносный контент.',
    ])('both gates reject leading-whitespace refusal after trimStart: "%s"', text => {
      expect(readStructuralGateResult(text).passed).toBe(false)
      expect(passesCommodityGate(text)).toBe(false)
    })
  })

  describe('forkIndex is an observability parameter that does not alter the verdict', () => {
    const substantive = 'ok'

    it.each([0, 1, 99, null, undefined])('passing inputs pass both gates regardless of forkIndex=%s', forkIndex => {
      expect(readStructuralGateResult(substantive, forkIndex).passed).toBe(true)
      expect(passesCommodityGate('hello', forkIndex)).toBe(true)
    })

    it.each([0, 1, 99, null, undefined])('failing inputs fail both gates regardless of forkIndex=%s', forkIndex => {
      expect(readStructuralGateResult('', forkIndex).passed).toBe(false)
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
      readStructuralGateResult('', forkIndex).passed
      const structuralLabel = rejectionCalls()[0][1]
      log.mockClear()

      passesCommodityGate('', forkIndex)
      const commodityLabel = rejectionCalls()[0][1]

      expect(structuralLabel).toBe(`fork-${forkIndex}`)
      expect(commodityLabel).toBe(`fork-${forkIndex}`)
    })

    it.each([null, undefined])('uses fork-? label for forkIndex=%s — identical across both gates', forkIndex => {
      readStructuralGateResult('', forkIndex).passed
      const structuralLabel = rejectionCalls()[0][1]
      log.mockClear()

      passesCommodityGate('', forkIndex)
      const commodityLabel = rejectionCalls()[0][1]

      expect(structuralLabel).toBe('fork-?')
      expect(commodityLabel).toBe('fork-?')
    })

    it('logs empty-output rejection with the exact reason string', () => {
      readStructuralGateResult('').passed
      expect(rejectionCalls()[0]).toEqual(['%s rejected: %s', 'fork-?', STRUCTURAL_GATE_REJECTION_REASON.EMPTY_OUTPUT])
    })

    it('logs refusal-pattern rejection with the typed reason', () => {
      readStructuralGateResult("I'm sorry, I cannot help with that.").passed
      expect(rejectionCalls()[0][2]).toBe(STRUCTURAL_GATE_REJECTION_REASON.REFUSAL_OUTPUT)
    })

    it('emits exactly one log entry per rejected call — no double-logging', () => {
      readStructuralGateResult('').passed
      expect(rejectionCalls()).toHaveLength(1)
      log.mockClear()
      passesCommodityGate('')
      expect(rejectionCalls()).toHaveLength(1)
    })

    it('emits no log entry when a call passes', () => {
      readStructuralGateResult('ok').passed
      passesCommodityGate('hello')
      expect(rejectionCalls()).toHaveLength(0)
    })
  })
})

describe('parity contract — typed failure signals are the sole behavioral difference between the two gates', () => {
  it('short valid output passes both gates', () => {
    expect(readStructuralGateResult('ok').passed).toBe(true)
    expect(passesCommodityGate('ok')).toBe(true)
  })

  it('short refusal fails both gates', () => {
    const shortRefusal = "I'm sorry."
    expect(readStructuralGateResult(shortRefusal).passed).toBe(false)
    expect(passesCommodityGate(shortRefusal)).toBe(false)
  })
})

describe('structural gate — execution error signal', () => {
  const substantiveErrorText = 'Upstream call failed but prose is long enough to pass text-only checks.'

  it('rejects an execution-error node even when prose is substantive', () => {
    expect(
      readStructuralGateResult(substantiveErrorText, 0, {
        executionStatus: 'error',
      }).passed,
    ).toBe(false)
  })

  it.each([
    ['', STRUCTURAL_GATE_REJECTION_REASON.EMPTY_OUTPUT],
    ['   ', STRUCTURAL_GATE_REJECTION_REASON.EMPTY_OUTPUT],
    ["I'm sorry, I cannot help with that.", STRUCTURAL_GATE_REJECTION_REASON.REFUSAL_OUTPUT],
    [substantiveErrorText, STRUCTURAL_GATE_REJECTION_REASON.EXECUTION_ERROR],
  ])('returns typed rejection reason for %p', (text, reason) => {
    const failureSignal =
      reason === STRUCTURAL_GATE_REJECTION_REASON.EXECUTION_ERROR ? {executionStatus: 'error'} : null
    expect(readStructuralGateResult(text, 0, failureSignal)).toEqual({passed: false, reason})
  })
})
