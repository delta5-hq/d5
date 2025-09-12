import generateId from '../../shared/utils/generateId'

/**
 * @typedef {Object} ProgressReporterOptions
 * @property {string} title - The title of the reporter
 * @property {(message: string) => void} [log] - Logging function
 * @property {number} [outputInterval] - Optional interval (ms) for periodic logging. Only used for the root reporter
 */

class ProgressReporter {
  /**
   * @param {ProgressReporterOptions} options
   * @param {ProgressReporter} [parent]
   */
  constructor(options, parent) {
    this.title = options.title
    this.children = new Map()
    this.counts = new Map()
    this.logFn = options.log || console.log
    this.parent = parent
    this.isRoot = !parent

    if (this.isRoot) {
      this.interval = setInterval(() => this.output(), options.outputInterval ?? 60000)
    }

    if (parent) {
      parent.registerChild(this.title, this)
    }
  }

  /**
   * Register a child reporter
   * @param {string} name
   * @param {ProgressReporter} reporter
   */
  registerChild(name, reporter) {
    this.children.set(`${name}:${generateId}`, reporter)
  }

  /**
   * Start tracking a labeled operation
   * @param {string} label
   * @returns {Promise<string>} Operation ID
   */
  add(label) {
    const count = this.counts.get(label) || 0
    this.counts.set(label, count + 1)

    return label
  }

  /**
   * Stop tracking a labeled operation
   * @param {string} label
   */
  remove(label) {
    const count = this.counts.get(label) || 0
    if (count <= 1) {
      this.counts.delete(label)
    } else {
      this.counts.set(label, count - 1)
    }
  }

  /**
   * Render the current state of this reporter and its children as a string
   * @param {number} [indent=0]
   * @returns {string}
   */
  render(indent = 0) {
    const pad = '  '.repeat(indent)
    const lines = []

    lines.push(`${pad}'${this.title}' reporter:`)

    for (const [label, count] of this.counts.entries()) {
      lines.push(`${pad}  ${label}${count > 1 ? ` (${count})` : ''}`)
    }

    for (const child of this.children.values()) {
      lines.push(child.render(indent + 1))
    }

    return lines.join('\n')
  }

  /**
   * Output the full hierarchy of in-progress operations to the log
   */
  output() {
    const output = this.render()
    if (output.trim()) {
      this.logFn(`Execute API hierarchy of unfinished operations:\n${output}`)
    }
  }

  /**
   * Dispose of the reporter and clean up any timers
   */
  dispose() {
    if (this.interval) {
      clearInterval(this.interval)
    }
  }
}

export default ProgressReporter
