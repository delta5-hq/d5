import {queryCommands} from './commandRegExp'

export const commandBoundarySuffixes = ['', ' prompt', '\tprompt', '\nprompt', '\r\nprompt']

export const commandLookalikeSuffixes = [
  'x prompt',
  '-suffix prompt',
  '/suffix prompt',
  '.suffix prompt',
  ':suffix prompt',
  '_suffix prompt',
  '123 prompt',
]

export const commandBoundaryCases = queryCommands.flatMap(command =>
  commandBoundarySuffixes.map(suffix => ({command, input: `${command}${suffix}`})),
)

export const commandLookalikeCases = queryCommands.flatMap(command =>
  commandLookalikeSuffixes.map(suffix => ({command, input: `${command}${suffix}`})),
)

export const commandLookalikeInputs = commandLookalikeCases.map(({input}) => input)

export const orderedCommandBoundaryCases = commandBoundaryCases.map(({command, input}) => ({
  command,
  input: `#1 ${input}`,
}))

export const orderedCommandLookalikeCases = commandLookalikeCases.map(({command, input}) => ({
  command,
  input: `#1 ${input}`,
}))

export const orderedCommandLookalikeInputs = orderedCommandLookalikeCases.map(({input}) => input)
