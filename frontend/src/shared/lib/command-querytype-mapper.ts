export const COMMAND_TO_QUERYTYPE_MAP: Record<string, string> = {
  '/instruct': 'chat',
  '/reason': 'chat',
  '/chatgpt': 'chat',
  '/chat': 'chat',
  '/web': 'web',
  '/scholar': 'scholar',
  '/refine': 'refine',
  '/validate': 'validate',
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
  '/mcp': 'mcp-fusion',
  '/ext': 'ext',
  '/yandexgpt': 'yandex',
  '/download': 'download',
}

export const COMMAND_DESCRIPTIONS: Record<string, string> = {
  '/chat': 'Invokes the Default LLM configured in Settings → Default Model',
  '/chatgpt': 'Invokes the Default LLM via the OpenAI-compatible endpoint',
  '/instruct': 'Invokes the Default LLM (instruction-style entry point)',
  '/reason': 'Invokes the Default LLM (reasoning-style entry point)',
  '/claude': 'Invoke Claude AI model directly',
  '/qwen': 'Invoke Qwen AI model directly',
  '/perplexity': 'Invoke Perplexity AI model directly',
  '/deepseek': 'Invoke DeepSeek AI model directly',
  '/yandexgpt': 'Invoke YandexGPT model directly',
  '/custom': 'Invoke a custom LLM endpoint configured in Settings',
  '/web': 'Search and summarize web pages via SerpAPI',
  '/scholar': 'Search and summarize academic papers via SerpAPI Scholar',
  '/outline': 'Generate a structured hierarchical outline from web or knowledge base',
  '/summarize': 'Summarize child node content using the Default LLM',
  '/ext': 'Query the knowledge base with LLM synthesis',
  '/memorize': 'Store text into the knowledge base as vector embeddings',
  '/download': 'Download a file from a URL',
  '/refine': 'Iteratively improve text through multiple LLM passes',
  '/validate': 'Validate parent node content against a criterion',
  '/foreach': 'Run a command on each child node, substituting @@ with its content',
  '/steps': 'Execute a sequence of ordered child-node commands',
  '/switch': 'Route execution to child nodes based on conditional logic',
  '/case': 'Define a match branch inside a /switch flow',
  '/mcp': 'Run an AI agent across all configured MCP integrations — picks the best tools automatically',
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

  if (!firstWord.startsWith('/')) return 'chat'

  const fullMap = getFullCommandMap(dynamicAliases)
  const mappedQueryType = fullMap[firstWord]
  if (mappedQueryType) return mappedQueryType

  return 'unknown'
}
