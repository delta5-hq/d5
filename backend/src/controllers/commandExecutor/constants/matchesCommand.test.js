import {matchesCommand} from './matchesCommand'
import {commandBoundaryCases, commandLookalikeCases} from './commandBoundaryCases.testData'
import {clearCommandsWithParams} from './index'

describe('matchesCommand', () => {
  it.each([
    ['command boundary cases', commandBoundaryCases.map(({input}) => input)],
    ['command lookalike cases', commandLookalikeCases.map(({input}) => input)],
  ])('keeps %s unique', (_name, inputs) => {
    expect(new Set(inputs).size).toBe(inputs.length)
  })

  it.each(commandBoundaryCases)('matches command token boundary: $input', ({input, command}) => {
    expect(matchesCommand(input, command)).toBe(true)
  })

  it.each(commandLookalikeCases)('rejects command-prefix lookalike: $input', ({input, command}) => {
    expect(matchesCommand(input, command)).toBe(false)
  })

  it.each([
    ['', '/web'],
    [null, '/web'],
    [undefined, '/web'],
    ['/web prompt', ''],
    ['/web prompt', null],
    ['/web prompt', undefined],
  ])('rejects absent input: title=%s command=%s', (title, command) => {
    expect(matchesCommand(title, command)).toBe(false)
  })
})

describe('clearCommandsWithParams', () => {
  it('strips the command token and leaves only the content', () => {
    expect(clearCommandsWithParams('/chatgpt analyze competitors')).toBe('analyze competitors')
  })

  it('strips the command token AND a known flag param (--join), leaving only content', () => {
    // A bare /^\S+\s*/ strip would leave '--join content'; clearCommandsWithParams must strip both.
    expect(clearCommandsWithParams('/chatgpt --join analyze competitors')).toBe('analyze competitors')
  })

  it('strips :n= quantifier so it does not appear in the derived prompt', () => {
    expect(clearCommandsWithParams('/chatgpt :n=3 analyze competitors')).toBe('analyze competitors')
  })

  it('does not strip /reason or /instruct substrings from prompt prose (P0.2 — not executor commands)', () => {
    expect(clearCommandsWithParams('/chatgpt Explain the /reasoning behind X')).toBe('Explain the /reasoning behind X')
    expect(clearCommandsWithParams('/chatgpt see /instructions.md')).toBe('see /instructions.md')
  })

  it('returns the original string unchanged when no command or param is present', () => {
    expect(clearCommandsWithParams('plain content without commands')).toBe('plain content without commands')
  })

  it('trims leading and trailing whitespace after stripping', () => {
    expect(clearCommandsWithParams('/chatgpt  ')).toBe('')
  })
})
