import {AgentActionOutputParser} from 'langchain/agents'
import {
  FINAL_ANSWER_ACTION_EN,
  FORMAT_INSTRUCTIONS_EN,
  INPUT_REGEX_EN,
} from './../../../constants/localizedPrompts/JSOutliningAgentContants'

const CODE_BLOCK_REGEX = /(^```)|(```.*$)/gs
const FEW_WORDS_AFTER_REGEX = '(,?\\s+[^:\\s]+){0,5}'

export class JSOutliningAgentOutputParser extends AgentActionOutputParser {
  lc_namespace = ['langchain', 'agents', 'mrkl']

  finishToolName

  inputRegex

  constructor(fields) {
    super(fields)
    this.finishToolName = fields?.finishToolName || FINAL_ANSWER_ACTION_EN
    this.inputRegex = fields?.inputRegex || INPUT_REGEX_EN
  }

  async parse(text) {
    const finishToolRegexp = new RegExp(`${this.finishToolName}${FEW_WORDS_AFTER_REGEX}:`, 'i')
    const match = this.inputRegex.exec(text)

    if (text.match(finishToolRegexp)) {
      const parts = text.split(finishToolRegexp)
      const output = parts[parts.length - 1].trim().replace(CODE_BLOCK_REGEX, '')
      return {
        returnValues: {output},
        log: text,
      }
    }

    if (!match) {
      throw new Error(`Could not parse LLM output: ${text}`)
    }

    const punctuationRegex = /[.,/#!$%^&*;:{}=\-_`~()]/g
    const tool = match[1].trim()

    return {
      tool: tool.replace(punctuationRegex, ''),
      toolInput: match[2] ? match[2].trim().replace(/^("+)(.*?)(\1)$/, '$2') : '',
      log: text,
    }
  }

  getFormatInstructions() {
    return FORMAT_INSTRUCTIONS_EN
  }
}
