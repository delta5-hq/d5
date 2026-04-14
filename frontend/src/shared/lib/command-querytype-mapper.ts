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

export const COMMAND_DESCRIPTIONS: Record<string, string> = {
  '/instruct': 'Send instruction to LLM with system prompt',
  '/reason': 'Step-by-step reasoning with LLM',
  '/chatgpt': 'ChatGPT conversation',
  '/chat': 'Chat with LLM',
  '/completion': 'Text completion without chat formatting',
  '/web': 'Search web with Perplexity',
  '/scholar': 'Search academic papers',
  '/refine': 'Iteratively refine text with LLM',
  '/foreach': 'Loop over items with command template',
  '/steps': 'Execute multiple commands sequentially',
  '/outline': 'Generate hierarchical outline',
  '/summarize': 'Summarize text content',
  '/switch': 'Conditional branching logic',
  '/case': 'Switch case branch',
  '/claude': 'Use Claude AI model',
  '/qwen': 'Use Qwen AI model',
  '/perplexity': 'Use Perplexity AI model',
  '/deepseek': 'Use DeepSeek AI model',
  '/custom': 'Custom LLM endpoint',
  '/memorize': 'Store content in memory',
  '/ext': 'Extract structured data with LLM',
  '/yandexgpt': 'Use YandexGPT model',
  '/download': 'Download file from URL',
}

export interface DynamicAlias {
  alias: string
  queryType?: string
  description?: string
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
