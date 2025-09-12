import Store from '../utils/Store'
import {
  substituteReferencesAndHashrefsChildrenAndSelf,
  substituteReferences,
  indentedText,
  substituteHashrefs,
  substituteAllHashrefs,
  substituteHashrefsChildrenAndSelf,
  substituteReferencesAndHashrefsSelf,
} from './substitution'

const createMockEdge = edgeData => ({
  id: `${edgeData.start}:${edgeData.end}`,
  ...edgeData,
})

describe('Basic reference handling', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should return unchanged string when no references exist', () => {
    const node1 = {title: 'Title text', command: 'Title text', depth: 1, id: 'node1'}
    mockStore._nodes = {node1}

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node1, mockStore)).toBe('Title text')
    expect(substituteReferences(node1.command || '', 0, mockStore)).toBe('Title text')
  })

  it('should strip single references without substitution', () => {
    const node1 = {title: 'Title @ref text', command: 'Title @ref text', depth: 1, id: 'node1'}
    mockStore._nodes = {node1}

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node1, mockStore)).toBe('Title  text')
    expect(substituteReferences(node1.command || '', 0, mockStore)).toBe('Title  text')
  })

  it('should handle text with no references', () => {
    mockStore._nodes = {}

    expect(substituteReferences('No references here', 0, mockStore)).toBe('No references here')
    expect(substituteReferences('No\nreferences\nhere', 0, mockStore)).toBe('No\nreferences\nhere')
    expect(substituteReferences('No\n  references\n   here', 0, mockStore)).toBe('No\n  references\n   here')
  })

  it('should remove reference markers when reference not found', () => {
    mockStore._nodes = {}
    expect(substituteReferences('Contains @@nonexistent reference', 0, mockStore)).toBe('Contains  reference')
  })
})

describe('Simple reference substitution', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should substitute basic references between nodes', () => {
    const node1 = {title: 'pre-query @ref post-query', command: 'pre-query @ref post-query', depth: 1, id: 'node1'}
    const node2 = {title: 'prefix @@ref postfix', command: 'prefix @@ref postfix', depth: 1, id: 'node2'}
    mockStore._nodes = {
      node1,
      node2,
    }

    const expected = 'prefix pre-query  post-query\npostfix'
    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe(expected)
    expect(substituteReferences(node2.command || '', 0, mockStore)).toBe(expected)
  })

  it('should handle references at start and end of string', () => {
    const childNode = {title: 'Child content', depth: 2, id: 'child'}
    const refNode = {
      title: '@refname Referenced content',
      depth: 1,
      id: 'refnode',
      children: [childNode.id],
    }

    mockStore._nodes = {
      [refNode.id]: refNode,
      [childNode.id]: childNode,
    }

    // Reference at start
    expect(substituteReferences('@@refname at start', 0, mockStore)).toBe(
      '  Referenced content\n  Child content\nat start',
    )

    // Reference at end
    expect(substituteReferences('At end is @@refname', 0, mockStore)).toBe(
      'At end is  Referenced content\n  Child content',
    )
  })

  it('should handle multiple references in one string', () => {
    const childNode = {title: 'Child content', depth: 2, id: 'child'}
    const refNode = {
      title: '@refname Referenced content',
      depth: 1,
      id: 'refnode',
      children: [childNode.id],
    }

    mockStore._nodes = {
      [refNode.id]: refNode,
      [childNode.id]: childNode,
    }

    expect(substituteReferences('First @@refname and then @@refname again', 0, mockStore)).toBe(
      'First  Referenced content\n  Child content\nand then  again',
    )
  })

  it('should respect indentation in the output', () => {
    const childNode = {title: 'Child content', depth: 2, id: 'child'}
    const refNode = {
      title: '@refname Referenced content',
      depth: 1,
      id: 'refnode',
      children: [childNode.id],
    }

    mockStore._nodes = {
      [refNode.id]: refNode,
      [childNode.id]: childNode,
    }

    const result = substituteReferences('Indented:\n  @@refname', 2, mockStore)
    expect(result).toBe('Indented:  Referenced content\n      Child content')
  })
})

describe('Command node and child references', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should substitute children nodes when referencing command node', () => {
    const childNode1 = {title: 'Abcd', depth: 2, id: 'childNode1'}
    const node1 = {
      title: '/chatgpt pre-query @ref post-query',
      command: '/chatgpt pre-query @ref post-query',
      depth: 1,
      id: 'node1',
      children: [childNode1.id],
    }
    const node2 = {title: 'prefix @@ref postfix', depth: 1, id: 'node2'}
    mockStore._nodes = {
      node1,
      node2,
      childNode1,
    }

    const expected = 'prefix\n  Abcd\npostfix'
    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe(expected)
    expect(substituteReferences('prefix @@ref postfix', 0, mockStore)).toBe(expected)
  })

  it('should preserve both nodes children when substituting references', () => {
    const childNode1 = {title: 'Abcd', depth: 2, id: 'childNode1'}
    const node1 = {
      title: '/chatgpt pre-query @ref post-query',
      command: '/chatgpt pre-query @ref post-query',
      depth: 1,
      id: 'node1',
      children: [childNode1.id],
    }
    const childNode2 = {title: 'Qwerty', depth: 2, id: 'childNode2'}
    const node2 = {
      title: '/chatgpt prefix @@ref postfix',
      command: '/chatgpt prefix @@ref postfix',
      depth: 1,
      id: 'node2',
      children: [childNode2.id],
    }
    mockStore._nodes = {
      node1,
      node2,
      childNode1,
      childNode2,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe('prefix\n  Abcd\npostfix\n  Qwerty')
    expect(substituteReferences('prefix @@ref postfix', 0, mockStore)).toBe('prefix\n  Abcd\npostfix')
  })

  it('should handle references in child nodes', () => {
    const childNode1 = {title: 'Abcd', depth: 2, id: 'childNode1'}
    const node1 = {
      command: '/chatgpt pre-query @ref post-query',
      depth: 1,
      id: 'node1',
      children: [childNode1.id],
    }
    const childNode2 = {title: 'child 2', depth: 2, id: 'childNode2', x: 2, y: 1}
    const childNode3 = {
      title: 'child 3 @@ref',
      depth: 2,
      id: 'childNode3',
      x: 2,
      y: 2,
    }
    const childNode4 = {title: 'child 4', depth: 2, id: 'childNode4', x: 2, y: 3}
    const node2 = {
      command: '/chatgpt prefix @ref2 postfix',
      depth: 1,
      id: 'node2',
      children: [childNode2.id, childNode3.id, childNode4.id],
    }

    mockStore._nodes = {
      node1,
      node2,
      childNode1,
      childNode2,
      childNode3,
      childNode4,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe(
      'prefix  postfix\n  child 2\n  child 3\n    Abcd\n  child 4',
    )
  })

  it('should substitute reference and preserve both nodes children', () => {
    const childNode1 = {
      title: 'Abcd',
      depth: 2,
      id: 'childNode1',
    }

    const childNode2 = {
      title: 'Qwerty',
      depth: 2,
      id: 'childNode2',
    }

    const commandNode = {
      command: '/chatgpt pre-query @foo13 post-query',
      depth: 1,
      id: 'foo13',
      children: [childNode1.id],
    }

    const refNode = {
      command: '/chatgpt prefix @@foo13 postfix @bar13',
      depth: 1,
      id: 'refNode',
      children: [childNode2.id],
    }

    mockStore._nodes = {
      [childNode1.id]: childNode1,
      [childNode2.id]: childNode2,
      [commandNode.id]: commandNode,
      [refNode.id]: refNode,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(refNode, mockStore)).toBe('prefix\n  Abcd\npostfix\n  Qwerty')
    expect(substituteReferences('/chatgpt prefix @@foo13 postfix @bar13', 0, mockStore)).toBe(
      '/chatgpt prefix\n  Abcd\npostfix',
    )
  })
})

describe('Multi-level references and nesting', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should resolve nested references correctly', () => {
    const var1 = {title: '@var1 VAR1', depth: 1, id: 'var1'}
    const var2 = {title: '@var2 VAR2 ( @@var1 )', depth: 1, id: 'var2'}
    const var3 = {title: '@var3 VAR3 ( @@var2 )', depth: 1, id: 'var3'}
    const var4 = {title: '@var4 VAR4 ( @@var3 )', depth: 1, id: 'var4'}

    mockStore._nodes = {
      [var1.id]: var1,
      [var2.id]: var2,
      [var3.id]: var3,
      [var4.id]: var4,
    }

    // Direct variable substitution
    expect(substituteReferences(var1.title, 0, mockStore)).toBe(' VAR1')

    // Single level of nesting
    expect(substituteReferences('@@var2', 0, mockStore)).toBe('  VAR2 (  VAR1\n )')

    // Two levels of nesting
    expect(substituteReferences('@@var3', 0, mockStore)).toBe('  VAR3 (  VAR2 (  VAR1\n )\n )')

    // Three levels of nesting
    expect(substituteReferences('@@var4', 0, mockStore)).toBe('  VAR4 (  VAR3 (  VAR2 (  VAR1\n )\n )\n )')

    // Test with container node
    const containerNode = {
      title: 'Container @@var4',
      depth: 1,
      id: 'container',
    }
    mockStore._nodes[containerNode.id] = containerNode

    const expected = 'Container  VAR4 (  VAR3 (  VAR2 (  VAR1\n )\n )\n )'
    expect(substituteReferencesAndHashrefsChildrenAndSelf(containerNode, mockStore)).toBe(expected)
    expect(substituteReferences('Container @@var4', 0, mockStore)).toBe(expected)
  })

  it('should handle 4 levels of variable references correctly', () => {
    const node1 = {title: '@var1 VAR1', command: '@var1 VAR1', depth: 1, id: 'node1'}
    const node2 = {title: '@var2 VAR2(@@var1)', command: '@var2 VAR2(@@var1)', depth: 1, id: 'node1'}
    const node3 = {title: '@var3 VAR3(@@var2)', command: '@var3 VAR3(@@var2)', depth: 1, id: 'node1'}
    const node4 = {title: '@var4 VAR4(@@var3)', command: '@var4 VAR4(@@var3)', depth: 1, id: 'node1'}
    mockStore._nodes = {
      node1,
      node2,
      node3,
      node4,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node4, mockStore)).toBe(
      'VAR4(  VAR3(  VAR2(  VAR1\n )\n )\n )',
    )
    expect(substituteReferences('VAR4(@@var3)', 0, mockStore)).toBe('VAR4(  VAR3(  VAR2(  VAR1\n )\n )\n)')
  })

  it('should handle complex hierarchies with multi-level references', () => {
    const subChildNode1 = {
      title: 'child-query',
      depth: 3,
      id: 'subChildNode1',
    }

    const subChildNode2 = {
      title: 'sub-child query',
      depth: 3,
      id: 'subChildNode2',
    }

    const refChildNode = {
      title: 'Abcd',
      depth: 2,
      id: 'refChildNode',
      children: [subChildNode1.id, subChildNode2.id],
    }

    const referencedNode = {
      title: '/chatgpt pre-query @foo14 post-query',
      command: '/chatgpt pre-query @foo14 post-query',
      depth: 1,
      id: 'foo14',
      children: [refChildNode.id],
    }

    const firstChild = {
      title: 'child 1',
      depth: 2,
      id: 'firstChild',
    }

    const secondChild = {
      title: 'child 2 @@foo14',
      depth: 2,
      id: 'secondChild',
    }

    const thirdChildChild = {
      title: 'child 3',
      depth: 3,
      id: 'thirdChildChild',
    }

    const thirdChild = {
      command: '/chatgpt command',
      depth: 2,
      id: 'thirdChild',
      children: [thirdChildChild.id],
    }

    const parentNode = {
      title: '/chatgpt prefix @bar14 postfix',
      command: '/chatgpt prefix @bar14 postfix',
      depth: 1,
      id: 'parentNode',
      children: [firstChild.id, secondChild.id, thirdChild.id],
    }

    mockStore._nodes = {
      [subChildNode1.id]: subChildNode1,
      [subChildNode2.id]: subChildNode2,
      [refChildNode.id]: refChildNode,
      [referencedNode.id]: referencedNode,
      [firstChild.id]: firstChild,
      [secondChild.id]: secondChild,
      [thirdChildChild.id]: thirdChildChild,
      [thirdChild.id]: thirdChild,
      [parentNode.id]: parentNode,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(parentNode, mockStore)
    expect(result).toBe(
      'prefix  postfix\n  child 1\n  child 2\n    Abcd\n      child-query\n      sub-child query\n    child 3',
    )
  })
})

describe('Circular reference detection', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should prevent circular references with refs tracking', () => {
    const circularRefNode = {
      title: '@circular Contains @@circular',
      depth: 1,
      id: 'circularref',
      children: [],
    }

    mockStore._nodes = {
      [circularRefNode.id]: circularRefNode,
    }

    expect(substituteReferences('Start @@circular end', 0, mockStore)).toBe('Start  Contains \nend')
  })

  it('should detect and prevent circular references across multiple nodes', () => {
    // Create a cycle of references: nodeA -> nodeB -> nodeC -> nodeA
    const nodeA = {
      title: '@nodeA References nodeB: @@nodeB',
      depth: 1,
      id: 'nodeA',
    }

    const nodeB = {
      title: '@nodeB References nodeC: @@nodeC',
      depth: 1,
      id: 'nodeB',
    }

    const nodeC = {
      title: '@nodeC References back to nodeA: @@nodeA',
      depth: 1,
      id: 'nodeC',
    }

    // Create a node that references the cycle
    const referringNode = {
      title: 'Start with @@nodeA to test circular chain',
      depth: 1,
      id: 'referringNode',
    }

    mockStore._nodes = {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
      [nodeC.id]: nodeC,
      [referringNode.id]: referringNode,
    }

    // Test that the cycle is broken
    const result = substituteReferencesAndHashrefsChildrenAndSelf(referringNode, mockStore)
    expect(result).toBe(
      'Start with  References nodeB:  References nodeC:  References back to nodeA: \nto test circular chain',
    )

    // Test with substituteReferences
    const referencesResult = substituteReferences('Start with @@nodeA', 0, mockStore)
    expect(referencesResult).toBe('Start with  References nodeB:  References nodeC:  References back to nodeA: ')
  })

  it('should handle complex circular references with branches', () => {
    const nodeA = {
      title: '@nodeA References B and D: @@nodeB and @@nodeD',
      depth: 1,
      id: 'nodeA',
    }

    const nodeB = {
      title: '@nodeB References C: @@nodeC',
      depth: 1,
      id: 'nodeB',
    }

    const nodeC = {
      title: '@nodeC References back to A: @@nodeA',
      depth: 1,
      id: 'nodeC',
    }

    const nodeD = {
      title: '@nodeD Non-circular branch',
      depth: 1,
      id: 'nodeD',
    }

    const referringNode = {
      title: 'Complex test: @@nodeA',
      depth: 1,
      id: 'referringNode',
    }

    mockStore._nodes = {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
      [nodeC.id]: nodeC,
      [nodeD.id]: nodeD,
      [referringNode.id]: referringNode,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(referringNode, mockStore)
    expect(result).toBe(
      'Complex test:  References B and D:  References C:  References back to A: \n and  Non-circular branch',
    )
  })
})

describe('Special command handling', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should ignore /foreach commands', () => {
    const childNode1 = {title: 'Abcd', depth: 3, id: 'childNode1'}
    const node1 = {
      title: '/foreach',
      depth: 2,
      id: 'node1',
      children: [childNode1.id],
      prompt: [childNode1.id],
    }
    const node2 = {title: 'prefix @@ref postfix', depth: 1, id: 'node2', children: [node1.id]}
    mockStore._nodes = {
      node1,
      node2,
      childNode1,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe('prefix  postfix')
  })

  it('should ignore /summarize commands', () => {
    const childNode1 = {title: 'Abcd', depth: 3, id: 'childNode1'}
    const node1 = {
      title: '/summarize',
      depth: 2,
      id: 'node1',
      children: [childNode1.id],
      prompt: [childNode1.id],
    }
    const node2 = {title: 'prefix @@ref postfix', depth: 1, id: 'node2', children: [node1.id]}
    mockStore._nodes = {
      node1,
      node2,
      childNode1,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe('prefix  postfix')
  })

  it('should ignore /outline with summarize flag', () => {
    const childNode1 = {title: 'Abcd', depth: 3, id: 'childNode1'}
    const node1 = {
      title: '/outline prompt --summarize',
      depth: 2,
      id: 'node1',
      children: [childNode1.id],
      prompt: [childNode1.id],
    }
    const node2 = {title: 'prefix @@ref postfix', depth: 1, id: 'node2', children: [node1.id]}
    mockStore._nodes = {
      node1,
      node2,
      childNode1,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe('prefix  postfix')
  })

  it('should not ignore /outline without --summarize', () => {
    const childNode1 = {title: 'Abcd', depth: 3, id: 'childNode1'}
    const node1 = {
      title: '/outline prompt',
      depth: 2,
      id: 'node1',
      children: [childNode1.id],
      prompt: [childNode1.id],
    }
    const node2 = {title: 'prefix @@ref postfix', depth: 1, id: 'node2', children: [node1.id]}
    mockStore._nodes = {
      node1,
      node2,
      childNode1,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe('prefix  postfix\n    Abcd')
  })

  it('should handle foreach references correctly', () => {
    const foreachChild = {title: '/foreach /chatgpt prompt @@name', depth: 3, id: 'c1'}
    const child = {title: 'rusty', depth: 3, id: 'c2'}
    const parent = {
      title: '/chatgpt make 1 cat name @name',
      depth: 2,
      id: 'p',
      children: [foreachChild.id, child.id],
      prompts: [child.id],
    }

    mockStore._nodes = {
      [foreachChild.id]: foreachChild,
      [parent.id]: parent,
      [child.id]: child,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(foreachChild, mockStore)
    expect(result).toBe('prompt\n  rusty')
  })

  it('should handle outline with summarize and chunk size', () => {
    const childNode1 = {title: 'Child content', depth: 2, id: 'childNode1'}
    const node1 = {
      title: '/outline prompt --summarize=xs',
      command: '/outline prompt --summarize=xs',
      depth: 1,
      id: 'node1',
      children: [childNode1.id],
    }
    const node2 = {title: 'prefix @@ref postfix', depth: 1, id: 'node2', children: [node1.id]}
    mockStore._nodes = {
      [node1.id]: node1,
      [node2.id]: node2,
      [childNode1.id]: childNode1,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)
    expect(result).toBe('prefix  postfix')
  })
})

describe('Edge cases and special characters', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should handle non-Latin characters correctly', () => {
    const childNode1 = {title: '你好 (nǐ hǎo)', depth: 2, id: 'childNode1'}
    const node1 = {
      command: '/chatgpt say hello in chinease @ref',
      depth: 1,
      id: 'node1',
      children: [childNode1.id],
    }
    const node2 = {command: '/chatgpt @@ref', depth: 1, id: 'node2'}
    mockStore._nodes = {
      [node1.id]: node1,
      [node2.id]: node2,
      [childNode1.id]: childNode1,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(node2, mockStore)).toBe('你好 (nǐ hǎo)')
    expect(substituteReferences('/chatgpt @@ref', 0, mockStore)).toBe('/chatgpt\n  你好 (nǐ hǎo)')
  })

  it('should handle completely empty node', () => {
    const emptyNode = {depth: 0, id: 'emptyNode'}
    mockStore._nodes = {
      emptyNode,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(emptyNode, mockStore)
    expect(result).toBe('')
  })

  it('should handle various indentedTextParams options', () => {
    const node = {
      command: '/chatgpt Query with @ref',
      title: 'Title with @ref',
      depth: 0,
      id: 'node',
    }

    mockStore._nodes = {
      node,
    }

    const defaultResult = substituteReferencesAndHashrefsChildrenAndSelf(node, mockStore)
    const withParams = substituteReferencesAndHashrefsChildrenAndSelf(node, mockStore, {
      nonPromptNode: false,
      saveFirst: false,
      useCommand: false,
    })

    expect(defaultResult).toBe('Query with')
    expect(withParams).not.toBe(defaultResult)
  })

  it('should respect ignorePostProccessCommand parameter', () => {
    const postProcessNode = {
      command: '/summarize Content',
      depth: 0,
      id: 'postProcessNode',
    }

    mockStore._nodes = {
      postProcessNode,
    }

    const respectedResult = substituteReferencesAndHashrefsChildrenAndSelf(postProcessNode, mockStore, {
      ignorePostProccessCommand: true,
    })
    expect(respectedResult).toBe('Content')
  })

  it('should handle references at start of string', () => {
    const refNode = {
      title: '@refStart This is at start',
      depth: 1,
      id: 'refStart',
    }

    const testNode = {
      title: '@@refStart of string',
      depth: 1,
      id: 'testNode',
    }

    mockStore._nodes = {
      [refNode.id]: refNode,
      [testNode.id]: testNode,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(testNode, mockStore)).toBe('This is at start\nof string')
    expect(substituteReferences('@@refStart of string', 0, mockStore)).toBe('  This is at start\nof string')
  })

  it('should handle references at end of string', () => {
    const refNode = {
      title: '@refEnd This is at end',
      depth: 1,
      id: 'refEnd',
    }

    const testNode = {
      title: 'End of string @@refEnd',
      depth: 1,
      id: 'testNode',
    }

    mockStore._nodes = {
      [refNode.id]: refNode,
      [testNode.id]: testNode,
    }

    expect(substituteReferencesAndHashrefsChildrenAndSelf(testNode, mockStore)).toBe('End of string  This is at end')
    expect(substituteReferences('End of string @@refEnd', 0, mockStore)).toBe('End of string  This is at end')
  })

  it('should handle references with variable names correctly', () => {
    const nodeWithVar = {
      title: 'pre-query @foo10 post-query',
      command: 'pre-query @foo10 post-query',
      depth: 1,
      id: 'nodeWithVar',
    }

    const nodeWithRef = {
      title: 'prefix @@foo10 postfix',
      command: 'prefix @@foo10 postfix',
      depth: 1,
      id: 'nodeWithRef',
    }

    mockStore._nodes = {
      [nodeWithVar.id]: nodeWithVar,
      [nodeWithRef.id]: nodeWithRef,
    }

    const expected = 'prefix pre-query  post-query\npostfix'
    expect(substituteReferencesAndHashrefsChildrenAndSelf(nodeWithRef, mockStore)).toBe(expected)
    expect(substituteReferences('prefix @@foo10 postfix', 0, mockStore)).toBe(expected)
  })

  it('should use nearest hash reference', () => {
    const refNode1 = {
      title: '#_ref First',
      depth: 1,
      id: 'refNode1',
    }

    const testNode = {
      title: '##_ref',
      depth: 1,
      id: 'testNode',
    }

    const commandNode1 = {
      title: '/chatgpt command1',
      depth: 1,
      id: 'commandNode1',
      children: [testNode.id, refNode1.id],
    }
    refNode1.parent = commandNode1.id
    testNode.parent = commandNode1.id

    const refNode2 = {
      title: '#_ref Second',
      depth: 1,
      id: 'refNode2',
    }

    const commandNode2 = {
      title: '/chatgpt command1',
      depth: 1,
      id: 'commandNode2',
      children: [refNode2],
    }
    refNode2.parent = commandNode1.id

    const rootNode = {
      title: 'Root',
      depth: 0,
      id: 'rootNode',
      children: [refNode1.id, testNode.id],
    }
    commandNode1.parent = rootNode.id
    commandNode2.parent = rootNode.id

    mockStore._nodes = {
      refNode1,
      testNode,
      rootNode,
      refNode2,
      commandNode1,
      commandNode2,
    }

    expect(substituteHashrefsChildrenAndSelf(testNode, mockStore)).toBe('First')
    expect(substituteHashrefs('##_ref', 0, mockStore, testNode)).toBe('  First')
  })
})

describe('indentedText function', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should create basic indented text representation', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    const child1 = {title: 'Child1', depth: 2, id: 'child1'}
    const child2 = {title: 'Child2', depth: 2, id: 'child2'}
    const grandchild = {title: 'Grandchild', depth: 3, id: 'grandchild', children: []}

    rootNode.children = [child1.id, child2.id]
    child1.children = [grandchild.id]
    child2.children = []

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [child1.id]: child1,
      [child2.id]: child2,
      [grandchild.id]: grandchild,
    }

    const result = indentedText(rootNode, mockStore, {})

    expect(result.length).toBe(4) // Root + 3 descendants
    expect(result[0].node).toBe(rootNode)
    expect(result[0].text).toBe('Root')
    expect(result[1].text).toBe('  Child1')
    expect(result[2].text).toBe('    Grandchild')
    expect(result[3].text).toBe('  Child2')
  })

  it('should handle node sorting by position', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    // Note the deliberate reversal of x coordinates for sorting test
    const child1 = {title: 'Child1', depth: 2, id: 'child1', x: 20, y: 1}
    const child2 = {title: 'Child2', depth: 2, id: 'child2', x: 10, y: 1}

    rootNode.children = [child1.id, child2.id]
    child1.children = []
    child2.children = []

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [child1.id]: child1,
      [child2.id]: child2,
    }

    const result = indentedText(rootNode, mockStore, {})

    expect(result.length).toBe(3)
    expect(result[0].node).toBe(rootNode)
    expect(result[1].text).toBe('  Child2') // Should come first due to lower x-coordinate
    expect(result[2].text).toBe('  Child1')
  })

  it('should respect parentIndentation parameter', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    const child = {title: 'Child', depth: 2, id: 'child', children: []}

    rootNode.children = [child.id]

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [child.id]: child,
    }

    // With default indentation
    const defaultResult = indentedText(rootNode, mockStore, {})
    expect(defaultResult[1].text).toBe('  Child')

    // With custom indentation
    const customResult = indentedText(rootNode, mockStore, {parentIndentation: 2})
    expect(customResult[1].text).toBe('      Child')
  })

  it('should handle the saveFirst parameter', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root', children: []}
    mockStore._nodes = {[rootNode.id]: rootNode}

    // With saveFirst = true (default)
    const withSaveFirst = indentedText(rootNode, mockStore, {saveFirst: true})
    expect(withSaveFirst[0].text).toBe('Root')

    // With saveFirst = false
    const withoutSaveFirst = indentedText(rootNode, mockStore, {saveFirst: false})
    expect(withoutSaveFirst[0].text).toBe('Root')
  })

  it('should handle command nodes with useCommand parameter', () => {
    const commandNode = {
      title: 'Node Title',
      command: '/chatgpt Command Text',
      depth: 1,
      id: 'cmd',
      children: [],
    }
    mockStore._nodes = {[commandNode.id]: commandNode}

    // With useCommand = true
    const withUseCommand = indentedText(commandNode, mockStore, {useCommand: true})
    expect(withUseCommand[0].text).toBe('')

    // With useCommand = false
    const withoutUseCommand = indentedText(commandNode, mockStore, {useCommand: false})
    expect(withoutUseCommand[0].text).toBe('Node Title')
  })

  it('should handle empty node titles', () => {
    const rootNode = {title: '', depth: 1, id: 'root'}
    const child = {title: '', depth: 2, id: 'child', children: []}
    rootNode.children = [child.id]

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [child.id]: child,
    }

    const result = indentedText(rootNode, mockStore, {})

    expect(result.length).toBe(2)
    expect(result[0].text).toBe('')
    expect(result[1].text).toBe('  ')
  })

  it('should filter nodes by prompt when nonPromptNode is true', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    const promptChild = {title: 'Prompt Child', depth: 2, id: 'prompt', children: []}
    const normalChild = {title: 'Normal Child', depth: 2, id: 'normal', children: []}

    rootNode.children = [promptChild.id, normalChild.id]
    rootNode.prompts = [promptChild.id]

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [promptChild.id]: promptChild,
      [normalChild.id]: normalChild,
    }

    // Without nonPromptNode filter
    const withoutFilter = indentedText(rootNode, mockStore, {nonPromptNode: false})
    expect(withoutFilter.length).toBe(3)

    // With nonPromptNode filter
    const withFilter = indentedText(rootNode, mockStore, {nonPromptNode: true})
    expect(withFilter.length).toBe(2) // Root + normal child (prompt child filtered)
    expect(withFilter[1].node).toBe(normalChild)
  })

  it('should skip command nodes', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    const commandChild = {title: '/chatgpt command', depth: 2, id: 'cmd', children: []}
    const normalChild = {title: 'Normal Child', depth: 2, id: 'normal', children: []}

    rootNode.children = [commandChild.id, normalChild.id]

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [commandChild.id]: commandChild,
      [normalChild.id]: normalChild,
    }

    const result = indentedText(rootNode, mockStore, {})

    // Should exclude the command node from the output text lines
    expect(result.length).toBe(2) // Root + normal child
    expect(result[1].node).toBe(normalChild)
  })

  it('should respect ignorePostProccessCommand parameter', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    const postProcessNode = {title: '/summarize content', depth: 2, id: 'post', children: []}
    const childOfPostProcess = {title: 'Child of post-process', depth: 3, id: 'postchild', children: []}

    postProcessNode.children = [childOfPostProcess.id]
    rootNode.children = [postProcessNode.id]

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [postProcessNode.id]: postProcessNode,
      [childOfPostProcess.id]: childOfPostProcess,
    }

    // With ignorePostProccessCommand = true
    const withIgnorePostProcess = indentedText(rootNode, mockStore, {ignorePostProccessCommand: true})
    expect(withIgnorePostProcess.length).toBe(1) // Root + post process node, but not its children

    // With ignorePostProccessCommand = false
    const withoutIgnorePostProcess = indentedText(rootNode, mockStore, {ignorePostProccessCommand: false})
    expect(withoutIgnorePostProcess.length).toBe(2) // Root + post process node + child
  })

  it('should handle deep nesting and complex hierarchy', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    const level1 = {title: 'Level 1', depth: 2, id: 'level1'}
    const level2 = {title: 'Level 2', depth: 3, id: 'level2'}
    const level3 = {title: 'Level 3', depth: 4, id: 'level3'}
    const level4 = {title: 'Level 4', depth: 5, id: 'level4', children: []}

    rootNode.children = [level1.id]
    level1.children = [level2.id]
    level2.children = [level3.id]
    level3.children = [level4.id]

    mockStore._nodes = {
      [rootNode.id]: rootNode,
      [level1.id]: level1,
      [level2.id]: level2,
      [level3.id]: level3,
      [level4.id]: level4,
    }

    const result = indentedText(rootNode, mockStore, {})

    expect(result.length).toBe(5)
    expect(result[0].text).toBe('Root')
    expect(result[1].text).toBe('  Level 1')
    expect(result[2].text).toBe('    Level 2')
    expect(result[3].text).toBe('      Level 3')
    expect(result[4].text).toBe('        Level 4')

    // With parent indentation
    const resultWithIndent = indentedText(rootNode, mockStore, {parentIndentation: 1})
    expect(resultWithIndent[1].text).toBe('    Level 1')
    expect(resultWithIndent[4].text).toBe('          Level 4')
  })

  it('should handle nodes without children', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root'}
    // No children property
    mockStore._nodes = {[rootNode.id]: rootNode}

    const result = indentedText(rootNode, mockStore, {})
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('Root')
  })

  it('should handle nodes with empty children array', () => {
    const rootNode = {title: 'Root', depth: 1, id: 'root', children: []}
    mockStore._nodes = {[rootNode.id]: rootNode}

    const result = indentedText(rootNode, mockStore, {})
    expect(result.length).toBe(1)
    expect(result[0].text).toBe('Root')
  })

  it('should keep original order for nodes without coords', () => {
    const node1 = {id: 'node1', title: 'Node 1', depth: 2}
    const node2 = {id: 'node2', title: 'Node 2', depth: 2}
    const node3 = {id: 'node3', title: 'Node 3', depth: 2}
    const node4 = {id: 'node4', title: 'Node 4', depth: 2}
    const node5 = {id: 'node5', title: 'Node 5', depth: 2}

    const rootNode = {
      title: 'Root',
      depth: 1,
      id: 'rootNode',
      children: [node1.id, node2.id, node3.id, node4.id, node5.id],
    }

    mockStore._nodes = {
      rootNode,
      node1,
      node2,
      node3,
      node4,
      node5,
    }

    const result = indentedText(rootNode, mockStore, {})

    expect(result.length).toBe(6)
    expect(result[1].text).toBe('  Node 1')
    expect(result[2].text).toBe('  Node 2')
    expect(result[3].text).toBe('  Node 3')
    expect(result[4].text).toBe('  Node 4')
    expect(result[5].text).toBe('  Node 5')
  })

  it('should sort nodes with coords and preserve order of nodes without coords', () => {
    const node1 = {id: 'node1', title: 'Node 1', depth: 2, x: 1, y: 1}
    const node2 = {id: 'node2', title: 'Node 2', depth: 2}
    const node3 = {id: 'node3', title: 'Node 3', depth: 2, x: 1, y: 2}
    const node4 = {id: 'node4', title: 'Node 4', depth: 2}
    const node5 = {id: 'node5', title: 'Node 5', depth: 2}

    const rootNode = {
      title: 'Root',
      depth: 1,
      id: 'rootNode',
      children: [node2.id, node1.id, node4.id, node5.id, node3.id],
    }

    mockStore._nodes = {
      rootNode,
      node1,
      node2,
      node3,
      node4,
      node5,
    }

    const result = indentedText(rootNode, mockStore, {})

    expect(result.length).toBe(6)
    expect(result[1].text).toBe('  Node 1')
    expect(result[2].text).toBe('  Node 3')
    expect(result[3].text).toBe('  Node 2')
    expect(result[4].text).toBe('  Node 4')
    expect(result[5].text).toBe('  Node 5')
  })

  it('should substitute edges data to result string', () => {
    const nodeA = {id: 'nodeA', title: 'Dog', depth: 2}
    const nodeB = {id: 'nodeB', title: 'Animal', depth: 2}
    const nodeC = {id: 'nodeC', title: 'Mammal', depth: 2}
    const nodeD = {id: 'nodeD', title: 'Fur', depth: 2}
    const nodeE = {id: 'nodeE', title: 'Pet', depth: 2}

    const parentNode = {
      id: 'parentNode',
      title: 'Parent Node',
      depth: 1,
      children: [nodeA.id, nodeB.id, nodeC.id, nodeD.id, nodeE.id],
    }

    nodeA.parent = parentNode.id
    nodeB.parent = parentNode.id
    nodeC.parent = parentNode.id
    nodeD.parent = parentNode.id
    nodeE.parent = parentNode.id

    const rootNode = {
      id: 'rootNode',
      title: 'Root Node',
      depth: 0,
      children: [parentNode.id],
    }

    parentNode.parent = rootNode.id

    mockStore._nodes = {
      nodeA,
      nodeB,
      nodeC,
      nodeD,
      nodeE,
      parentNode,
      rootNode,
    }

    // Connections
    const e1 = createMockEdge({start: nodeA.id, end: nodeB.id, title: 'is'}) // Dog → Animal
    const e2 = createMockEdge({start: nodeA.id, end: nodeC.id, title: 'is'}) // Dog → Mammal
    const e3 = createMockEdge({start: nodeB.id, end: nodeD.id, title: 'is'}) // Animal → Fur
    const e4 = createMockEdge({start: nodeC.id, end: nodeD.id, title: 'is'}) // Mammal → Fur
    const e5 = createMockEdge({start: nodeD.id, end: nodeE.id, title: 'is'}) // Fur → Pet
    const e6 = createMockEdge({start: nodeE.id, end: nodeA.id, title: 'is'}) // Pet → Dog

    mockStore._edges = {
      [e1.id]: e1,
      [e2.id]: e2,
      [e3.id]: e3,
      [e4.id]: e4,
      [e5.id]: e5,
      [e6.id]: e6,
    }

    const result = indentedText(parentNode, mockStore)

    expect(result.length).toBe(6)
    expect(result[0].text).toBe('Parent Node')
    expect(result[1].text).toBe('  Dog is Animal, is Mammal')
    expect(result[2].text).toBe('  Animal is Fur')
    expect(result[3].text).toBe('  Mammal is Fur')
    expect(result[4].text).toBe('  Fur is Pet')
    expect(result[5].text).toBe('  Pet is Dog')
  })

  it('should substitute edges data to result string №2', () => {
    const ezra = {id: 'ezra', title: 'Ezra', depth: 2}
    const indianMan = {id: 'indianMan', title: 'Indian Man', depth: 2}
    const movie = {id: 'movie', title: 'Movie', depth: 2}
    const alien = {id: 'alien', title: 'Alien', depth: 2}
    const earth = {id: 'earth', title: 'Earth', depth: 2}

    const parentNode = {
      id: 'parentNode',
      title: 'Parent Node',
      depth: 1,
      children: [ezra.id, indianMan.id, movie.id, alien.id, earth.id],
    }

    ezra.parent = parentNode.id
    indianMan.parent = parentNode.id
    movie.parent = parentNode.id
    alien.parent = parentNode.id
    earth.parent = parentNode.id

    const rootNode = {
      id: 'rootNode',
      title: 'Root Node',
      depth: 0,
      children: [parentNode.id],
    }

    parentNode.parent = rootNode.id

    mockStore._nodes = {
      ezra,
      indianMan,
      movie,
      alien,
      earth,
      parentNode,
      rootNode,
    }

    // Connections
    const edge1 = createMockEdge({start: ezra.id, end: movie.id, title: 'is'}) // Ezra → Movie
    const edge2 = createMockEdge({start: indianMan.id, end: ezra.id, title: 'named'}) // Indian Man → Ezra
    const edge3 = createMockEdge({start: alien.id, end: indianMan.id, title: 'is'}) // Alien → Indian Man
    const edge4 = createMockEdge({start: alien.id, end: earth.id, title: 'comes to'}) // Alien → Earth

    mockStore._edges = {
      [edge1.id]: edge1,
      [edge2.id]: edge2,
      [edge3.id]: edge3,
      [edge4.id]: edge4,
    }

    const result = indentedText(parentNode, mockStore)

    expect(result.length).toBe(4)
    expect(result[0].text).toBe('Parent Node')
    expect(result[1].text).toBe('  Ezra is Movie')
    expect(result[2].text).toBe('  Indian Man named Ezra')
    expect(result[3].text).toBe('  Alien is Indian Man, comes to Earth')
  })

  it('should substitute edge to same depth level', () => {
    const nodeA = {id: 'nodeA', title: 'A', depth: 2}
    const nodeB = {id: 'nodeB', title: 'B', depth: 2}

    const nodeC = {id: 'nodeC', title: 'C', depth: 3, children: [nodeB.id]}
    nodeB.parent = nodeC.id

    const parentNode = {
      id: 'parentNode',
      title: 'Parent Node',
      children: [nodeA.id, nodeC.id],
      depth: 1,
    }
    nodeA.parent = parentNode.id
    nodeC.parent = parentNode.id

    const rootNode = {id: 'rootNode', children: [parentNode.id], depth: 0}
    parentNode.parent = rootNode.id

    mockStore._nodes = {
      nodeA,
      nodeB,
      nodeC,
      parentNode,
      rootNode,
    }

    // Connections
    // A → B
    // A → C
    const aToBEdge = createMockEdge({start: nodeA.id, end: nodeB.id, title: 'is'})
    const aToCEdge = createMockEdge({start: nodeA.id, end: nodeC.id, title: 'is'})

    mockStore._edges = {
      [aToBEdge.id]: aToBEdge,
      [aToCEdge.id]: aToCEdge,
    }

    const result = indentedText(parentNode, mockStore)

    expect(result.length).toBe(3)
    expect(result[0].text).toBe('Parent Node')
    expect(result[1].text).toBe('  A is B')
    expect(result[2].text).toBe('    C')
  })

  it('should not contain standalone strings from inside complex sentences', () => {
    const nodeA = {id: 'A', title: 'A'}
    const nodeB = {id: 'B', title: 'B'}
    const nodeC = {id: 'C', title: 'C'}

    const parentNode = {
      id: 'parentNode',
      title: 'Parent',
      depth: 1,
      children: [nodeA.id, nodeB.id, nodeC.id],
    }

    nodeA.parent = parentNode.id
    nodeB.parent = parentNode.id
    nodeC.parent = parentNode.id

    const rootNode = {
      id: 'rootNode',
      title: 'Root',
      depth: 0,
      children: [parentNode.id],
    }

    parentNode.parent = rootNode.id

    mockStore._nodes = {
      [nodeA.id]: nodeA,
      [nodeB.id]: nodeB,
      [nodeC.id]: nodeC,
      [parentNode.id]: parentNode,
      [rootNode.id]: rootNode,
    }

    const edge1 = createMockEdge({start: nodeA.id, end: nodeB.id, title: 'is'})
    const edge2 = createMockEdge({start: nodeA.id, end: nodeC.id, title: 'is'})

    mockStore._edges = {
      [edge1.id]: edge1,
      [edge2.id]: edge2,
    }

    const result = indentedText(parentNode, mockStore)
    const texts = result.map(r => r.text)
    const text = texts.join('\n')

    expect(text).toBe('Parent\nA is B, is C')
    expect(texts).not.toContain('B')
    expect(texts).not.toContain('C')
  })

  it('should not contain edge titles or node titles as standalone lines', () => {
    const dog = {id: 'dog', title: 'Dog'}
    const animal = {id: 'animal', title: 'Animal'}
    const pet = {id: 'pet', title: 'Pet'}

    const parentNode = {
      id: 'parent',
      title: 'Parent',
      depth: 1,
      children: [dog.id, animal.id, pet.id],
    }

    dog.parent = parentNode.id
    animal.parent = parentNode.id
    pet.parent = parentNode.id

    const rootNode = {
      id: 'root',
      title: 'Root',
      depth: 0,
      children: [parentNode.id],
    }

    parentNode.parent = rootNode.id

    mockStore._nodes = {
      [dog.id]: dog,
      [animal.id]: animal,
      [pet.id]: pet,
      [parentNode.id]: parentNode,
      [rootNode.id]: rootNode,
    }

    const edge1 = createMockEdge({start: dog.id, end: animal.id, title: 'is'})
    const edge2 = createMockEdge({start: dog.id, end: pet.id, title: 'can be'})

    mockStore._edges = {
      [edge1.id]: edge1,
      [edge2.id]: edge2,
    }

    const result = indentedText(parentNode, mockStore)
    const texts = result.map(r => r.text)
    const text = texts.join('\n')

    expect(text).toBe('Parent\nDog is Animal, can be Pet')
    expect(texts).not.toContain('Animal')
    expect(texts).not.toContain('Pet')
    expect(texts).not.toContain('is')
    expect(texts).not.toContain('can be')
  })
})

describe('Hashtag References', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  describe('Basic hashtag reference handling', () => {
    it('should return unchanged string when no hashtag references exist', () => {
      const node1 = {title: 'Title text', command: 'Title text', depth: 1, id: 'node1'}
      mockStore._nodes = {node1}

      expect(substituteHashrefs(node1.command || '', 0, mockStore)).toBe('Title text')
    })

    it('should strip single hashtag references without substitution', () => {
      const node1 = {title: 'Title #_ref text', command: 'Title #_ref text', depth: 1, id: 'node1'}
      mockStore._nodes = {node1}

      expect(substituteHashrefs(node1.command || '', 0, mockStore)).toBe('Title  text')
    })

    it('should handle text with no hashtag references', () => {
      mockStore._nodes = {}

      expect(substituteHashrefs('No references here', 0, mockStore)).toBe('No references here')
      expect(substituteHashrefs('No\nreferences\nhere', 0, mockStore)).toBe('No\nreferences\nhere')
      expect(substituteHashrefs('No\n  references\n   here', 0, mockStore)).toBe('No\n  references\n   here')
    })

    it('should remove hashtag reference markers when reference not found', () => {
      mockStore._nodes = {}
      expect(substituteHashrefs('Contains ##_nonexistent reference', 0, mockStore)).toBe('Contains  reference')
    })
  })

  describe('Simple hashtag reference substitution', () => {
    it('should substitute basic hashtag references between nodes', () => {
      const node1 = {title: 'pre-query #_ref post-query', command: 'pre-query #_ref post-query', depth: 1, id: 'node1'}
      const node2 = {title: 'prefix ##_ref postfix', command: 'prefix ##_ref postfix', depth: 1, id: 'node2'}

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [node1.id, node2.id],
      }
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {
        node1,
        node2,
        root,
      }

      const expected = 'prefix pre-query  post-query\npostfix'
      expect(substituteHashrefs(node2.command || '', 0, mockStore, node2)).toBe(expected)
    })

    it('should handle hashtag references at start and end of string', () => {
      const childNode = {title: 'Child content', depth: 2, id: 'child'}
      const refNode = {
        title: '#_refname Referenced content',
        depth: 1,
        id: 'refnode',
        children: [childNode.id],
      }

      const refName1 = {
        title: '##_refname at start',
        depth: 1,
        id: 'refname1',
        children: [],
      }
      const refName2 = {
        title: '##_refname at start',
        depth: 1,
        id: 'refname2',
        children: [],
      }

      const rootNode = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refNode.id, refName1.id, refName2.id],
      }
      refNode.parent = rootNode.id
      refName1.parent = rootNode.id
      refName2.parent = rootNode.id

      mockStore._nodes = {
        [refNode.id]: refNode,
        [childNode.id]: childNode,
        [refName1.id]: refName1,
        [refName2.id]: refName2,
        [rootNode.id]: rootNode,
      }

      // Reference at start
      expect(substituteHashrefs('##_refname at start', 0, mockStore, refName1)).toBe(
        '  Referenced content\n  Child content\nat start',
      )

      // Reference at end
      expect(substituteHashrefs('At end is ##_refname', 0, mockStore, refName1)).toBe(
        'At end is  Referenced content\n  Child content',
      )
    })

    it('should handle multiple hashtag references in one string', () => {
      const childNode = {title: 'Child content', depth: 2, id: 'child'}
      const refNode = {
        title: '#_refname Referenced content',
        depth: 1,
        id: 'refnode',
        children: [childNode.id],
      }

      const refName = {
        title: 'First ##_refname and then ##_refname again',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refNode.id, refName.id],
      }
      refNode.parent = root.id
      refName.parent = root.id

      mockStore._nodes = {
        [refNode.id]: refNode,
        [childNode.id]: childNode,
        refName,
        root,
      }

      expect(substituteHashrefs('First ##_refname and then ##_refname again', 0, mockStore, refName)).toBe(
        'First  Referenced content\n  Child content\nand then  again',
      )
    })

    it('should respect indentation in the output for hashtag references', () => {
      const childNode = {title: 'Child content', depth: 2, id: 'child'}
      const refNode = {
        title: '#_refname Referenced content',
        depth: 1,
        id: 'refnode',
        children: [childNode.id],
      }

      const refName = {
        title: 'Indented:\n  ##_refname',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refNode.id, refName.id],
      }
      refNode.parent = root.id
      refName.parent = root.id

      mockStore._nodes = {
        [refNode.id]: refNode,
        [childNode.id]: childNode,
        refName,
        root,
      }

      const result = substituteHashrefs('Indented:\n  ##_refname', 2, mockStore, refName)
      expect(result).toBe('Indented:  Referenced content\n      Child content')
    })

    it('substitutes wildcard hashtag when multiple matching hashtags are present', () => {
      const refNode = {
        title: '#_ref_*',
        depth: 1,
        id: 'refnode',
      }
      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref_A post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref_B postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      const refName = {
        title: 'Overall Results ##_ref_*',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refNode.id, refName.id, node1.id, node2.id],
      }
      refNode.parent = root.id
      refName.parent = root.id
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {refNode, node1, node2, child1, child2, refName, root}

      const expected = 'Overall Results pre-query  post-query\nchild1\nprefix  postfix\nchild2'
      expect(substituteHashrefs('Overall Results ##_ref_*', 2, mockStore, refName)).toBe(expected)
    })

    it('substitutes wildcard hashtag when multiple matching hashtags are present №2', () => {
      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref_A post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref_B postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      const refName = {
        title: 'Overall Results ##_ref*',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refName.id, node1.id, node2.id],
      }
      refName.parent = root.id
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {node1, node2, child1, child2, refName, root}

      const expected = 'Overall Results pre-query  post-query\nchild1\nprefix  postfix\nchild2'
      expect(substituteHashrefs('Overall Results ##_ref*', 2, mockStore, refName)).toBe(expected)
    })

    it('substitutes wildcard hashtag when multiple matching hashtags are present №3', () => {
      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref_A post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref_B postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      const refName = {
        title: 'Overall Results ##_r*',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refName.id, node1.id, node2.id],
      }
      refName.parent = root.id
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {node1, node2, child1, child2, refName, root}

      const expected = 'Overall Results pre-query  post-query\nchild1\nprefix  postfix\nchild2'
      expect(substituteHashrefs('Overall Results ##_r*', 2, mockStore, refName)).toBe(expected)
    })

    it('substitutes wildcard hashtag when multiple matching hashtags are present №3', () => {
      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref_A post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref_B postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      const refName = {
        title: 'Overall Results ##_*',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refName.id, node1.id, node2.id],
      }
      refName.parent = root.id
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {node1, node2, child1, child2, refName, root}

      const expected = 'Overall Results pre-query  post-query\nchild1\nprefix  postfix\nchild2'
      expect(substituteHashrefs('Overall Results ##_*', 2, mockStore, refName)).toBe(expected)
    })

    it('substitutes not substitute hashreferences without asterisk', () => {
      const refNode = {
        title: '#_ref_*',
        depth: 1,
        id: 'refnode',
      }
      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref_A post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref_B postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      mockStore._nodes = {refNode, node1, node2, child1, child2}

      const expected = 'Overall Results '

      expect(substituteHashrefs('Overall Results ##_ref', 2, mockStore)).toBe(expected)
    })

    it('substitutes wildcard hashtag with hashtags containing similar suffixes', () => {
      const refNode = {
        title: '#_ref_*',
        depth: 1,
        id: 'refnode',
      }
      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref_AbcDEGdi post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref_BbcDEGdi postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      const refName = {
        title: 'Overall Results ##_ref_*',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refName.id, node1.id, node2.id],
      }
      refName.parent = root.id
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {refNode, node1, node2, child1, child2, refName, root}

      const expected = 'Overall Results pre-query  post-query\nchild1\nprefix  postfix\nchild2'
      expect(substituteHashrefs('Overall Results ##_ref_*', 2, mockStore, refName)).toBe(expected)
    })

    it('substitutes multiple different wildcard hashtags', () => {
      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref1_A post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref2_B postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      const refName = {
        title: 'Overall Results ##_ref1_* ##_ref2_*',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refName.id, node1.id, node2.id],
      }
      refName.parent = root.id
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {node1, node2, child1, child2, refName, root}

      const expected = 'Overall Results pre-query  post-query\nchild1\nprefix  postfix\nchild2'
      expect(substituteHashrefs('Overall Results ##_ref1_* ##_ref2_*', 2, mockStore, refName)).toBe(expected)
    })

    it('substitutes wildcard hashtag when matched hashtags contain multiple words or underscores', () => {
      const refNode = {
        title: '#_ref_*',
        depth: 1,
        id: 'refnode',
      }

      const child1 = {
        title: 'child1',
        id: 'child1',
      }
      const node1 = {
        title: 'pre-query #_ref_fir65st_seco45nd7 post-query',
        depth: 1,
        id: 'node1',
        children: [child1.id],
      }

      const child2 = {
        title: 'child2',
        id: 'child2',
      }
      const node2 = {
        title: 'prefix #_ref_th3ird_four5th6 postfix',
        depth: 1,
        id: 'node2',
        children: [child2.id],
      }

      const refName = {
        title: 'Overall Results ##_ref_*',
        depth: 1,
        id: 'refName',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refName.id, node1.id, node2.id],
      }
      refName.parent = root.id
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {refNode, node1, node2, child1, child2, refName, root}

      const expected = 'Overall Results pre-query  post-query\nchild1\nprefix  postfix\nchild2'
      expect(substituteHashrefs('Overall Results ##_ref_*', 2, mockStore, refName)).toBe(expected)
    })
  })

  describe('substituteAllHashrefs function', () => {
    it('should substitute all hashtag references in a node', () => {
      const childNode1 = {title: 'Abcd', depth: 2, id: 'childNode1'}
      const node1 = {
        title: '/chatgpt pre-query #_ref post-query',
        command: '/chatgpt pre-query #_ref post-query',
        depth: 1,
        id: 'node1',
        children: [childNode1.id],
      }
      const node2 = {title: 'prefix ##_ref postfix', depth: 1, id: 'node2'}

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [node1.id, node2.id],
      }
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {
        node1,
        node2,
        childNode1,
        root,
      }

      const expected = 'prefix\n  Abcd\npostfix'
      expect(substituteAllHashrefs(node2, mockStore)).toBe(expected)
    })

    it('should handle node with both regular children and hashtag references', () => {
      const childNode1 = {title: 'Abcd', depth: 2, id: 'childNode1'}
      const node1 = {
        title: '/chatgpt pre-query #_ref post-query',
        command: '/chatgpt pre-query #_ref post-query',
        depth: 1,
        id: 'node1',
        children: [childNode1.id],
      }
      const childNode2 = {title: 'Qwerty', depth: 2, id: 'childNode2'}
      const node2 = {
        title: '/chatgpt prefix ##_ref postfix',
        command: '/chatgpt prefix ##_ref postfix',
        depth: 1,
        id: 'node2',
        children: [childNode2.id],
      }
      mockStore._nodes = {
        node1,
        node2,
        childNode1,
        childNode2,
      }

      expect(substituteAllHashrefs(node2, mockStore, {nonPromptNode: true})).toBe('\n  Qwerty')
    })

    it('substitutes wildcard hashtag in a node title and merges matching node children', () => {
      const childNode1 = {title: 'result1', depth: 2, id: 'childNode1'}
      const node1 = {
        title: '/chatgpt pre-query #_ref_first_attempt post-query',
        command: '/chatgpt pre-query #_ref_first_attempt post-query',
        depth: 1,
        id: 'node1',
        children: [childNode1.id],
      }

      const childNode2 = {title: 'result2', depth: 2, id: 'childNode2'}
      const node2 = {
        title: '/chatgpt prefix #_ref_second_attempt postfix',
        command: '/chatgpt prefix #_ref_second_attempt postfix',
        depth: 1,
        id: 'node2',
        children: [childNode2.id],
      }

      const childNode3 = {title: 'Qwerty', depth: 2, id: 'childNode3'}
      const node3 = {
        title: 'prefix ##_ref_*',
        command: 'prefix ##_ref_*',
        depth: 1,
        id: 'node3',
        children: [childNode3.id],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [node1.id, node2.id, node3.id],
      }
      node1.parent = root.id
      node2.parent = root.id
      node3.parent = root.id

      mockStore._nodes = {
        node1,
        node2,
        node3,
        childNode1,
        childNode2,
        childNode3,
        root,
      }

      const expected = 'prefix\n  result1\nresult2\n  Qwerty'
      expect(substituteAllHashrefs(node3, mockStore)).toBe(expected)
    })

    it('should substitute all references and hashrefs in a chapter hierarchy', () => {
      const resolve1 = {
        id: 'resolve1',
        title: 'Resolve hashref: ##_heading',
        depth: 4,
      }

      const newNode1 = {
        id: 'newNode1',
        title: 'New Node',
        depth: 3,
        children: [resolve1.id],
      }
      resolve1.parent = newNode1.id

      const extra1 = {
        id: 'extra1',
        title: 'Extra1 #_heading',
        depth: 3,
      }

      const heading1 = {
        id: 'heading1',
        title: 'Heading 1 #_heading',
        depth: 3,
      }

      const chapter1 = {
        id: 'chapter1',
        title: 'Chapter1',
        depth: 2,
        children: [heading1.id, newNode1.id, extra1.id],
      }
      heading1.parent = chapter1.id
      newNode1.parent = chapter1.id
      extra1.parent = chapter1.id

      const wrapper1 = {
        id: 'wrapper1',
        title: 'Wrapper 1',
        depth: 1,
        children: [chapter1.id],
      }
      chapter1.parent = wrapper1.id

      const resolve2 = {
        id: 'resolve2',
        title: 'Resolve hashref: ##_heading',
        depth: 3,
      }

      const newNode2 = {
        id: 'newNode2',
        title: 'New Node2',
        depth: 2,
        children: [resolve2.id],
      }
      resolve2.parent = newNode2.id

      const extra2 = {
        id: 'extra2',
        title: 'Extra2 #_heading',
        depth: 2,
      }

      const heading2 = {
        id: 'heading2',
        title: 'Heading 2 #_heading',
        depth: 2,
      }

      const chapter2 = {
        id: 'chapter2',
        title: 'Chapter2',
        depth: 1,
        children: [heading2.id, newNode2.id, extra2.id],
      }
      heading2.parent = chapter2.id
      newNode2.parent = chapter2.id
      extra2.parent = chapter2.id

      const wrapper2 = {
        id: 'wrapper2',
        title: 'Wrapper 2',
        depth: 0,
        children: [wrapper1.id, chapter2.id],
      }
      wrapper1.parent = wrapper2.id
      chapter2.parent = wrapper2.id

      mockStore._nodes = {
        chapter1,
        heading1,
        newNode1,
        extra1,
        wrapper1,
        wrapper2,
        chapter2,
        heading2,
        newNode2,
        extra2,
        resolve1,
        resolve2,
      }

      const expected = 'Chapter1\n  Heading 1 \n  New Node\n    Resolve hashref:\n     Heading 1\n     Extra1\n  Extra1'
      expect(substituteHashrefsChildrenAndSelf(chapter1, mockStore, {saveFirst: true})).toBe(expected)
    })
  })

  describe('substituteHashrefsChildrenAndSelf function', () => {
    it('should substitute hashtag references in the node and its children', () => {
      const childNode1 = {title: 'Abcd', depth: 2, id: 'childNode1'}
      const node1 = {
        title: '/chatgpt pre-query #_ref post-query',
        command: '/chatgpt pre-query #_ref post-query',
        depth: 1,
        id: 'node1',
        children: [childNode1.id],
      }
      const childNode2 = {title: 'Qwerty', depth: 2, id: 'childNode2'}
      const node2 = {
        title: '/chatgpt prefix ##_ref postfix',
        command: '/chatgpt prefix ##_ref postfix',
        depth: 1,
        id: 'node2',
        children: [childNode2.id],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [node1.id, node2.id],
      }
      node1.parent = root.id
      node2.parent = root.id

      mockStore._nodes = {
        node1,
        node2,
        childNode1,
        childNode2,
        root,
      }

      expect(substituteHashrefsChildrenAndSelf(node2, mockStore)).toBe('prefix\n  Abcd\npostfix\n  Qwerty')
    })

    it('should handle nested hashtag references correctly', () => {
      const var1 = {title: '#_var1 VAR1', depth: 1, id: 'var1'}
      const var2 = {title: '#_var2 VAR2 ( ##_var1 )', depth: 1, id: 'var2'}
      const var3 = {title: '#_var3 VAR3 ( ##_var2 )', depth: 1, id: 'var3'}
      const var4 = {title: '#_var4 VAR4 ( ##_var3 )', depth: 1, id: 'var4'}

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [var1.id, var2.id, var3.id, var4.id],
      }
      var1.parent = root.id
      var2.parent = root.id
      var3.parent = root.id
      var4.parent = root.id

      mockStore._nodes = {
        [var1.id]: var1,
        [var2.id]: var2,
        [var3.id]: var3,
        [var4.id]: var4,
        root,
      }

      // Direct variable substitution
      expect(substituteHashrefs(var1.title, 0, mockStore, var1)).toBe(' VAR1')

      // Single level of nesting
      expect(substituteHashrefs('##_var2', 0, mockStore, var2)).toBe('  VAR2 (  VAR1\n )')

      // Two levels of nesting
      expect(substituteHashrefs('##_var3', 0, mockStore, var3)).toBe('  VAR3 (  VAR2 (  VAR1\n )\n )')

      // Three levels of nesting
      expect(substituteHashrefs('##_var4', 0, mockStore, var4)).toBe('  VAR4 (  VAR3 (  VAR2 (  VAR1\n )\n )\n )')

      // Test with container node
      const containerNode = {
        title: 'Container ##_var4',
        depth: 1,
        id: 'container',
        parent: root.id,
      }
      mockStore._nodes[containerNode.id] = containerNode

      const expected = 'Container  VAR4 (  VAR3 (  VAR2 (  VAR1\n )\n )\n )'
      expect(substituteHashrefsChildrenAndSelf(containerNode, mockStore)).toBe(expected)
    })
  })

  describe('Circular hashtag reference detection', () => {
    it('should prevent circular hashtag references with refs tracking', () => {
      const circularRefNode = {
        title: '#_circular Contains ##_circular',
        depth: 1,
        id: 'circularref',
        children: [],
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [circularRefNode.id],
      }
      circularRefNode.parent = root.id

      mockStore._nodes = {
        [circularRefNode.id]: circularRefNode,
        root,
      }

      expect(substituteHashrefs('Start ##_circular end', 0, mockStore, circularRefNode)).toBe('Start  Contains \nend')
    })

    it('should handle complex circular hashtag references with branches', () => {
      const nodeA = {
        title: '#_nodeA References B and D: ##_nodeB and ##_nodeD',
        depth: 1,
        id: 'nodeA',
      }

      const nodeB = {
        title: '#_nodeB References C: ##_nodeC',
        depth: 1,
        id: 'nodeB',
      }

      const nodeC = {
        title: '#_nodeC References back to A: ##_nodeA',
        depth: 1,
        id: 'nodeC',
      }

      const nodeD = {
        title: '#_nodeD Non-circular branch',
        depth: 1,
        id: 'nodeD',
      }

      const referringNode = {
        title: 'Complex test: ##_nodeA',
        depth: 1,
        id: 'referringNode',
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [nodeA.id, nodeB.id, nodeC.id, nodeD.id, referringNode.id],
      }
      nodeA.parent = root.id
      nodeB.parent = root.id
      nodeC.parent = root.id
      nodeD.parent = root.id
      referringNode.parent = root.id

      mockStore._nodes = {
        [nodeA.id]: nodeA,
        [nodeB.id]: nodeB,
        [nodeC.id]: nodeC,
        [nodeD.id]: nodeD,
        [referringNode.id]: referringNode,
        root,
      }

      const result = substituteHashrefsChildrenAndSelf(referringNode, mockStore)
      expect(result).toBe(
        'Complex test:  References B and D:  References C:  References back to A: \n and  Non-circular branch',
      )
    })
  })

  describe('Special command handling with hashtag references', () => {
    it('should ignore /foreach commands with hashtag references', () => {
      const childNode1 = {title: 'Abcd', depth: 3, id: 'childNode1'}
      const node1 = {
        title: '/foreach',
        depth: 2,
        id: 'node1',
        children: [childNode1.id],
        prompt: [childNode1.id],
      }
      const node2 = {title: 'prefix ##_ref postfix', depth: 1, id: 'node2', children: [node1.id]}
      mockStore._nodes = {
        node1,
        node2,
        childNode1,
      }

      expect(substituteHashrefsChildrenAndSelf(node2, mockStore)).toBe('prefix  postfix')
    })

    it('should handle foreach hashtag references correctly', () => {
      const foreachChild = {title: '/foreach /chatgpt prompt ##_name', depth: 3, id: 'c1'}
      const child = {title: 'rusty', depth: 3, id: 'c2'}
      const parent = {
        title: '/chatgpt make 1 cat name #_name',
        depth: 2,
        id: 'p',
        children: [foreachChild.id, child.id],
        prompts: [child.id],
      }
      foreachChild.parent = parent.id
      child.parent = parent.id

      mockStore._nodes = {
        [foreachChild.id]: foreachChild,
        [parent.id]: parent,
        [child.id]: child,
      }

      const result = substituteHashrefsChildrenAndSelf(foreachChild, mockStore)
      expect(result).toBe('prompt\n  rusty')
    })
  })

  describe('Edge cases with hashtag references', () => {
    it('should handle hashtag references with variable names correctly', () => {
      const nodeWithVar = {
        title: 'pre-query #_foo10 post-query',
        command: 'pre-query #_foo10 post-query',
        depth: 1,
        id: 'nodeWithVar',
      }

      const nodeWithRef = {
        title: 'prefix ##_foo10 postfix',
        command: 'prefix ##_foo10 postfix',
        depth: 1,
        id: 'nodeWithRef',
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [nodeWithVar.id, nodeWithRef.id],
      }
      nodeWithVar.parent = root.id
      nodeWithRef.parent = root.id

      mockStore._nodes = {
        [nodeWithVar.id]: nodeWithVar,
        [nodeWithRef.id]: nodeWithRef,
        root,
      }

      const expected = 'prefix pre-query  post-query\npostfix'
      expect(substituteHashrefsChildrenAndSelf(nodeWithRef, mockStore)).toBe(expected)
      expect(substituteHashrefs('prefix ##_foo10 postfix', 0, mockStore, nodeWithVar)).toBe(expected)
    })

    it('should handle hashtag references at start of string', () => {
      const refNode = {
        title: '#_refStart This is at start',
        depth: 1,
        id: 'refStart',
      }

      const testNode = {
        title: '##_refStart of string',
        depth: 1,
        id: 'testNode',
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refNode.id, testNode.id],
      }
      refNode.parent = root.id
      testNode.parent = root.id

      mockStore._nodes = {
        [refNode.id]: refNode,
        [testNode.id]: testNode,
        root,
      }

      expect(substituteHashrefsChildrenAndSelf(testNode, mockStore)).toBe('This is at start\nof string')
      expect(substituteHashrefs('##_refStart of string', 0, mockStore, refNode)).toBe('  This is at start\nof string')
    })

    it('should handle hashtag references at end of string', () => {
      const refNode = {
        title: '#_refEnd This is at end',
        depth: 1,
        id: 'refEnd',
      }

      const testNode = {
        title: 'End of string ##_refEnd',
        depth: 1,
        id: 'testNode',
      }

      const root = {
        title: 'Root',
        depth: 0,
        id: 'root',
        children: [refNode.id, testNode.id],
      }
      refNode.parent = root.id
      testNode.parent = root.id

      mockStore._nodes = {
        [refNode.id]: refNode,
        [testNode.id]: testNode,
        root,
      }

      expect(substituteHashrefsChildrenAndSelf(testNode, mockStore)).toBe('End of string  This is at end')
      expect(substituteHashrefs('End of string ##_refEnd', 0, mockStore, testNode)).toBe(
        'End of string  This is at end',
      )
    })

    it('should substitute siblings hash reference in first chapter', () => {
      const heading1 = {
        title: 'Heading 1 #_heading',
        id: 'heading1',
        depth: 2,
      }

      const chapter1 = {
        title: 'Chapter 1',
        id: 'chapter1',
        depth: 1,
        children: [heading1.id],
      }
      heading1.parent = chapter1.id

      const heading2 = {
        title: 'Heading 2 #_heading',
        id: 'heading2',
        depth: 2,
      }

      const extraHeading = {
        title: 'Extra #_heading',
        id: 'extraHeading',
        depth: 2,
      }

      const resolveHashref = {
        title: 'Resolve hashref: ##_heading',
        id: 'resolveHashref',
        depth: 3,
      }

      const newNode = {
        title: 'New Node',
        id: 'newNode',
        depth: 2,
        childNodes: [resolveHashref.id],
      }
      resolveHashref.parent = newNode.id

      const chapter2 = {
        title: 'Chapter 2',
        id: 'chapter2',
        depth: 1,
        children: [heading2.id, extraHeading.id, newNode.id],
      }
      heading2.parent = chapter2.id
      newNode.parent = chapter2.id
      extraHeading.parent = chapter2.id

      const root = {
        title: 'Root',
        id: 'root',
        depth: 0,
        children: [chapter2.id, chapter1.id],
      }
      chapter1.parent = root.id
      chapter2.parent = root.id

      mockStore._nodes = {root, chapter1, chapter2, heading1, heading2, newNode, resolveHashref, extraHeading}

      const result = 'Resolve hashref:\n Heading 2\n Extra'
      expect(substituteHashrefs(resolveHashref.title, 0, mockStore, resolveHashref)).toBe(result)
    })

    it('should substitute siblings hash reference in second chapter', () => {
      const heading1 = {
        title: 'Heading 1 #_heading',
        id: 'heading1',
        depth: 2,
      }

      const extraHeading1 = {
        title: 'Extra #_heading',
        id: 'extraHeading1',
        depth: 2,
      }

      const resolveHashref = {
        title: 'Resolve hashref: ##_heading',
        id: 'resolveHashref',
        depth: 3,
      }

      const newNode = {
        title: 'New Node',
        id: 'newNode',
        depth: 2,
        children: [resolveHashref.id],
      }
      resolveHashref.parent = newNode.id

      const chapter1 = {
        title: 'Chapter 1',
        id: 'chapter1',
        depth: 1,
        children: [heading1.id, newNode.id, extraHeading1.id],
      }
      heading1.parent = chapter1.id
      newNode.parent = chapter1.id
      extraHeading1.parent = chapter1.id

      const heading2 = {
        title: 'Heading 2 #_heading',
        id: 'heading2',
        depth: 2,
      }

      const extraHeading2 = {
        title: 'Extra #_heading',
        id: 'extraHeading2',
        depth: 2,
      }

      const chapter2 = {
        title: 'Chapter 2',
        id: 'chapter2',
        depth: 1,
        children: [heading2.id, extraHeading2.id],
      }
      heading2.parent = chapter2.id
      extraHeading2.parent = chapter2.id

      const root = {
        title: 'Root',
        id: 'root',
        depth: 0,
        children: [chapter2.id, chapter1.id],
      }
      chapter1.parent = root.id
      chapter2.parent = root.id

      mockStore._nodes = {
        root,
        chapter1,
        chapter2,
        heading1,
        heading2,
        newNode,
        resolveHashref,
        extraHeading2,
        extraHeading1,
      }

      const result = 'Resolve hashref:\n Heading 1\n Extra'
      expect(substituteHashrefs(resolveHashref.title, 0, mockStore, resolveHashref)).toBe(result)
    })

    it('substitutes all siblings hashrefs from subchilds №1', () => {
      const heading1 = {id: 'heading1', title: 'Heading 1 #_heading', depth: 2}
      const extraHeading1 = {id: 'extraHeading1', title: 'Extra #_heading', depth: 2}

      const chapter1 = {id: 'chapter1', title: 'Chapter 1', depth: 1, children: ['heading1', 'extraHeading1']}
      heading1.parent = 'chapter1'
      extraHeading1.parent = 'chapter1'

      const heading2 = {id: 'heading2', title: 'Heading 2 #_heading', depth: 2}
      const extraHeading2 = {id: 'extraHeading2', title: 'Extra #_heading', depth: 2}

      const chapter2 = {id: 'chapter2', title: 'Chapter 2', depth: 1, children: ['heading2', 'extraHeading2']}
      heading2.parent = 'chapter2'
      extraHeading2.parent = 'chapter2'

      const tableOfContents = {id: 'tableOfContents', title: 'Table of contents: ##_heading', depth: 1}
      tableOfContents.parent = 'root'

      const root = {
        id: 'root',
        title: 'Root',
        depth: 0,
        children: ['chapter1', 'chapter2', 'tableOfContents'],
      }
      chapter1.parent = 'root'
      chapter2.parent = 'root'

      mockStore._nodes = {
        heading1,
        extraHeading1,
        chapter1,
        heading2,
        extraHeading2,
        chapter2,
        tableOfContents,
        root,
      }

      const result = 'Table of contents:\n Heading 1\n Extra\n Heading 2\n Extra'

      expect(substituteHashrefs(tableOfContents.title, 0, mockStore, tableOfContents)).toBe(result)
    })

    it('substitutes all siblings hashrefs from subchilds №2', () => {
      const heading1 = {id: 'heading1', title: 'Heading 1 #_heading', depth: 4}
      const extra1 = {id: 'extra1', title: 'Extra1 #_heading', depth: 4}
      const resolve1 = {id: 'resolve1', title: 'Resolve hashref: ##_heading', depth: 5}
      const newNode1 = {id: 'newNode1', title: 'New Node', depth: 4, children: ['resolve1']}
      resolve1.parent = 'newNode1'

      const chapter1 = {
        id: 'chapter1',
        title: 'Chapter 1',
        depth: 3,
        children: ['heading1', 'newNode1', 'extra1'],
      }
      heading1.parent = 'chapter1'
      newNode1.parent = 'chapter1'
      extra1.parent = 'chapter1'

      const wrapper1 = {id: 'wrapper1', title: 'Wrapper 1', depth: 2, children: ['chapter1']}
      chapter1.parent = 'wrapper1'

      const heading2 = {id: 'heading2', title: 'Heading 2 #_heading', depth: 3}
      const extra2 = {id: 'extra2', title: 'Extra2 #_heading', depth: 3}
      const resolve2 = {id: 'resolve2', title: 'Resolve hashref: ##_heading', depth: 4}
      const newNode2 = {id: 'newNode2', title: 'New Node', depth: 3, children: ['resolve2']}
      resolve2.parent = 'newNode2'

      const chapter2 = {
        id: 'chapter2',
        title: 'Chapter 2',
        depth: 2,
        children: ['heading2', 'newNode2', 'extra2'],
      }
      heading2.parent = 'chapter2'
      newNode2.parent = 'chapter2'
      extra2.parent = 'chapter2'

      const wrapper2 = {
        id: 'wrapper2',
        title: 'Wrapper 2',
        depth: 1,
        children: ['wrapper1', 'chapter2'],
      }
      wrapper1.parent = 'wrapper2'
      chapter2.parent = 'wrapper2'

      const tableOfContents = {
        id: 'tableOfContents',
        title: 'Table of contents ##_heading',
        depth: 1,
      }
      tableOfContents.parent = 'root'

      const root = {
        id: 'root',
        title: 'Root',
        depth: 0,
        children: ['tableOfContents', 'wrapper2'],
      }
      wrapper2.parent = 'root'

      mockStore._nodes = {
        heading1,
        extra1,
        resolve1,
        newNode1,
        chapter1,
        wrapper1,
        heading2,
        extra2,
        resolve2,
        newNode2,
        chapter2,
        wrapper2,
        tableOfContents,
        root,
      }

      const result = 'Table of contents\n Heading 1\n Extra1\n Heading 2\n Extra2'

      expect(substituteHashrefs(tableOfContents.title, 0, mockStore, tableOfContents)).toBe(result)
    })
  })

  describe('Hashtag :first and :last references', () => {
    it('should substitute ##_refname:first with only the first matching node', () => {
      const firstNode = {
        title: 'First node',
        id: 'firstNode',
        depth: 2,
      }

      const refNode1 = {
        title: '#_refname',
        id: 'refNode1',
        depth: 1,
        children: [firstNode.id],
      }

      const secondNode = {
        title: 'Second node',
        id: 'secondNode',
        depth: 2,
      }

      const refNode2 = {
        title: '#_refname',
        id: 'refNode2',
        depth: 1,
        children: [secondNode.id],
      }

      firstNode.parent = refNode1.id
      secondNode.parent = refNode2.id

      const caller = {
        title: 'Insert ##_refname:first here',
        id: 'caller',
        depth: 1,
      }

      const root = {
        title: 'Root',
        id: 'root',
        depth: 0,
        children: [refNode1.id, refNode2.id, caller.id],
      }
      caller.parent = root.id
      refNode1.parent = root.id
      refNode2.parent = root.id

      mockStore._nodes = {root, refNode1, firstNode, secondNode, refNode2, caller}

      const result = 'Insert \n  First node\nhere'
      expect(substituteHashrefs(caller.title, 0, mockStore, caller)).toBe(result)
    })

    it('should substitute ##_refname:last with only the last matching node', () => {
      const firstNode = {
        title: 'First node',
        id: 'firstNode',
        depth: 3,
      }

      const refNode1 = {
        title: '#_refname',
        id: 'refNode1',
        depth: 2,
        children: [firstNode.id],
      }
      firstNode.parent = refNode1.id

      const parentRefNode = {
        title: 'parentRef',
        id: 'parentRefNode',
        depth: 1,
        children: [refNode1.id],
      }
      refNode1.parent = parentRefNode.id

      const secondNode = {
        title: 'Second node',
        id: 'secondNode',
        depth: 2,
      }

      const refNode2 = {
        title: '#_refname',
        id: 'refNode2',
        depth: 1,
        children: [secondNode.id],
      }
      secondNode.parent = refNode2.id

      const caller = {
        title: 'Insert ##_refname:last here',
        id: 'caller',
        depth: 1,
      }

      const root = {
        title: 'Root',
        id: 'root',
        depth: 0,
        children: [refNode1.id, parentRefNode.id, caller.id],
      }
      caller.parent = root.id
      refNode1.parent = root.id
      parentRefNode.parent = root.id

      mockStore._nodes = {root, parentRefNode, refNode1, firstNode, secondNode, refNode2, caller}

      const result = 'Insert \n  First node\nhere'
      expect(substituteHashrefs(caller.title, 0, mockStore, caller)).toBe(result)
    })

    it('should substitute ##_heading:last with the last matching #_heading node', () => {
      const heading1 = {
        title: 'Heading 1 #_heading',
        id: 'heading1',
        depth: 2,
      }

      const chapter1 = {
        title: 'Chapter 1',
        id: 'chapter1',
        depth: 1,
        children: [heading1.id],
      }
      heading1.parent = chapter1.id

      const heading2 = {
        title: 'Heading 2 #_heading',
        id: 'heading2',
        depth: 2,
      }

      const chapter2 = {
        title: 'Chapter 2',
        id: 'chapter2',
        depth: 1,
        children: [heading2.id],
      }
      heading2.parent = chapter2.id

      const caller = {
        title: 'Last chapter: ##_heading:last',
        id: 'caller',
        depth: 1,
      }

      const root = {
        title: 'Root',
        id: 'root',
        depth: 0,
        children: [chapter1.id, chapter2.id, caller.id],
      }
      chapter1.parent = root.id
      chapter2.parent = root.id
      caller.parent = root.id

      mockStore._nodes = {root, chapter1, chapter2, heading1, heading2, caller}

      const result = 'Last chapter: Heading 2 '
      expect(substituteHashrefs(caller.title, 0, mockStore, caller)).toBe(result)
    })
  })
})

describe('Combined @ and #_ reference handling', () => {
  const mockStore = new Store({
    userId: 'userId',
    nodes: {},
  })

  it('should work with both types of references in the same content', () => {
    // Regular @ reference
    const regRef = {
      title: '@regular Regular reference content',
      depth: 1,
      id: 'regref',
      children: [],
    }

    // Hashtag #_ reference
    const hashRef = {
      title: '#_hashtag Hashtag reference content',
      depth: 1,
      id: 'hashref',
      children: [],
    }

    // Node using both reference types
    const mixedNode = {
      title: 'Mixed: @@regular and ##_hashtag together',
      depth: 1,
      id: 'mixed',
    }

    const root = {
      title: 'Root',
      depth: 0,
      id: 'root',
      children: [mixedNode.id, hashRef.id, regRef.id],
    }
    mixedNode.parent = root.id
    hashRef.parent = root.id
    regRef.parent = root.id

    mockStore._nodes = {
      [regRef.id]: regRef,
      [hashRef.id]: hashRef,
      [mixedNode.id]: mixedNode,
      root,
    }

    // Test substituteReferencesAndHashrefsChildrenAndSelf (should handle both)
    const result = substituteReferencesAndHashrefsChildrenAndSelf(mixedNode, mockStore)
    expect(result).toBe('Mixed:  Regular reference content\nand  Hashtag reference content\ntogether')

    // Test individual substitution
    const regRefResult = substituteReferences(mixedNode.title, 0, mockStore)
    expect(regRefResult).toBe('Mixed:  Regular reference content\nand ##_hashtag together')

    const hashRefResult = substituteHashrefs(mixedNode.title, 0, mockStore, mixedNode)
    expect(hashRefResult).toBe('Mixed: @@regular and  Hashtag reference content\ntogether')
  })

  xit('should handle nested references of different types', () => {
    // Set up a nested structure where @ reference contains a #_ reference and vice versa
    const innerAtRef = {
      title: '@innerAt Inner @ content',
      depth: 2,
      id: 'innerAt',
      children: [],
    }

    const innerHashRef = {
      title: '#_innerHash Inner # content',
      depth: 2,
      id: 'innerHash',
      children: [],
    }

    const atRefWithHash = {
      title: '@atWithHash Contains hashtag: ##_innerHash',
      depth: 1,
      id: 'atWithHash',
      children: [],
    }

    const hashRefWithAt = {
      title: '#_hashWithAt Contains at-ref: @@innerAt',
      depth: 1,
      id: 'hashWithAt',
      children: [],
    }

    // Node that references both nested refs
    const testNode = {
      title: 'Testing nested: @@atWithHash and ##_hashWithAt',
      depth: 1,
      id: 'testNode',
      children: [],
    }

    mockStore._nodes = {
      innerAtRef,
      innerHashRef,
      atRefWithHash,
      hashRefWithAt,
      testNode,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(testNode, mockStore)
    expect(result).toBe('Testing nested:  Contains hashtag:  Inner # content\n and  Contains at-ref:  Inner @ content')

    // Test ordering - @ references before #_ references
    const atFirst = substituteReferences('@@atWithHash', 0, mockStore)
    expect(atFirst).toBe('  Contains hashtag: ##_innerHash')

    // Then resolve hashtags in the result
    const afterBoth = substituteHashrefs(atFirst, 0, mockStore)
    expect(afterBoth).toBe('  Contains hashtag:  Inner # content')
  })

  xit('should handle circular references that mix both reference types', () => {
    // Create a cycle: atNode -> hashNode -> atNode
    const atNode = {
      title: '@atNode References hashNode: ##_hashNode',
      depth: 1,
      id: 'atNode',
      children: [],
    }

    const hashNode = {
      title: '#_hashNode References back to atNode: @@atNode',
      depth: 1,
      id: 'hashNode',
      children: [],
    }

    const referringNode = {
      title: 'Start with @@atNode to test mixed circular refs',
      depth: 1,
      id: 'referringNode',
      children: [],
    }

    mockStore._nodes = {
      atNode,
      hashNode,
      referringNode,
    }

    // Test that the cycle is properly broken
    const result = substituteReferencesAndHashrefsChildrenAndSelf(referringNode, mockStore)
    expect(result).toBe('Start with  References hashNode:  References back to atNode: \nto test mixed circular refs')
  })

  it('should handle references in command nodes with both reference types', () => {
    const childAtRef = {
      title: '@childAt Child content with @-ref',
      depth: 2,
      id: 'childAtRef',
      children: [],
    }

    const childHashRef = {
      title: '#_childHash Child content with #-ref',
      depth: 2,
      id: 'childHashRef',
      children: [],
    }

    const commandNode = {
      command: '/chatgpt Use both @@childAt and ##_childHash in prompt',
      depth: 1,
      id: 'commandNode',
      children: [],
    }

    const root = {
      title: 'Root',
      depth: 0,
      id: 'root',
      children: [commandNode.id, childHashRef.id, childAtRef.id],
    }
    commandNode.parent = root.id
    childHashRef.parent = root.id
    childAtRef.parent = root.id

    mockStore._nodes = {
      childAtRef,
      childHashRef,
      commandNode,
      root,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(commandNode, mockStore)
    expect(result).toBe('Use both  Child content with \nand  Child content with #-ref\nin prompt')
  })

  it('should handle multi-line references with both types', () => {
    const atMultiline = {
      title: '@atMulti Line 1\nLine 2\nLine 3',
      depth: 1,
      id: 'atMultiline',
      children: [],
    }

    const hashMultiline = {
      title: '#_hashMulti Line A\nLine B\nLine C',
      depth: 1,
      id: 'hashMultiline',
      children: [],
    }

    const refNode = {
      title: 'Begin\n  @@atMulti\nMiddle\n  ##_hashMulti\nEnd',
      depth: 1,
      id: 'refNode',
      children: [],
    }

    const root = {
      title: 'Root',
      depth: 0,
      id: 'root',
      children: [atMultiline.id, hashMultiline.id, refNode.id],
    }
    atMultiline.parent = root.id
    hashMultiline.parent = root.id
    refNode.parent = root.id

    mockStore._nodes = {
      atMultiline,
      hashMultiline,
      refNode,
      root,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(refNode, mockStore)
    expect(result).toBe('Begin  Line 1\nLine 2\nLine 3\nMiddle  Line A\nLine B\nLine C\nEnd')
  })

  xit('should handle complex combinations with multiple references of both types', () => {
    // Create a complex structure with multiple nested references
    const baseAt = {
      title: '@baseAt Base @-ref content',
      depth: 2,
      id: 'baseAt',
      children: [],
    }

    const baseHash = {
      title: '#_baseHash Base #-ref content',
      depth: 2,
      id: 'baseHash',
      children: [],
    }

    const level1At = {
      title: '@level1At Level1 with ##_baseHash inside',
      depth: 1,
      id: 'level1At',
      children: [],
    }

    const level1Hash = {
      title: '#_level1Hash Level1 with @@baseAt inside',
      depth: 1,
      id: 'level1Hash',
      children: [],
    }

    const level2At = {
      title: '@level2At Level2 combining @@level1At and ##_level1Hash',
      depth: 1,
      id: 'level2At',
      children: [],
    }

    const complexNode = {
      title: 'Complex: @@level2At plus direct ##_baseHash',
      depth: 1,
      id: 'complexNode',
      children: [],
    }

    mockStore._nodes = {
      baseAt,
      baseHash,
      level1At,
      level1Hash,
      level2At,
      complexNode,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(complexNode, mockStore)
    expect(result).toBe(
      'Complex:  Level2 combining  Level1 with  Base #-ref content\n inside and  Level1 with  Base @-ref content\n inside plus direct  Base #-ref content',
    )
  })

  it('should handle references with both types in parameters and variables', () => {
    const paramAt = {
      title: '@param123 Parameter with @-ref',
      depth: 1,
      id: 'paramAt',
      children: [],
    }

    const paramHash = {
      title: '#_param456 Parameter with #-ref',
      depth: 1,
      id: 'paramHash',
      children: [],
    }

    const nodeWithParams = {
      title: '/chatgpt --model=@@param123 --temperature=##_param456',
      depth: 1,
      id: 'nodeWithParams',
      children: [],
    }

    const root = {
      title: 'Root',
      depth: 0,
      id: 'root',
      children: [paramAt.id, paramHash.id, nodeWithParams.id],
    }
    paramAt.parent = root.id
    paramHash.parent = root.id
    nodeWithParams.parent = root.id

    mockStore._nodes = {
      paramAt,
      paramHash,
      nodeWithParams,
      root,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(nodeWithParams, mockStore)
    expect(result).toBe('--model=  Parameter with \n--temperature=  Parameter with #-ref')
  })

  xit('should handle same content referenced with both reference types', () => {
    const dualRefNode = {
      title: '@dualRef #_dualRef This content has both reference types',
      depth: 1,
      id: 'dualRef',
      children: [],
    }

    const refNode = {
      title: 'Testing @@dualRef and ##_dualRef',
      depth: 1,
      id: 'refNode',
      children: [],
    }

    mockStore._nodes = {
      dualRef: dualRefNode,
      refNode,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(refNode, mockStore)
    expect(result).toBe('Testing  This content has both reference types and  This content has both reference types')
  })

  it('should substitute reference children correctly with both reference types', () => {
    // Set up nodes with children
    const childNode1 = {
      title: 'Child of @-ref',
      depth: 2,
      id: 'child1',
      children: [],
    }

    const childNode2 = {
      title: 'Child of #-ref',
      depth: 2,
      id: 'child2',
      children: [],
    }

    const parentAtRef = {
      title: '@parentAt Parent with @-ref',
      depth: 1,
      id: 'parentAt',
      children: [childNode1.id],
    }

    const parentHashRef = {
      title: '#_parentHash Parent with #-ref',
      depth: 1,
      id: 'parentHash',
      children: [childNode2.id],
    }

    const testNode = {
      title: 'Test: @@parentAt and ##_parentHash',
      depth: 1,
      id: 'testNode',
      children: [],
    }

    const root = {
      title: 'Root',
      depth: 0,
      id: 'root',
      children: [parentAtRef.id, parentHashRef.id, testNode.id],
    }
    parentAtRef.parent = root.id
    parentHashRef.parent = root.id
    testNode.parent = root.id

    mockStore._nodes = {
      child1: childNode1,
      child2: childNode2,
      parentAt: parentAtRef,
      parentHash: parentHashRef,
      testNode,
      root,
    }

    const result = substituteReferencesAndHashrefsChildrenAndSelf(testNode, mockStore)
    expect(result).toBe('Test:  Parent with \n  Child of\nand  Parent with #-ref\n  Child of #-ref')
  })
})

describe('substituteReferencesAndHashrefsSelf', () => {
  it('should return empty string if title is missing', () => {
    const node = {command: 'irrelevant', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('')
  })

  it('should return unchanged string when no references exist', () => {
    const node = {title: 'No refs here', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('No refs here')
  })

  it('should substitute @ references in the node title', () => {
    const refNode = {title: '@foo Hello', depth: 1, id: 'foo', children: []}
    const node = {title: 'Test @@foo world', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {foo: refNode, n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('Test  Hello\nworld')
  })

  it('should substitute #_ hashrefs in the node title', () => {
    const hashNode = {title: '#_bar hashref', depth: 1, id: 'bar', children: []}
    const node = {title: 'Here ##_bar inserted', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {bar: hashNode, n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('Here  hashref\ninserted')
  })

  it('should substitute both @ and #_ references in the node title', () => {
    const refNode = {title: '@foo Foo', depth: 1, id: 'foo', children: []}
    const hashNode = {title: '#_bar Bar', depth: 1, id: 'bar', children: []}
    const node = {title: '@@foo and ##_bar!', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {foo: refNode, bar: hashNode, n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('Foo\nand  Bar\n!')
  })

  it('should handle nested references', () => {
    const inner = {title: '@inner Inner', depth: 1, id: 'inner', children: []}
    const outer = {title: '@outer Outer ( @@inner )', depth: 1, id: 'outer', children: []}
    const node = {title: 'Start @@outer end', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {inner, outer, n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('Start  Outer (  Inner\n )\nend')
  })

  it('should handle nested hashrefs', () => {
    const inner = {title: '#_inner InnerHash', depth: 1, id: 'inner', children: []}
    const outer = {title: '#_outer Outer ( ##_inner )', depth: 1, id: 'outer', children: []}
    const node = {title: 'Start ##_outer end', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {inner, outer, n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('Start  Outer (  InnerHash\n )\nend')
  })

  it('should handle circular references gracefully', () => {
    const nodeA = {title: '@a @@b', depth: 1, id: 'a', children: []}
    const nodeB = {title: '@b @@a', depth: 1, id: 'b', children: []}
    const node = {title: 'Test @@a', depth: 1, id: 'n', children: []}
    const store = new Store({userId: 'u', nodes: {a: nodeA, b: nodeB, n: node}})
    expect(substituteReferencesAndHashrefsSelf(node, store)).toBe('Test') // Should not infinite loop
  })
})
