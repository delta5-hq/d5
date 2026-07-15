export const BUILTIN_COMMANDS = [
  {
    alias: '/instruct',
    queryType: 'chat',
    description: 'Invokes the Default LLM (instruction-style entry point)',
  },
  {
    alias: '/reason',
    queryType: 'chat',
    description: 'Invokes the Default LLM (reasoning-style entry point)',
  },
  {
    alias: '/chatgpt',
    queryType: 'chat',
    description: 'Invokes the Default LLM via the OpenAI-compatible endpoint',
  },
  {
    alias: '/chat',
    queryType: 'chat',
    description: 'Invokes the Default LLM configured in Settings → Default Model',
  },
  {
    alias: '/web',
    queryType: 'web',
    description: 'Search and summarize web pages via SerpAPI',
  },
  {
    alias: '/scholar',
    queryType: 'scholar',
    description: 'Search and summarize academic papers via SerpAPI Scholar',
  },
  {
    alias: '/refine',
    queryType: 'refine',
    description: 'Iteratively improve text through multiple LLM passes',
  },
  {
    alias: '/validate',
    queryType: 'validate',
    description: 'Validate parent node content against a criterion',
  },
  {
    alias: '/foreach',
    queryType: 'foreach',
    description: 'Run a command on each child node, substituting @@ with its content',
  },
  {
    alias: '/steps',
    queryType: 'steps',
    description: 'Execute a sequence of ordered child-node commands',
  },
  {
    alias: '/outline',
    queryType: 'outline',
    description: 'Generate a structured hierarchical outline from web or knowledge base',
  },
  {
    alias: '/summarize',
    queryType: 'summarize',
    description: 'Summarize child node content using the Default LLM',
  },
  {
    alias: '/switch',
    queryType: 'switch',
    description: 'Route execution to child nodes based on conditional logic',
  },
  {
    alias: '/case',
    queryType: 'switch',
    description: 'Define a match branch inside a /switch flow',
  },
  {
    alias: '/claude',
    queryType: 'claude',
    description: 'Invoke Claude AI model directly',
  },
  {
    alias: '/qwen',
    queryType: 'qwen',
    description: 'Invoke Qwen AI model directly',
  },
  {
    alias: '/perplexity',
    queryType: 'perplexity',
    description: 'Invoke Perplexity AI model directly',
  },
  {
    alias: '/deepseek',
    queryType: 'deepseek',
    description: 'Invoke DeepSeek AI model directly',
  },
  {
    alias: '/custom',
    queryType: 'custom_llm',
    description: 'Invoke a custom LLM endpoint configured in Settings',
  },
  {
    alias: '/memorize',
    queryType: 'memorize',
    description: 'Store text into the knowledge base as vector embeddings',
  },
  {
    alias: '/mcp',
    queryType: 'mcp-fusion',
    description: 'Run an AI agent across all configured MCP integrations — picks the best tools automatically',
  },
  {
    alias: '/ext',
    queryType: 'ext',
    description: 'Query the knowledge base with LLM synthesis',
  },
  {
    alias: '/yandexgpt',
    queryType: 'yandex',
    description: 'Invoke YandexGPT model directly',
  },
  {
    alias: '/download',
    queryType: 'download',
    description: 'Download a file from a URL',
  },
] as const

export const BUILTIN_COMMAND_ALIASES = BUILTIN_COMMANDS.map(command => command.alias)
