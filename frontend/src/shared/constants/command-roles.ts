export type CommandRole = 'llm' | 'search' | 'transform' | 'control' | 'utility'

export const QUERY_TYPE_ROLES: Record<string, CommandRole> = {
  chat: 'llm',
  claude: 'llm',
  qwen: 'llm',
  deepseek: 'llm',
  perplexity: 'llm',
  yandex: 'llm',
  custom_llm: 'llm',
  completion: 'llm',
  web: 'search',
  scholar: 'search',
  summarize: 'transform',
  refine: 'transform',
  foreach: 'control',
  switch: 'control',
  steps: 'control',
  outline: 'control',
  memorize: 'utility',
  ext: 'utility',
  download: 'utility',
  '/instruct': 'llm',
  '/reason': 'llm',
  '/web': 'search',
  '/scholar': 'search',
  '/refine': 'transform',
  '/foreach': 'control',
}

export function getCommandRole(queryType: string | undefined): CommandRole | undefined {
  if (!queryType) return undefined
  return QUERY_TYPE_ROLES[queryType]
}
