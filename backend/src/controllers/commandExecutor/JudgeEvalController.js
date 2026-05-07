import EvalHarness from './reliability/eval/EvalHarness'
import EvalCorpusAdapter from './reliability/eval/EvalCorpusAdapter'
import {getIntegrationSettings, determineLLMType} from './commands/utils/langchain/getLLM'

const JudgeEvalController = {
  evaluate: async ctx => {
    const {userId} = ctx.state
    const {corpus: rawCorpus, generatorFamily: overrideFamily, judgeOptions = {}} = await ctx.request.json()

    const validationError = EvalCorpusAdapter.validate(rawCorpus)
    if (validationError) {
      ctx.throw(400, validationError)
    }

    const settings = await getIntegrationSettings(userId)
    const generatorFamily = overrideFamily || determineLLMType(null, settings)

    ctx.body = await EvalHarness.evaluate(EvalCorpusAdapter.adapt(rawCorpus), generatorFamily, settings, judgeOptions)
  },
}

export default JudgeEvalController
