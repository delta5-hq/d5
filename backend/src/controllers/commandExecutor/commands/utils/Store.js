/**
 * @typedef {Object} NodeData
 * @property {string} id
 * @property {string[]} [children] - List of child node IDs
 * @property {string} [image] - Associated image ID
 * @property {string} [imagePosition] - Position of the image, must match a value from MEDIA_POSITIONS
 * @property {string} [video] - Video URL
 * @property {string} [file] - Associated file ID
 * @property {string} [title] - Title of the node
 * @property {boolean} [collapsed] - Whether the node is collapsed in the UI
 * @property {string} [color] - Background color of the node
 * @property {string} [borderColor] - Border color of the node
 * @property {number} [scale] - Visual scale factor
 * @property {string} [parent] - ID of the parent node
 * @property {number} [x] - X-coordinate for layout
 * @property {number} [y] - Y-coordinate for layout
 * @property {number} [width] - Width of the node
 * @property {number} [height] - Height of the node
 * @property {string[]} [tags] - Array of tags id
 * @property {boolean} [autoshrink=false] - Whether autoshrink behavior is enabled
 * @property {string} [command] - Command associated with the node(/chatgpt, /web e.t.c)
 * @property {string[]} [prompts] - List of prompt ids that created from command execution
 */

/**
 * @typedef {Object} EdgeData
 * @property {string} id - Unique identifier for the edge (required)
 * @property {string} [start] - ID of the starting node of the edge
 * @property {string} [end] - ID of the ending node of the edge
 * @property {string} [title] - Title or label of the edge
 */

import debug from 'debug'
import {isRecord, validateEdgeData, validateEdges, validateFiles, validateNodeData, validateNodes} from './validate'
import ImportHandler from './ImportHandler'
import {generateEdgeId, generateNodeId} from '../../../../shared/utils/generateId'

/**
 * Represents the core data store for a one full command execution
 */
class Store {
  /** @type {string} User identifier */
  _userId

  /** @type {string|undefined} Map identifier */
  _mapId

  /** @type {Record<string, NodeData>} Node map */
  _nodes = {}

  /** @type {Record<string, EdgeData>} Edge map */
  _edges = {}

  /** @type {Record<string, string>} File map (fileID to content) */
  _files = {}

  /**
   * @type {{
   *   nodes: Record<string, NodeData[]>,
   *   edges: Record<string, EdgeData[]>
   * }}
   */
  _output = {
    nodes: [],
    edges: [],
  }

  /**
   * import handler that will be able to handle pasting or uploading files and plain text
   */
  importer = new ImportHandler(this)

  /**
   * Logger function that shows logs error
   */
  logError

  /**
   * @param {Object} params - Initialization parameters
   * @param {string} params.userId - Required user ID
   * @param {string} [params.mapId] - Optional map ID
   * @param {Record<string, NodeData>} params.nodes - Node map
   * @param {Record<string, EdgeData>} params.nodes - Edge map
   * @param {Record<string, string>} params.files - File map
   *
   * @throws {Error} If any required field is missing or incorrectly typed
   */
  constructor({userId, mapId = undefined, nodes = {}, files = {}, edges = {}} = {}) {
    if (!userId) {
      throw new Error('User ID is required')
    }

    if (!isRecord(nodes) || !validateNodes(nodes)) {
      throw new Error('Nodes must be a Record<string, NodeData>')
    }

    if (!isRecord(edges) || !validateEdges(edges)) {
      throw new Error('Edges must be a Record<string, EdgeData>')
    }

    if (!isRecord(files) || !validateFiles(files)) {
      throw new Error('Files must be a Record<string, string>')
    }

    this._userId = userId
    this._mapId = mapId
    this._nodes = nodes
    this._edges = edges
    this._files = files

    this.logError = debug('delta5:app:CommandStore').extend(userId, '/').extend('ERROR*', '::')
  }

  /**
   * Generate unique node id
   *
   * @returns {string}
   */
  generateNodeId() {
    let id = generateNodeId()

    while (this._nodes[id]) {
      id = generateNodeId()
    }

    return id
  }

  /**
   * Generate unique edge id
   *
   * @returns {string}
   */
  generateEdgeId(start, end) {
    return generateEdgeId(start, end)
  }

  /**
   * Add NodeID to output object
   *
   * @param {string} id
   */
  saveNodeToOutput(id) {
    if (!this._output.nodes.includes(id)) {
      this._output.nodes.push(id)
    }
  }

  /**
   * Add EdgeID to output object
   *
   * @param {string} id
   */
  saveEdgeToOutput(id) {
    if (!this._output.edges.includes(id)) {
      this._output.edges.push(id)
    }
  }

  /**
   * Add node to store object and save to output
   *
   * @param {NodeData} node
   *
   * @returns {NodeData} Created Node
   */
  createNode(node, isPrompt = false) {
    if (!validateNodeData(node)) {
      throw new Error('Node is not valid')
    }

    let id = !node.id || this._nodes[node.id] ? this.generateNodeId() : node.id

    this._nodes[id] = {...node, id}
    this.saveNodeToOutput(id)

    // update parent node
    const parentId = this._nodes[id].parent
    const parentNode = this._nodes[parentId]
    if (parentNode) {
      const prevPrompts = parentNode.prompts ?? []

      parentNode.children ||= []
      if (!parentNode.children.includes(id)) {
        parentNode.children = [...parentNode.children, id].filter(id => !prevPrompts.includes(id))
      }

      // set to prompts
      if (isPrompt) {
        parentNode.prompts = [id]
      }
    }

    return this._nodes[id]
  }

  /**
   * Add prompts to node
   *
   * @param {string} nodeId
   * @param {string[]} promptNodes
   * @returns
   */
  addPromptsToNode(nodeId, promptNodes = []) {
    const parentNode = this._nodes[nodeId]
    if (!parentNode) return

    parentNode.prompts = []

    promptNodes.forEach(id => {
      parentNode.prompts.push(id)
    })
  }

  /**
   * Edit node from store object and save to output
   *
   * @param {NodeData} newData
   *
   * @returns {NodeData} Edited Node
   */
  editNode(newData) {
    if (!validateNodeData(newData)) {
      throw new Error('NodeData is not valid')
    }
    const {id, ...properties} = newData
    const targetNode = this._nodes[id]

    if (!targetNode) {
      return this.createNode(newData)
    }

    Object.entries(properties).forEach(([property, value]) => {
      targetNode[property] = value
    })

    this.saveNodeToOutput(id)
    return targetNode
  }

  /**
   * Add edge to store object and save to output
   *
   * @param {EdgeData} edge
   *
   * @returns {EdgeData} Created Edge
   */
  createEdge(edge) {
    if (!validateEdgeData(edge)) {
      throw new Error('Edge is not valid')
    }

    const id = edge.id || this.generateEdgeId(edge.start, edge.end)

    if (this._edges[id]) {
      throw new Error(`Edge ${id} already exists`)
    }

    this._edges[id] = {...edge, id}
    this.saveEdgeToOutput(id)

    return this._edges[id]
  }

  /**
   * Edit edge from store object and save to output
   *
   * @param {EdgeData} newData
   *
   * @returns {EdgeData} Edited Node
   */
  editEdge(newData) {
    if (!validateEdgeData(newData)) {
      throw new Error('EdgeData is not valid')
    }
    const {id, ...properties} = newData
    const targetEdge = this._edges[id]

    if (!targetEdge) {
      return this.createEdge(newData)
    }

    Object.entries(properties).forEach(([property, value]) => {
      targetEdge[property] = value
    })

    this.saveEdgeToOutput(id)
    return targetEdge
  }

  /**
   * Returns the result of executing the command
   *
   * @returns {{
   *   nodes: NodeData[],
   *   edges: EdgeData[],
   * }}
   */
  getOutput() {
    return {
      nodes: this._output.nodes.map(id => this._nodes[id]).filter(Boolean),
      edges: this._output.edges.map(id => this._edges[id]).filter(Boolean),
    }
  }

  /**
   * Returns node from store if exists
   *
   * @param {string} id
   * @returns {NodeData}
   */
  getNode(id) {
    return this._nodes[id]
  }

  /**
   * Returns edge from store if exists
   *
   * @param {string} id
   * @returns {EdgeData}
   */
  getEdge(id) {
    return this._edges[id]
  }

  /**
   * Returns file from store if exists
   *
   * @param {string} id
   * @returns {string}
   */
  getFile(id) {
    return this._files[id]
  }

  /**
   * Add file to store object
   *
   * @param {string} fileId
   * @param {string} fileContent
   */
  createFile(fileId, fileContent) {
    if (!fileId) {
      throw new Error('File ID is required')
    }

    if (fileContent && typeof fileContent === 'string') {
      this._files[fileId] = fileContent
    }
  }

  /**
   *
   * @returns {string[]}
   */
  getOrphanedNodeIds() {
    return Object.keys(this._nodes).filter(nodeId => {
      const node = this._nodes[nodeId]

      const parent = node.parent && this._nodes[node.parent]
      if (!parent) {
        return false // exception for the root node
      }

      if (!parent?.children) {
        return false // exception for the root node
      }

      if (!parent?.children.includes(nodeId)) {
        return true
      }
    })
  }

  removeOrphanedNodes() {
    const orphanedNodeIds = this.getOrphanedNodeIds()
    orphanedNodeIds.forEach(id => delete this._nodes[id])
  }

  /**
   *
   * @param {NodeData} node
   */
  orphanPromptNode(node) {
    const parentNode = this.getNode(node.parent)

    if (parentNode) this.editNode({id: parentNode.id, prompts: parentNode.prompts.filter(id => id !== node.id)})
  }

  /**
   *
   * @param {NodeData} root
   * @param {(node: NodeData) => boolean} validate
   *
   */
  orphanMatchingNodes(root, validate) {
    const stack = [...root.children]
    const traversed = new Set()

    while (stack.length > 0) {
      const current = this.getNode(stack.pop())
      // eslint-disable-next-line no-continue
      if (!current || traversed.has(current)) continue
      traversed.add(current.id)

      if (validate(current)) {
        this.orphanPromptNode(current)
      }

      current.children?.forEach(child => {
        if (!traversed.has(child)) stack.push(child)
      })
    }
  }
}

export default Store
