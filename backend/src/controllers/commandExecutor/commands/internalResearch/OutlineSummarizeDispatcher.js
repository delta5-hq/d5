import debug from 'debug'
import {SummarizeCommand} from '../SummarizeCommand'
import {tolerantArrayParsing} from '../utils/tolerantArrayParsing'
import {createTree} from '../utils/createTree'
import {runWithErrorNode} from '../shared/runWithErrorNode'
import {getNodeCommand} from '../utils/isCommand'
import {readEmbedParam} from '../../constants/summarize'
import {readSummarizeParam} from '../../constants/outline'
import {substituteReferencesAndHashrefsChildrenAndSelf} from '../references/substitution'

const log = debug('delta5:app:Command:internalResearch:OutlineSummarizeDispatcher')

const buildTree = llmOutput => {
  try {
    return createTree(tolerantArrayParsing(llmOutput))
  } catch {
    return undefined
  }
}

export const dispatchOutlineSummarize = async (cell, store, signal) => {
  const logError = log.extend('ERROR*', '::')
  await runWithErrorNode(store, cell, logError, async () => {
    const nodeCommand = getNodeCommand(cell)
    const prompt = substituteReferencesAndHashrefsChildrenAndSelf(store.getNode(cell.id), store)
    const summarize = new SummarizeCommand(store._userId, store._workflowId, store)
    const answer = await summarize.replyDefault(cell, nodeCommand, prompt, {
      sizeLabel: readEmbedParam(prompt) || readSummarizeParam(prompt),
      structured: true,
      signal,
    })
    const tree = buildTree(answer)
    store.importer.createNodes(tree || answer, cell.id)
  })
}
