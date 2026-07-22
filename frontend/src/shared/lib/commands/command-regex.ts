import { STEP_PREFIX_REGEX } from './command-constants'
import { getSupportedCommands, type DynamicAlias } from '../command-querytype-mapper'

function escapeRegexCommand(command: string): string {
  return command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/')
}

function createCommandPattern(commands: readonly string[], withOrder = false): RegExp {
  const escapedCommands = commands.map(escapeRegexCommand)
  const prefixPattern = escapedCommands.join('|')
  const orderPart = withOrder ? `(?:${STEP_PREFIX_REGEX}\\s+)?` : ''
  return new RegExp(`^\\s*${orderPart}(${prefixPattern})(\\s+|$)`, '')
}

export const commandRegex = {
  any(dynamicAliases?: DynamicAlias[]): RegExp {
    return createCommandPattern(getSupportedCommands(dynamicAliases))
  },

  anyWithOrder(dynamicAliases?: DynamicAlias[]): RegExp {
    return createCommandPattern(getSupportedCommands(dynamicAliases), true)
  },

  yandex: createCommandPattern(['/yandexgpt']),
  yandexWithOrder: createCommandPattern(['/yandexgpt'], true),

  web: createCommandPattern(['/web']),
  webWithOrder: createCommandPattern(['/web'], true),

  scholar: createCommandPattern(['/scholar']),
  scholarWithOrder: createCommandPattern(['/scholar'], true),

  outline: createCommandPattern(['/outline']),
  outlineWithOrder: createCommandPattern(['/outline'], true),

  ext: createCommandPattern(['/ext']),
  extWithOrder: createCommandPattern(['/ext'], true),

  steps: createCommandPattern(['/steps']),
  stepsWithOrder: createCommandPattern(['/steps'], true),

  summarize: createCommandPattern(['/summarize']),
  summarizeWithOrder: createCommandPattern(['/summarize'], true),

  foreach: createCommandPattern(['/foreach']),
  foreachWithOrder: createCommandPattern(['/foreach'], true),

  chatgpt: createCommandPattern(['/chatgpt']),
  chatgptWithOrder: createCommandPattern(['/chatgpt'], true),

  switch: createCommandPattern(['/switch']),
  switchWithOrder: createCommandPattern(['/switch'], true),

  case: createCommandPattern(['/case']),
  caseWithOrder: createCommandPattern(['/case'], true),

  claude: createCommandPattern(['/claude']),
  claudeWithOrder: createCommandPattern(['/claude'], true),

  qwen: createCommandPattern(['/qwen']),
  qwenWithOrder: createCommandPattern(['/qwen'], true),

  perplexity: createCommandPattern(['/perplexity']),
  perplexityWithOrder: createCommandPattern(['/perplexity'], true),

  download: createCommandPattern(['/download']),
  downloadWithOrder: createCommandPattern(['/download'], true),

  deepseek: createCommandPattern(['/deepseek']),
  deepseekWithOrder: createCommandPattern(['/deepseek'], true),

  customLLMChat: createCommandPattern(['/custom']),
  customLLMChatWithOrder: createCommandPattern(['/custom'], true),

  refine: createCommandPattern(['/refine']),
  refineWithOrder: createCommandPattern(['/refine'], true),

  completion: createCommandPattern(['/chat']),
  completionWithOrder: createCommandPattern(['/chat'], true),

  memorize: createCommandPattern(['/memorize']),
  memorizeWithOrder: createCommandPattern(['/memorize'], true),
} as const
