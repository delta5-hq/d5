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
})

const Integration = mongoose.model('Integration', IntegrationSchema)

export default Integration
