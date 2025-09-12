import mongoose from 'mongoose'

const MemoryVectorSchema = new mongoose.Schema({
  content: {type: String, required: true},
  embedding: {
    type: [Number],
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
})

const LLMVectorSchema = new mongoose.Schema({
  userId: {type: String, required: true, index: true},
  name: {type: String, required: false},
  store: {
    type: Map,
    of: {
      type: Map,
      of: [MemoryVectorSchema],
    },
  },
})

const LLMVector = mongoose.model('LLMVector', LLMVectorSchema)

export default LLMVector
