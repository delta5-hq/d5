import {BlockLexer, OutlinerImportPlugin} from './createNodes'
// eslint-disable-next-line no-unused-vars
import Store from './Store'

/**
 * Handles the transformation and import of text-based data into node structures
 */
class ImportHandler {
  /**
   * @type {Store}
   */
  store

  /**
   * @type {OutlinerImportPlugin}
   */
  plugin = new OutlinerImportPlugin()

  /**
   * @param {Store} store - An instance of the Store used to manage nodes
   */
  constructor(store) {
    this.store = store
  }

  /**
   * Recursively adds nodes from a given node tree
   *
   * @param {Record<string, NodeData>} nodes - A map of node ID to NodeData
   * @param {string} addNodeId - The ID of the root node to start adding from
   * @param {string} currentParentId - The ID of the parent node to attach to
   */
  addNodeTree(nodes, addNodeId, currentParentId) {
    const nodeCandidate = nodes[addNodeId]
    if (!nodeCandidate) {
      this.store.logError('Error in addNodeTree ImportHandler: Node candidate does not exist. This should not happen')
      return
    }

    this.store.createNode({...nodeCandidate, parent: currentParentId})

    nodeCandidate.children?.forEach(childId => {
      this.addNodeTree(nodes, childId, addNodeId)
    })
  }

  /**
   * Parses input text into node trees and adds them to the store
   *
   * @param {string} text - The raw text to import
   * @param {string} parentId - The parent node ID under which to import the nodes
   * @returns {Array<{root: string, nodes: Record<string, NodeData>}>} Parsed node structures
   */
  runImport(text, parentId) {
    const workflowDatas = this.plugin.transform(text)
    workflowDatas.forEach(({root, nodes}) => this.addNodeTree(nodes, root, parentId))

    return workflowDatas
  }

  /**
   * Parses text containing multiple blocks and imports each as a separate node tree
   *
   * @param {string} text - Multi-block text input
   * @param {string} parentId - The parent node ID to attach all blocks under
   */
  createNodes(text, parentId) {
    // TODO: table node?
    const lines = text ? text.split('\n\n') : []

    const newIds = []

    for (const line of lines) {
      const {text: lineText} = BlockLexer.lex(line)

      const workflowData = this.runImport(lineText, parentId)

      workflowData.forEach(({root}) => newIds.push(root))
    }

    this.store.addPromptsToNode(parentId, newIds)
  }

  /**
   * Creates a table node from given text input
   *
   * @param {string} text - Text input expected to contain a table structure
   * @param {string} parentId - The parent node ID to attach the table node under
   */
  createTable(text, parentId) {
    const {gridOptions} = BlockLexer.lex(text)

    this.store.createNode({parent: parentId, gridOptions}, true)
  }

  /**
   * Creates a join node from given text input
   *
   * @param {string} text - Text input
   * @param {string} parentId - The parent node ID to attach node under
   */
  createJoinNode(text, parentId) {
    this.store.createNode({parent: parentId, title: text}, true)
  }
}

export default ImportHandler
