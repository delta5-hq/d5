import {TolerantArrayGrammar} from './tolerantArrayGrammar'
import Parser from './rdParse'

class Node {
  constructor(node) {
    this.node = node
  }

  toJsObject() {
    const {node} = this
    switch (node.type) {
      case 'Literal':
        return Node.literal(node)
      case 'ArrayLiteral':
        return Node.array(node)
      case 'MemberExpression':
        return Node.member(node)
      default:
        throw new Error(`Unknown AST type: ${node.type}`)
    }
  }

  static literal(obj) {
    return obj.value
  }

  static array(obj) {
    return obj.elements.map(x => new Node(x).toJsObject())
  }

  static member(obj) {
    return new Node(obj.object).toJsObject()
  }

  static fromString(str, grammar) {
    const parser = Parser(grammar)
    const ast = parser(str)
    return new Node(ast)
  }
}

function getQuoteBalance(quote, str) {
  if (quote.length !== 1) {
    return 0
  }
  const match = str.match(new RegExp(quote, 'g'))
  if (!match) {
    return 0
  }

  if (match.length % 2 === 0) {
    return 0
  }

  return str.endsWith(quote) ? 1 : -1
}

function getBracketBalance(allBracketPairs, str) {
  if (allBracketPairs.length < 2) {
    return 0
  }

  const bracketStack = []

  for (let indx = 0; indx < str.length; indx += 1) {
    const currChar = str[indx]

    const bracketPosition = allBracketPairs.indexOf(currChar)
    if (bracketPosition < 0) {
      // eslint-disable-next-line no-continue
      continue
    }

    const isCloseBracket = Boolean(bracketPosition % 2)
    if (isCloseBracket) {
      if (!bracketStack.length) {
        return str.length - indx
      }

      const lastOpenBracket = bracketStack.pop()
      if (lastOpenBracket !== allBracketPairs[bracketPosition - 1]) {
        return -1
      }
    } else {
      bracketStack.push(currChar)
    }
  }

  return -bracketStack.length
}

function restoreBalanceSafe(balanceGetter, balanceDecreaser, balanceIncreaser) {
  let balance

  let counter = 0
  while (counter < 9999) {
    counter += 1

    balance = balanceGetter()
    if (balance > 0) {
      balanceDecreaser()
    } else if (balance < 0) {
      balanceIncreaser()
    } else {
      return
    }
  }
}

function restoreQuoteBalance(quote, str) {
  if (quote.length !== 1) {
    return str
  }
  restoreBalanceSafe(
    () => getQuoteBalance(quote, str),
    () => (str = str.substring(0, str.length - 1)),
    () => (str += quote),
  )
  return str
}

function restoreBracketBalance(bracketPair, str) {
  if (bracketPair.length !== 2) {
    return str
  }
  restoreBalanceSafe(
    () => getBracketBalance(bracketPair, str),
    () => (str = str.substring(0, str.length - 1)),
    () => (str += bracketPair[1]),
  )
  return str
}

function parseBetween(str, startChar, endChar) {
  if (startChar?.length !== 1 || endChar?.length !== 1) {
    return str
  }
  const match = str.match(new RegExp(`\\${startChar}.*\\${endChar}`, 's'))
  if (!match) {
    return str
  }
  return match[0]
}

export function tolerantArrayParsing(str) {
  str = parseBetween(str, '[', ']')

  // restore balance of quotes and brackets
  str = restoreBracketBalance('[]', restoreQuoteBalance('"', str))

  // fixup missing comma ","
  const ast = Node.fromString(str, TolerantArrayGrammar)

  return ast.toJsObject()
}
