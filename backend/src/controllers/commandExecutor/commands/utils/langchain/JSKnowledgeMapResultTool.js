import {DynamicTool} from 'langchain/tools'

export class JSKnowledgeMapResultTool extends DynamicTool {
  constructor(parent, fields) {
    super(fields)

    this.parent = parent
  }

  get result() {
    return this.parent.result
  }
}
