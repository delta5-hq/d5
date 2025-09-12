import {STEPS_PREFIX_REGEX, STEPS_QUERY} from '../../constants/steps'
import {SWITCH_QUERY} from '../../constants/switch'
import {commandRegExp} from '../../constants/commandRegExp'

/**
 * StepsNodeTraverser encapsulates the traversal logic for /steps command.
 * It traverses a tree of nodes looking for command nodes, organizing them
 * by their numeric order (if specified) and collecting other command nodes separately.
 */
export class StepsNodeTraverser {
  /**
   * Creates a new StepsNodeTraverser
   * @param {Object} allNodes - Map of all nodes in the tree by ID
   */
  constructor(allNodes) {
    /**
     * Mapping of order numbers to nodes with that order
     * @type {Object.<number, Array<{node: Object, promptString: string}>>}
     */
    this.nodesByOrder = {}

    /**
     * Array of nodes without explicit order prefixes
     * @type {Array<{node: Object, promptString: string}>}
     */
    this.nodesWithoutOrder = []

    /**
     * Map of all nodes in the tree by ID
     * @type {Object}
     */
    this.allNodes = allNodes

    /**
     * The root node of the traversal, which is treated specially
     * @type {Object|null}
     */
    this.rootNode = null
  }

  /**
   * Gets the command string from a node, prioritizing command over title
   * Returns the command text only if it matches the commandRegExp.anyWithOrder pattern
   *
   * @param {Object} n - The node to extract command from
   * @returns {string} The command string if valid, otherwise empty string
   */
  getNodeCommand(n) {
    const rawCommand = n?.command || n?.title || ''
    const commandText = rawCommand ? rawCommand.trim() : ''
    return commandText.match(commandRegExp.anyWithOrder) ? commandText : ''
  }

  /**
   * Extracts the numeric order from a node's command string if present
   *
   * @param {Object} n - The node to extract order from
   * @returns {number} The numeric order if found, otherwise NaN
   */
  getNodeOrder(n) {
    const command = this.getNodeCommand(n)
    const regex = new RegExp(STEPS_PREFIX_REGEX)
    const match = command.match(regex)
    return match ? Number(match[1]) : NaN
  }

  /**
   * Checks if a command string represents a foreach command
   *
   * @param {string} command - The command string to check
   * @returns {boolean} True if the command is a foreach command, false otherwise
   */
  isForeachCommand(command) {
    return commandRegExp.foreachWithOrder.test(command)
  }

  /**
   * Checks if a node is a prompt node attached to a parent
   *
   * @param {Object} parent - The potential parent node
   * @param {Object} child - The potential child node
   * @returns {boolean} True if the child is a prompt node of the parent, false otherwise
   */
  isPromptNode(parent, child) {
    return parent.prompts?.includes(child.id) || false
  }

  /**
   * Begins traversal from a specified root node, populating nodesByOrder and nodesWithoutOrder
   *
   * @param {Object} rootNode - The node to start traversal from
   */
  traverse(rootNode) {
    this.rootNode = rootNode
    if (rootNode?.children?.length) {
      rootNode.children
        .map(id => this.allNodes[id])
        .filter(Boolean)
        .forEach(childNode => this._traverse(childNode))
    }
  }

  /**
   * Internal traverse method that processes each node and its children
   *
   * @param {Object} currentNode - Current node being processed
   * @private
   */
  _traverse(currentNode) {
    // Base case handling
    if (!currentNode) return

    const command = this.getNodeCommand(currentNode)
    const order = this.getNodeOrder(currentNode)
    const hasOrder = !Number.isNaN(order)

    // Skip foreach commands
    if (this.isForeachCommand(command)) {
      return
    }

    this._processNode(currentNode, command, order, hasOrder)
  }

  /**
   * Process node and categorize it based on its command
   *
   * @param {Object} currentNode - The node being processed
   * @param {string} command - The command string of the node
   * @param {number} order - The order number (if any)
   * @param {boolean} hasOrder - Whether the node has an order prefix
   * @private
   */
  _processNode(currentNode, command, order, hasOrder) {
    if (hasOrder) {
      // Node has a numbered command (#1, #2, etc.)
      this.nodesByOrder[order] ||= []
      this.nodesByOrder[order].push({node: currentNode, promptString: command})
    } else if (commandRegExp.any.test(command) && !commandRegExp.foreach.test(command)) {
      // Node has a regular command without order number
      this.nodesWithoutOrder.push({node: currentNode, promptString: command})
    } else {
      // Node has no command or not a recognized command, continue traversal to its children
      this._traverseChildren(currentNode)
    }
  }

  /**
   * Traverse the children of a node if certain conditions are met
   *
   * @param {Object} parentNode - The parent node whose children to traverse
   * @private
   */
  _traverseChildren(parentNode) {
    if (!parentNode?.children?.length) return

    const isSteps = Boolean(this.getNodeCommand(parentNode).match(STEPS_QUERY))
    const isSwitch = Boolean(this.getNodeCommand(parentNode).match(SWITCH_QUERY))

    // Only traverse children if this isn't a steps/switch node
    // (except for the root node)
    if (!isSteps && !isSwitch) {
      parentNode.children
        .map(id => this.allNodes[id])
        .filter(Boolean)
        .forEach(childNode => {
          if (!this.isPromptNode(parentNode, childNode)) {
            this._traverse(childNode)
          }
        })
    }
  }
}
