import {LLMChain} from 'langchain'

export function sanitizeRefineOutput(str) {
  return str
    .replace(/```/g, ' ')
    .replace(/Question:/gi, ' ')
    .replace(/Original answer:/gi, ' ')
    .replace(/New (context|answer):/gi, ' ')
    .replace(/(Refined )?answer:/gi, ' ')
}

export class SearchRefineLLMChain extends LLMChain {
  _getFinalOutput(generations, promptValue, runManager) {
    const output = generations[0]?.text
    if (output) {
      generations[0].text = sanitizeRefineOutput(output)
    }

    return super._getFinalOutput(generations, promptValue, runManager)
  }
}
