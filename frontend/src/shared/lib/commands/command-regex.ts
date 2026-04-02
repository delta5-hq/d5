import { STEP_PREFIX_REGEX, SUPPORTED_COMMANDS, type CommandQuery } from './command-constants'

function createCommandPattern(commandPrefix: CommandQuery | readonly CommandQuery[], withOrder = false): RegExp {
  const prefixPattern = Array.isArray(commandPrefix) ? commandPrefix.join('|') : commandPrefix

  const orderPart = withOrder ? `(?:${STEP_PREFIX_REGEX}\\s+)?` : ''
  return new RegExp(`^\\s*${orderPart}(${prefixPattern})(\\s+|$)`, '')
}

export const commandRegex = {
  get any(): RegExp {
    return createCommandPattern(SUPPORTED_COMMANDS)
  },

  get anyWithOrder(): RegExp {
    return createCommandPattern(SUPPORTED_COMMANDS, true)
  },

  yandex: createCommandPattern('/yandexgpt'),
  yandexWithOrder: createCommandPattern('/yandexgpt', true),

  web: createCommandPattern('/web'),
  webWithOrder: createCommandPattern('/web', true),

  scholar: createCommandPattern('/scholar'),
  scholarWithOrder: createCommandPattern('/scholar', true),

  outline: createCommandPattern('/outline'),
  outlineWithOrder: createCommandPattern('/outline', true),

  ext: createCommandPattern('/ext'),
  extWithOrder: createCommandPattern('/ext', true),

  steps: createCommandPattern('/steps'),
  stepsWithOrder: createCommandPattern('/steps', true),

  summarize: createCommandPattern('/summarize'),
  summarizeWithOrder: createCommandPattern('/summarize', true),

  foreach: createCommandPattern('/foreach'),
  foreachWithOrder: createCommandPattern('/foreach', true),

  chatgpt: createCommandPattern('/chatgpt'),
  chatgptWithOrder: createCommandPattern('/chatgpt', true),

  switch: createCommandPattern('/switch'),
  switchWithOrder: createCommandPattern('/switch', true),

  case: createCommandPattern('/case'),
  caseWithOrder: createCommandPattern('/case', true),

  claude: createCommandPattern('/claude'),
  claudeWithOrder: createCommandPattern('/claude', true),

  qwen: createCommandPattern('/qwen'),
  qwenWithOrder: createCommandPattern('/qwen', true),

  perplexity: createCommandPattern('/perplexity'),
  perplexityWithOrder: createCommandPattern('/perplexity', true),

  download: createCommandPattern('/download'),
  downloadWithOrder: createCommandPattern('/download', true),

  deepseek: createCommandPattern('/deepseek'),
  deepseekWithOrder: createCommandPattern('/deepseek', true),

  customLLMChat: createCommandPattern('/custom'),
  customLLMChatWithOrder: createCommandPattern('/custom', true),

  refine: createCommandPattern('/refine'),
  refineWithOrder: createCommandPattern('/refine', true),

  completion: createCommandPattern('/chat'),
  completionWithOrder: createCommandPattern('/chat', true),

  memorize: createCommandPattern('/memorize'),
  memorizeWithOrder: createCommandPattern('/memorize', true),
} as const
