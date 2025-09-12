/**
 * Validates that the input is a non-null, non-array object
 *
 * @param {any} obj
 * @returns {boolean}
 */
export const isRecord = obj => {
  return obj && typeof obj === 'object' && !Array.isArray(obj)
}

/**
 * Validate a record of NodeData objects
 *
 * @param {Record<string, NodeData>} nodes - The object containing NodeData instances to validate
 * @returns {boolean}
 * @throws {Error}
 */
export const validateNodes = nodes => {
  if (typeof nodes !== 'object' || nodes === null) {
    throw new Error('nodes must be an object')
  }

  for (const [nodeId, nodeData] of Object.entries(nodes)) {
    try {
      validateNodeData(nodeData)
    } catch (error) {
      throw new Error(`Validation failed for node with id "${nodeId}": ${error.message}`)
    }
  }

  return true
}

/**
 * Validate NodeData object
 *
 * @param {NodeData} nodeData - The NodeData object to validate
 * @returns {boolean}
 * @throws {Error}
 */
export const validateNodeData = nodeData => {
  if (typeof nodeData !== 'object' || nodeData === null) {
    throw new Error('NodeData must be an object')
  }

  const id = typeof nodeData.id === 'string' ? nodeData.id : '[unknown id]'

  if (nodeData.id && typeof nodeData.id !== 'string') {
    throw new Error(`Node "${id}": "id" is required and must be a string`)
  }

  if (nodeData.children && !Array.isArray(nodeData.children)) {
    throw new Error(`Node "${id}": "children" must be an array of strings`)
  } else if (nodeData.children && nodeData.children.some(child => typeof child !== 'string')) {
    throw new Error(`Node "${id}": each element in "children" must be a string`)
  }

  if (nodeData.image && typeof nodeData.image !== 'string') {
    throw new Error(`Node "${id}": "image" must be a string`)
  }

  if (nodeData.imagePosition && typeof nodeData.imagePosition !== 'string') {
    throw new Error(`Node "${id}": "imagePosition" must be a string`)
  }

  if (nodeData.file && typeof nodeData.file !== 'string') {
    throw new Error(`Node "${id}": "file" must be a string`)
  }

  if (nodeData.title && typeof nodeData.title !== 'string') {
    throw new Error(`Node "${id}": "title" must be a string`)
  }

  if (nodeData.parent && typeof nodeData.parent !== 'string') {
    throw new Error(`Node "${id}": "parent" must be a string`)
  }

  if (nodeData.command && typeof nodeData.command !== 'string') {
    throw new Error(`Node "${id}": "command" must be a string`)
  }

  if (nodeData.prompts && !Array.isArray(nodeData.prompts)) {
    throw new Error(`Node "${id}": "prompts" must be an array of strings`)
  } else if (nodeData.prompts && nodeData.prompts.some(prompt => typeof prompt !== 'string')) {
    throw new Error(`Node "${id}": each element in "prompts" must be a string`)
  }

  return true
}

/**
 * Validate a record of files, where each file ID is mapped to a string
 *
 * @param {Record<string, string>} files - The object containing file IDs and their corresponding content
 * @returns {boolean}
 * @throws {Error}
 */
export const validateFiles = files => {
  if (typeof files !== 'object' || files === null) {
    throw new Error('files must be an object')
  }

  for (const [fileId, fileContent] of Object.entries(files)) {
    if (typeof fileId !== 'string') {
      throw new Error(`File key "${fileId}" must be a string`)
    }

    if (typeof fileContent !== 'string') {
      throw new Error(`File path for "${fileId}" must be a string`)
    }
  }

  return true
}

/**
 * Validate EdgeData object
 *
 * @param {any} edgeData - The edge object to validate
 * @returns {boolean}
 * @throws {Error}
 */
export const validateEdgeData = edgeData => {
  if (typeof edgeData !== 'object' || edgeData === null) {
    throw new Error('Edge must be an object')
  }

  if (edgeData.id && typeof edgeData.id !== 'string') {
    throw new Error('Edge "id" is required and must be a non-empty string')
  }

  if (edgeData.start && typeof edgeData.start !== 'string') {
    throw new Error(`Edge "${edgeData.id}" has invalid "start" (must be a non-empty string)`)
  }

  if (edgeData.end && typeof edgeData.end !== 'string') {
    throw new Error(`Edge "${edgeData.id}" has invalid "end" (must be a non-empty string)`)
  }

  if (edgeData.title && typeof edgeData.title !== 'string') {
    throw new Error(`Edge "${edgeData.id}" has invalid "title" (must be a string)`)
  }

  return true
}

/**
 * Validate a record of EdgeData objects
 *
 * @param {Map<string, any> | Record<string, any>} edges - The collection of edges
 * @returns {boolean}
 * @throws {Error}
 */
export const validateEdges = edges => {
  if (typeof edges !== 'object' || edges === null) {
    throw new Error('edges must be a Workflow or an object')
  }

  for (const [edgeId, edgeData] of Object.entries(edges)) {
    try {
      validateEdgeData(edgeData)
    } catch (error) {
      throw new Error(`Validation failed for edge with id "${edgeId}": ${error.message}`)
    }
  }

  return true
}
