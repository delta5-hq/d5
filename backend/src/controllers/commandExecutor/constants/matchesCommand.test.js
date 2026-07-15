import {matchesCommand} from './matchesCommand'
import {commandBoundaryCases, commandLookalikeCases} from './commandBoundaryCases.testData'

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
