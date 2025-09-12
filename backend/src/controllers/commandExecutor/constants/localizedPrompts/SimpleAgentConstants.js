import {INPUT_REGEX_EN, Lang} from './index'

export const PREFIX_EN = 'Answer the following questions as best you can. You have access to the following tools:'
export const FORMAT_INSTRUCTIONS_EN = `Use the following format in your response:

Question: the input question you must answer
Thought: you should always think about what to do, ensuring to maintain all relevant details and structure from observations
Action: the action to take, should be one of [{tool_names}]. Do not translate the name of the action or add your comments to the name
Action Input: the input to the action
Observation: the result of the action, containing potentially detailed and structured information
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: I now know the final answer
Final Answer: the final answer to the original input question, preserving all relevant details and structure from observations without unnecessary consolidation`

export const SUFFIX_EN = 'Begin!\n\nQuestion: {input}\nThought:{agent_scratchpad}'
export const FINAL_ANSWER_ACTION_EN = 'Final Answer'

export const STOP_EN = ['Observation:']

export const LLM_PREFIX_EN = 'Thought:'

export const getSimplePrefix = lang => {
  switch (lang) {
    case Lang.en:
      return PREFIX_EN
    case Lang.ru:
      return PREFIX_EN
    default:
      return PREFIX_EN
  }
}

export const getSimpleSuffix = lang => {
  switch (lang) {
    case Lang.en:
      return SUFFIX_EN
    case Lang.ru:
      return SUFFIX_EN
    default:
      return SUFFIX_EN
  }
}

export const getSimpleFormatInstructions = lang => {
  switch (lang) {
    case Lang.en:
      return FORMAT_INSTRUCTIONS_EN
    case Lang.ru:
      return FORMAT_INSTRUCTIONS_EN
    default:
      return FORMAT_INSTRUCTIONS_EN
  }
}

export const getSimpleFinalAnswerAction = lang => {
  switch (lang) {
    case Lang.en:
      return FINAL_ANSWER_ACTION_EN
    case Lang.ru:
      return FINAL_ANSWER_ACTION_EN
    default:
      return FINAL_ANSWER_ACTION_EN
  }
}

export const getSimpleInputRegex = lang => {
  switch (lang) {
    case Lang.en:
      return INPUT_REGEX_EN
    case Lang.ru:
      return INPUT_REGEX_EN
    default:
      return INPUT_REGEX_EN
  }
}

export const getSimpleStop = lang => {
  switch (lang) {
    case Lang.en:
      return STOP_EN
    case Lang.ru:
      return STOP_EN
    default:
      return STOP_EN
  }
}

export const getSimpleLLMPrefix = lang => {
  switch (lang) {
    case Lang.en:
      return LLM_PREFIX_EN
    case Lang.ru:
      return LLM_PREFIX_EN
    default:
      return LLM_PREFIX_EN
  }
}
