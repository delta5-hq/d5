import mongoose from 'mongoose'

import createSchema from './utils/createSchema'

const Openai = createSchema(
  {
    apiKey: String,
    model: String,
    user: String,
    suffix: String,
  },
  {_id: false, timestamps: false},
)

const Google = createSchema(
  {
    drive: Boolean,
  },
  {
    _id: false,
    timestamps: false,
  },
)

const Yandex = createSchema(
  {
    apiKey: String,
    folder_id: String,
    model: String,
  },
  {
    _id: false,
    timestamps: false,
  },
)

const Claude = createSchema(
  {
    apiKey: String,
    model: String,
  },
  {_id: false, timestamps: false},
)

const Perplexity = createSchema(
  {
    apiKey: String,
    model: String,
  },
  {_id: false, timestamps: false},
)

const Qwen = createSchema(
  {
    apiKey: String,
    model: String,
  },
  {_id: false, timestamps: false},
)

const Deepseek = createSchema(
  {
    apiKey: String,
    model: String,
  },
  {_id: false, timestamps: false},
)

const CustomLLM = createSchema(
  {
    apiRootUrl: String,
    maxTokens: Number,
    embeddingsChunkSize: Number,
    apiType: String,
    apiKey: {
      type: String,
      required: false,
    },
  },
  {_id: false, timestamps: false},
)

const MCPIntegration = createSchema(
  {
    alias: {type: String, required: true},
    serverUrl: {type: String},
    transport: {type: String, required: true, enum: ['streamable-http', 'stdio']},
    toolName: {type: String, required: true},
    toolInputField: {type: String, default: 'prompt'},
    toolStaticArgs: {type: mongoose.Schema.Types.Mixed},
    headers: {type: mongoose.Schema.Types.Mixed},
    description: String,
    timeoutMs: {type: Number, min: 5000, max: 3_600_000},
    command: {type: String},
    args: {type: [String]},
    env: {type: mongoose.Schema.Types.Mixed},
  },
  {_id: false, timestamps: false},
)

const RPCIntegration = createSchema(
  {
    alias: {type: String, required: true},
    protocol: {type: String, required: true, enum: ['ssh', 'http', 'acp-local']},
    description: String,
    timeoutMs: {type: Number, min: 5000, max: 7_200_000},
    host: String,
    port: {type: Number, default: 22},
    username: String,
    privateKey: String,
    passphrase: String,
    commandTemplate: String,
    workingDir: String,
    url: String,
    method: {type: String, default: 'POST', enum: ['GET', 'POST', 'PUT']},
    headers: {type: mongoose.Schema.Types.Mixed},
    bodyTemplate: String,
    outputFormat: {type: String, default: 'text', enum: ['text', 'json']},
    outputField: String,
    sessionIdField: {type: String, default: 'session_id'},
    lastSessionId: String,
    command: String,
    args: [String],
    env: {type: mongoose.Schema.Types.Mixed},
    autoApprove: {type: String, enum: ['all', 'none', 'whitelist'], default: 'none'},
    allowedTools: [String],
  },
  {_id: false, timestamps: false},
)

const IntegrationSchema = createSchema({
  userId: {type: String, required: true, index: true},
  openai: Openai,
  google: Google,
  yandex: Yandex,
  claude: Claude,
  qwen: Qwen,
  deepseek: Deepseek,
  custom_llm: CustomLLM,
  lang: {type: String, default: 'none'},
  model: {type: String, default: 'auto'},
  perplexity: Perplexity,
  mcp: [MCPIntegration],
  rpc: [RPCIntegration],
})

export const INTEGRATION_ENCRYPTION_CONFIG = {
  fields: [
    'openai.apiKey',
    'yandex.apiKey',
    'claude.apiKey',
    'perplexity.apiKey',
    'qwen.apiKey',
    'deepseek.apiKey',
    'custom_llm.apiKey',
  ],
  arrayFields: {
    rpc: ['privateKey', 'passphrase'],
  },
}

const Integration = mongoose.model('Integration', IntegrationSchema)

export default Integration
