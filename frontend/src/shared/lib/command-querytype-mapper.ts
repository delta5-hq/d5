export const COMMAND_TO_QUERYTYPE_MAP: Record<string, string> = {
  '/instruct': 'chat',
  '/reason': 'chat',
  '/chatgpt': 'chat',
  '/chat': 'chat',
  '/completion': 'completion',
  '/web': 'web',
  '/scholar': 'scholar',
  '/refine': 'refine',
  '/foreach': 'foreach',
  '/steps': 'steps',
  '/outline': 'outline',
  '/summarize': 'summarize',
  '/switch': 'switch',
  '/case': 'switch',
  '/claude': 'claude',
  '/qwen': 'qwen',
  '/perplexity': 'perplexity',
  '/deepseek': 'deepseek',
  '/custom': 'custom_llm',
  '/memorize': 'memorize',
  '/ext': 'ext',
  '/yandexgpt': 'yandex',
  '/download': 'download',
}

export interface DynamicAlias {
  alias: string
  queryType?: string
}

export function getFullCommandMap(dynamicAliases?: DynamicAlias[]): Record<string, string> {
  const fullMap = { ...COMMAND_TO_QUERYTYPE_MAP }

  if (dynamicAliases) {
    dynamicAliases.forEach(({ alias, queryType }) => {
      if (alias && !fullMap[alias]) {
        fullMap[alias] = queryType || alias.substring(1)
      }
    })
  }

  return fullMap
}

export function getSupportedCommands(dynamicAliases?: DynamicAlias[]): readonly string[] {
  return Object.keys(getFullCommandMap(dynamicAliases))
}

export const extractQueryTypeFromCommand = (command: string | undefined, dynamicAliases?: DynamicAlias[]): string => {
  if (!command) return 'chat'

  const trimmed = command.trim()
  const firstWord = trimmed.split(/\s+/)[0]

  const fullMap = getFullCommandMap(dynamicAliases)
  const mappedQueryType = fullMap[firstWord]
  if (mappedQueryType) return mappedQueryType

  if (firstWord.startsWith('/')) {
    return firstWord.substring(1)
  }

  return firstWord || 'chat'
}
