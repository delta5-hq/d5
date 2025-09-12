import {
  getSimpleFinalAnswerAction,
  getSimpleFormatInstructions,
  getSimpleInputRegex,
  getSimpleLLMPrefix,
  getSimplePrefix,
  getSimpleStop,
  getSimpleSuffix,
} from '../../../constants/localizedPrompts/SimpleAgentConstants'
import {AgentExecutor} from 'langchain/agents'
import {JSOutliningAgent} from './JSOutliningAgent'
import {
  getOutlineFinalAnswer,
  getOutlineFormatInstructions,
  getOutlineInputRegex,
  getOutlineLLMPrefix,
  getOutlinePrefix,
  getOutlineStop,
  getOutlineSuffix,
} from '../../../constants/localizedPrompts/JSOutliningAgentContants'

export const createSimpleAgentExecutor = (llm, tools, lang) =>
  AgentExecutor.fromAgentAndTools({
    tags: [],
    agent: JSOutliningAgent.fromLLMAndTools(llm, tools, {
      formatInstructions: getSimpleFormatInstructions(lang),
      prefix: getSimplePrefix(lang),
      suffix: getSimpleSuffix(lang),
      finishToolName: getSimpleFinalAnswerAction(lang),
      inputRegex: getSimpleInputRegex(lang),
      llmPrefixStr: getSimpleLLMPrefix(lang),
      stopStr: getSimpleStop(lang),
    }),
    tools,
  })

export const createOutlineAgentExecutor = (llm, tools, lang) =>
  AgentExecutor.fromAgentAndTools({
    tags: [],
    agent: JSOutliningAgent.fromLLMAndTools(llm, tools, {
      formatInstructions: getOutlineFormatInstructions(lang),
      prefix: getOutlinePrefix(lang),
      suffix: getOutlineSuffix(lang),
      finishToolName: getOutlineFinalAnswer(lang),
      inputRegex: getOutlineInputRegex(lang),
      llmPrefixStr: getOutlineLLMPrefix(lang),
      stopStr: getOutlineStop(lang),
    }),
    tools,
  })
