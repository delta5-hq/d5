export const D5_COMMANDS = [
  '/instruct',
  '/reason',
  '/chatgpt',
  '/chat',
  '/web',
  '/scholar',
  '/refine',
  '/foreach',
  '/steps',
  '/outline',
  '/summarize',
  '/switch',
  '/claude',
  '/qwen',
  '/perplexity',
  '/deepseek',
  '/custom',
  '/memorize',
  '/ext',
  '/yandexgpt',
] as const

export type D5Command = (typeof D5_COMMANDS)[number]

export function isValidCommand(text: string): boolean {
  return D5_COMMANDS.some(cmd => text === cmd)
}

export function getAllCommands(): readonly string[] {
  return D5_COMMANDS
}
