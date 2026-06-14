import {INITIAL_OPENAI_MODEL_NAME, OPENAI_API_KEY, OPENAI_MODELS} from '../../constants'
import Integration from '../../models/Integration'

export const createOpenaiIntegration = async userId => {
  const model = OPENAI_API_KEY ? INITIAL_OPENAI_MODEL_NAME : OPENAI_MODELS.GPT_4_1_MINI
  const filter = {userId, workflowId: null}
  const update = {$set: {userId, workflowId: null, openai: {model}}}
  await Integration.updateOne(filter, update, {upsert: true})
}
