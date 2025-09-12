import {LLMChain, PromptTemplate} from 'langchain'
import {JSKnowledgeMapResultTool} from './JSKnowledgeMapResultTool'
import {
  getJSKnowledgeMapConvertInstructions,
  getJSKnowledgeMapQueryInstructions,
  JS_KNOWLEDGE_MAP_DESCRIPTION_EN,
  JS_KNOWLEDGE_MAP_NAME_EN,
} from '../../../constants/localizedPrompts/JSKnowledgeMapConstants'
import {HumanMessage} from 'langchain/schema'
import {BaseLLM} from 'langchain/llms/base'

export class JSKnowledgeMapSearch {
  result = ''

  constructor(model, options) {
    this.model = model
    this.options = options
  }

  asTool() {
    return new JSKnowledgeMapResultTool(this, {
      name: JS_KNOWLEDGE_MAP_NAME_EN,
      description: JS_KNOWLEDGE_MAP_DESCRIPTION_EN,
      func: this.getDynamicToolResult.bind(this),
    })
  }

  async getDynamicToolResult(input, runManager) {
    const result = await this.getKnowledgeMap(input, runManager)
    this.result = result
    return result
  }

  async getKnowledgeMap(input, runManager) {
    const chatOutput = await this.getLLMOutput(input)

    return this.convertOutput(chatOutput, runManager)
  }

  async getLLMOutput(input) {
    const {abortSignal, lang} = this.options

    const messsage = await PromptTemplate.fromTemplate(getJSKnowledgeMapQueryInstructions(lang)).format({input})

    let output

    if (this.model instanceof BaseLLM) {
      output = await this.model.call(messsage, {signal: abortSignal})
    } else {
      const outputMsg = await this.model.call([new HumanMessage(messsage)], {signal: abortSignal})
      output = outputMsg.content
    }

    return output
  }

  async convertOutput(output, runManager) {
    const {lang} = this.options

    return new LLMChain({
      prompt: PromptTemplate.fromTemplate(getJSKnowledgeMapConvertInstructions(lang)),
      llm: this.model,
    }).run(output, runManager?.getChild())
  }
}
