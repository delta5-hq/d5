import {Lang} from '.'

export const PREFIX_EN = 'You have access to the following tools:'

export const FORMAT_INSTRUCTIONS_EN = `Use the following format in your response:

Question: the original question
Thought: you must always think which action to take or give the final answer
Action: action to take, available actions are [{tool_names}]. Do not translate the name of the action or add your comments to the name
Action Input: the input to the action
Observation: the result of the action
... (this Thought/Action/Action Input/Observation can repeat N times)
Thought: Based on observations, not prior knowledge, I will give the final answer
Final Answer: the final answer to the original question. Respond with JS array of tuples of short name and dependencies if any. Dependency can be any component, element, aspect, feature, attribute, characteristic, property, trait related to the entity or the concept. You should respond with "{unknown_string}" if observation does not lead to an answer.

You must strictly follow this format. You aren't allowed to use Markdown to format your response

###EXAMPLE:
Question: What car consists of?
Thought: I don't have any observations yet, so I need to search what car consists of
Action: Search
Action Input: "car general parts"
Observation: The search result shows a list of parts that make up a car, including Engine, Transmission, Battery, Alternator, Radiator, Front Axle, Front Steering and Suspension, Brakes. The Engine is connected to fuel system, ignition system and exhaust system. Transmission consists of clutch and gearbox. Wheels have tires and attached to axle. Springs, struts and shock absorbers make up a suspension. Brakes have pads, rotors and calipers. Electrical system consists of a batter, alternator and starter motor.
Thought: Based on observations, not prior knowledge, I will give the final answer, and will interpret it into a requested format.
Final Answer: \`\`\`[
["Car", ["Engine", "Transmission", "Driveshaft", "Axle", "Suspension", "Brakes", "Steering", "Electrical System"]],
["Engine", ["Fuel System", "Ignition System", "Exhaust System"]],
["Transmission", ["Clutch", "Gearbox"]],
["Driveshaft", []],
["Axle", ["Wheels", "Tires"]],
["Suspension", ["Springs", "Struts", "Shock Absorbers"]],
["Brakes", ["Pads", "Rotors", "Calipers"]],
["Steering", []],
["Electrical System", ["Battery", "Alternator", "Starter Motor"]]
]\`\`\`
###EXAMPLE2:
Question: What car consists of?
Thought: no observations, searching for info
Action: Search
Action Input: "car general parts"
Observation: nothing useful, the statement about enabling JavaScript and cookies, workshops and mechanic courses
Thought: Based on these observations, not prior knowledge, I can't give a final answer, so I'll take next action and try another query.
Action: Search
Action Input: "car component list"
Observation: cars have engines and wheels
Thought: Based on the observations, the final answer is:
Final Answer: \`\`\`[
["Car", ["Engine", "Wheels"]]
]\`\`\``

export const SUFFIX_EN = `Begin!

Question: {input}
Thought:{agent_scratchpad}`

export const FINAL_ANSWER_ACTION_EN = 'Final Answer'

export const INPUT_REGEX_EN = /Action: ([\s\S]*?)(?:\nAction Input: ([\s\S]*?))?$/

export const UNKNOWN_STRING = 'Unknown'

export const STOP_EN = ['Observation:']

export const LLM_PREFIX_EN = 'Thought:'

export const getOutlineFormatInstructions = lang => {
  switch (lang) {
    case Lang.en:
      return FORMAT_INSTRUCTIONS_EN
    case Lang.ru:
      return FORMAT_INSTRUCTIONS_EN
    default:
      return FORMAT_INSTRUCTIONS_EN
  }
}

export const getOutlinePrefix = lang => {
  switch (lang) {
    case Lang.en:
      return PREFIX_EN
    case Lang.ru:
      return PREFIX_EN
    default:
      return PREFIX_EN
  }
}

export const getOutlineSuffix = lang => {
  switch (lang) {
    case Lang.en:
      return SUFFIX_EN
    case Lang.ru:
      return SUFFIX_EN
    default:
      return SUFFIX_EN
  }
}

export const getOutlineFinalAnswer = lang => {
  switch (lang) {
    case Lang.en:
      return FINAL_ANSWER_ACTION_EN
    case Lang.ru:
      return FINAL_ANSWER_ACTION_EN
    default:
      return FINAL_ANSWER_ACTION_EN
  }
}

export const getOutlineInputRegex = lang => {
  switch (lang) {
    case Lang.en:
      return INPUT_REGEX_EN
    case Lang.ru:
      return INPUT_REGEX_EN
    default:
      return INPUT_REGEX_EN
  }
}

export const getOutlineStop = lang => {
  switch (lang) {
    case Lang.en:
      return STOP_EN
    case Lang.ru:
      return STOP_EN
    default:
      return STOP_EN
  }
}

export const getOutlineLLMPrefix = lang => {
  switch (lang) {
    case Lang.en:
      return LLM_PREFIX_EN
    case Lang.ru:
      return LLM_PREFIX_EN
    default:
      return LLM_PREFIX_EN
  }
}
