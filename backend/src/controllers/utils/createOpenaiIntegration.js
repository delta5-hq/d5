import {INITIAL_OPENAI_MODEL_NAME, OPENAI_API_KEY, OPENAI_MODELS} from '../../constants'
import Integration from '../../models/Integration'

export const createOpenaiIntegration = async userId => {
  let model = INITIAL_OPENAI_MODEL_NAME
  if (!OPENAI_API_KEY) {
    model = OPENAI_MODELS.GPT_4_1_MINI
  }

  const openai = {model}
  const update = {$set: {userId, openai}}
  const options = {upsert: true}
  await Integration.updateOne({userId}, update, options)
}
