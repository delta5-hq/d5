import {LLMChain, PromptTemplate} from 'langchain'
import {ZeroShotAgent} from 'langchain/agents'
import {renderTemplate} from 'langchain/prompts'
import {
  FORMAT_INSTRUCTIONS_EN,
  LLM_PREFIX_EN,
  PREFIX_EN,
  STOP_EN,
  SUFFIX_EN,
  UNKNOWN_STRING,
} from './../../../constants/localizedPrompts/JSOutliningAgentContants'
import {JSOutliningAgentOutputParser} from './JSOutliningAgentOutputParser'

export class JSOutliningAgent extends ZeroShotAgent {
  llmPrefixStr

  stopStr

  constructor(input) {
    super({...input})

    this.llmPrefixStr = input.llmPrefixStr || LLM_PREFIX_EN
    this.stopStr = input.stopStr || STOP_EN
  }

  llmPrefix() {
    return this.llmPrefixStr
  }

  _stop() {
    return this.stopStr
  }

  static createPrompt(tools, args) {
    const {
      prefix = PREFIX_EN,
      suffix = SUFFIX_EN,
      inputVariables = ['input', 'agent_scratchpad'],
      formatInstructions = FORMAT_INSTRUCTIONS_EN,
      unknownString = UNKNOWN_STRING,
    } = args || {}

    const toolStrings = tools.map(tool => `${tool.name}: ${tool.description}`).join('\n')

    const toolNames = tools.map(tool => tool.name)
    const formattedInstructions = renderTemplate(formatInstructions, 'f-string', {
      tool_names: toolNames,
      unknown_string: unknownString,
    })

    const template = [prefix, toolStrings, formattedInstructions, suffix].join('\n\n')

    return new PromptTemplate({
      template,
      inputVariables,
    })
  }

  static getDefaultOutputParser(fields) {
    return new JSOutliningAgentOutputParser(fields)
  }

  static fromLLMAndTools(llm, tools, args) {
    ZeroShotAgent.validateTools(tools)
    const prompt = JSOutliningAgent.createPrompt(tools, args)
    const outputParser = args?.outputParser ?? JSOutliningAgent.getDefaultOutputParser(args)
    const chain = new LLMChain({
      prompt,
      llm,
      callbacks: args?.callbacks ?? args?.callbackManager,
    })
    return new JSOutliningAgent({
      llmChain: chain,
      outputParser,
      llmPrefixStr: args?.llmPrefixStr,
      stopStr: args?.stopStr,
    })
  }
}
