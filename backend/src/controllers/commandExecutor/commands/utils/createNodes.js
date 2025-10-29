import {generateNodeId} from '../../../../shared/utils/generateId'

const linesToNodes = groupedLines => {
  let lastNode
  const parentInLevel = []
  const spacesInLevel = []

  return groupedLines.reduce((result, line) => {
    let currentSpaces = 0
    for (let i = 0; i < line.length; i += 1) {
      if (line[i] === ' ') {
        currentSpaces += 1
      } else {
        break
      }
    }
    const title = line.slice(currentSpaces)
    const id = generateNodeId()

    if (!lastNode) {
      result.root = id
      result.nodes = {
        [id]: {
          id,
          title,
          children: [],
        },
      }
      spacesInLevel.push(currentSpaces)
      parentInLevel.push(id)
    } else {
      const spacesInCurrentLevel = spacesInLevel.reduce((acc, v) => acc + v, 0)
      if (currentSpaces === spacesInCurrentLevel) {
        // same level as before, nothing to be done
      } else if (currentSpaces > spacesInCurrentLevel) {
        // new sublevel
        parentInLevel.push(result.nodes[lastNode].id)
        spacesInLevel.push(currentSpaces - spacesInCurrentLevel)
      } else if (currentSpaces < spacesInCurrentLevel) {
        // back to a previous parent, maybe we jump several lines back
        for (let i = 0; i < spacesInLevel.length; i += 1) {
          spacesInLevel.pop()
          parentInLevel.pop()
          if (currentSpaces >= spacesInLevel.reduce((acc, v) => acc + v, 0)) {
            break
          }
        }
      }
      const parent = parentInLevel[parentInLevel.length - 1]

      if (!parent) {
        // this should not happen
        throw new Error('Could not determine last parent')
      }

      result.nodes[id] = {
        id,
        title,
        parent,
        children: [],
      }
      result.nodes[parent].children?.push(id)
    }
    lastNode = id

    return result
  }, {})
}

export class OutlinerImportPlugin {
  fileExtensions = ['txt']

  mimeTypes = ['text/plain']

  transform = text => {
    const lines = text.split('\n')

    return lines
      .map(s => s.replaceAll('\r', '').replaceAll('\t', '    '))
      .filter(s => !/^[\s]*$/.test(s))
      .reduce((groups, line) => {
        if (!line.startsWith(' ') || !groups[0]) {
          groups.push([])
        }

        groups[groups.length - 1].push(line)

        return groups
      }, [])
      .map(linesToNodes)
  }
}

export class BlockLexer {
  static rulesBase

  static rulesTables

  rules

  text = ''

  gridOptions

  constructor(staticThis) {
    this.rules = staticThis.getRulesTable()
  }

  /**
   * Accepts Markdown text and returns object with tokens and links.
   *
   * @param src String of markdown source to be compiled.
   */
  static lex(src) {
    src = src
      .replace(/\r\n|\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/\u00a0/g, ' ')
      .replace(/\u2424/g, '\n')
      .replace(/^ +$/gm, '')

    const lexer = new this(this)
    return lexer.getTokens(src)
  }

  static getRulesBase() {
    if (this.rulesBase) {
      return this.rulesBase
    }

    const base = {
      newline: /^\n+/,
      text: /^[^\n]+/,
    }

    return (this.rulesBase = base)
  }

  static getRulesTable() {
    if (this.rulesTables) {
      return this.rulesTables
    }

    return (this.rulesTables = {
      ...this.getRulesBase(),
      ...{
        nptable: /^ *(\S.*\|.*)\n *([-:]+ *\|[-| :]*)\n((?:.*\|.*(?:\n|$))*)\n*/,
        table: /^ *\|(.+)\n *\|( *[-:]+[-| :]*)\n((?: *\|.*(?:\n|$))*)\n*/,
      },
    })
  }

  /**
   * Lexing.
   */
  getTokens(src) {
    let nextPart = src
    let execArr
    while (nextPart) {
      // newline
      if ((execArr = this.rules.newline.exec(nextPart))) {
        nextPart = nextPart.substring(execArr[0].length)
        this.text += execArr[0]
      }

      // table no leading pipe (gfm)
      if ((execArr = this.rules.nptable.exec(nextPart))) {
        nextPart = nextPart.substring(execArr[0].length)
        const gridOptions = {
          columnDefs: execArr[1]
            .replace(/^ *| *\| *$/g, '')
            .split(/ *\| */)
            .map(x => ({field: x})),
          rowData: [],
        }

        const rows = execArr[3].replace(/\n$/, '').split('\n')
        if (gridOptions.columnDefs && gridOptions.rowData)
          for (let i = 0; i < rows.length; i += 1) {
            const td = rows[i].split(/ *\| */)
            if (gridOptions.columnDefs.length === td.length) {
              gridOptions.rowData[i] = Object.fromEntries(gridOptions.columnDefs.map((x, j) => [x.field, td[j]]))
            }
          }
        this.gridOptions = gridOptions
      }

      // table (gfm)
      if ((execArr = this.rules.table.exec(nextPart))) {
        nextPart = nextPart.substring(execArr[0].length)

        const gridOptions = {
          columnDefs: execArr[1]
            .replace(/^ *| *\| *$/g, '')
            .split(/ *\| */)
            .map(x => ({field: x})),
          rowData: [],
        }

        const rows = execArr[3].replace(/(?: *\| *)?\n$/, '').split('\n')

        if (gridOptions.columnDefs && gridOptions.rowData)
          for (let i = 0; i < rows.length; i += 1) {
            const td = rows[i].replace(/^ *\| *| *\| *$/g, '').split(/ *\| */)
            if (gridOptions.columnDefs.length === td.length) {
              gridOptions.rowData[i] = Object.fromEntries(gridOptions.columnDefs.map((x, j) => [x.field, td[j]]))
            }
          }
        this.gridOptions = gridOptions
      }

      // text
      // Top-level should never reach here.
      if ((execArr = this.rules.text.exec(nextPart))) {
        nextPart = nextPart.substring(execArr[0].length)
        this.text += execArr[0]
        continue
      }

      if (nextPart) {
        throw new Error(`Infinite loop on byte: ${nextPart.charCodeAt(0)}, near text '${nextPart.slice(0, 30)}...'`)
      }
    }

    return {text: this.text, gridOptions: this.gridOptions}
  }
}

const addNodeTree = (nodes, addNodeId, currentParentId, array = []) => {
  const nodeCandidate = nodes[addNodeId]

  array.push({...nodeCandidate, parent: currentParentId})

  nodeCandidate.children?.forEach(childId => {
    addNodeTree(nodes, childId, addNodeId, array)
  })
}

export const createNodes = async (text, parentNodeId) => {
  const plugin = new OutlinerImportPlugin()
  const nodes = []

  const lines = text ? text.split('\n\n') : []

  for (const line of lines) {
    const {text, gridOptions} = BlockLexer.lex(line)

    const workflowDatas = await plugin.transform(text)
    const newNodes = []

    workflowDatas.forEach(({root, nodes}) => addNodeTree(nodes, root, parentNodeId, newNodes))

    if (gridOptions) {
      const node = newNodes[newNodes.length - 1]
      if (node) {
        node.gridOptions = gridOptions
      } else {
        newNodes.push({id: generateNodeId(), parent: parentNodeId, gridOptions})
      }
    }

    if (newNodes.length) {
      nodes.push(...newNodes)
    }
  }

  return nodes
}

export const createJoinNode = (text, parentNodeId) => ({
  id: generateNodeId(),
  parent: parentNodeId,
  title: text,
})

export const createTableNode = (text, parentNodeId) => {
  const {gridOptions} = BlockLexer.lex(text)
  return {
    id: generateNodeId(),
    parent: parentNodeId,
    gridOptions,
  }
}
