const COMMAND_TO_QUERYTYPE_MAP: Record<string, string> = {
  '/instruct': 'chat',
  '/reason': 'chat',
  '/chatgpt': 'chat',
  '/chat': 'chat',
  '/web': 'web',
  '/scholar': 'scholar',
  '/refine': 'refine',
  '/foreach': 'foreach',
  '/steps': 'steps',
  '/outline': 'outline',
  '/summarize': 'summarize',
  '/switch': 'switch',
  '/claude': 'claude',
  '/qwen': 'qwen',
  '/perplexity': 'perplexity',
  '/deepseek': 'deepseek',
  '/custom': 'custom_llm',
  '/memorize': 'memorize',
  '/ext': 'ext',
  '/yandexgpt': 'yandex',
}

export const extractQueryTypeFromCommand = (command: string | undefined): string => {
  if (!command) return 'chat'

  const trimmed = command.trim()
  const firstWord = trimmed.split(/\s+/)[0]

  const mappedQueryType = COMMAND_TO_QUERYTYPE_MAP[firstWord]
  if (mappedQueryType) return mappedQueryType

  if (firstWord.startsWith('/')) {
    return firstWord.substring(1)
  }

  return firstWord || 'chat'
}
