import {
  getSimpleFinalAnswerAction,
  getSimpleFormatInstructions,
  getSimpleInputRegex,
  getSimpleLLMPrefix,
  getSimplePrefix,
  getSimpleStop,
  getSimpleSuffix,
} from '../../../constants/localizedPrompts/SimpleAgentConstants'
import {AgentExecutor, createToolCallingAgent} from '@langchain/classic/agents'
import {ChatPromptTemplate} from '@langchain/core/prompts'
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

const MCP_AGENT_PROMPT = ChatPromptTemplate.fromMessages([
  ['system', 'You are a helpful assistant with access to tools. Use the tools to fulfill the user request.'],
  ['human', '{input}'],
  ['placeholder', '{agent_scratchpad}'],
])

export const createMCPAgentExecutor = (llm, tools) => {
  if (typeof llm.bindTools === 'function') {
    const agent = createToolCallingAgent({llm, tools, prompt: MCP_AGENT_PROMPT})
    return new AgentExecutor({agent, tools, maxIterations: 5})
  }
  return createSimpleAgentExecutor(llm, tools)
}
