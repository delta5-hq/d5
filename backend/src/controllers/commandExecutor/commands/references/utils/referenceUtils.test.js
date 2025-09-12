import {findInNodeArray, findInNodeMap, findAllSiblingsMatch, getReferences} from './referenceUtils'
import {referencePatterns} from './referencePatterns'
import {HASHREF_DEF_PREFIX, REF_DEF_PREFIX} from '../../../constants'

describe('findInNodeArray', () => {
  // Test fixtures
  const nodes = [
    {id: 'node1', title: 'Title with @reference', command: null},
    {id: 'node2', title: null, command: 'Command with @reference'},
    {id: 'node3', title: '@different-ref in title', command: null},
    {id: 'node4', title: null, command: '@different-ref in command'},
    {id: 'node5', title: 'No references here', command: 'No references here either'},
    {id: 'node6', title: null, command: null},
  ]

  it('should find nodes by title using a single predicate', () => {
    const predicate = text => !!text && text.includes('@reference')
    const result = findInNodeArray(nodes, false, predicate)
    expect(result).toBe(nodes[0]) // Title match should be prioritized when checkCommandFirst is false
  })

  it('should find nodes by command using a single predicate when no title matches', () => {
    const predicate = text => !!text && text.includes('@reference')
    // Create a subset without the title match to force command match
    const nodesSubset = [nodes[1], nodes[2], nodes[3], nodes[4], nodes[5]]
    const result = findInNodeArray(nodesSubset, false, predicate)
    expect(result).toBe(nodesSubset[0]) // Command match when no title matches
  })

  it('should prioritize command over title when checkCommandFirst is true', () => {
    const predicate = text => !!text && text.includes('@reference')
    const result = findInNodeArray(nodes, true, predicate)
    expect(result).toBe(nodes[1]) // Command match should be prioritized
  })

  it('should work with separate title and command predicates', () => {
    const titlePredicate = text => !!text && text.includes('@different')
    const commandPredicate = text => !!text && text.includes('@reference')

    // Command first, should find node2
    let result = findInNodeArray(nodes, true, titlePredicate, commandPredicate)
    expect(result).toBe(nodes[1])

    // Title first, should find node3
    result = findInNodeArray(nodes, false, titlePredicate, commandPredicate)
    expect(result).toBe(nodes[2])
  })

  it('should handle null or undefined values', () => {
    const predicate = text => text === null
    const result = findInNodeArray(nodes, false, predicate)
    expect(result).toBe(nodes[1]) // First node with null title
  })

  it('should return undefined when no matches found', () => {
    const predicate = text => !!text && text.includes('nonexistent')
    const result = findInNodeArray(nodes, false, predicate)
    expect(result).toBeUndefined()
  })

  it('should handle empty array', () => {
    const predicate = text => !!text && text.includes('@reference')
    const result = findInNodeArray([], false, predicate)
    expect(result).toBeUndefined()
  })
})

describe('findInNodeMap', () => {
  // Test fixtures
  const nodeMap = {
    node1: {id: 'node1', title: 'Title with @reference', command: null},
    node2: {id: 'node2', title: null, command: 'Command with @reference'},
    node3: {id: 'node3', title: '@different-ref in title', command: null},
    node4: {id: 'node4', title: null, command: '@different-ref in command'},
  }

  it('should find nodes by title using a single predicate', () => {
    const predicate = text => !!text && text.includes('@reference')
    const result = findInNodeMap(nodeMap, false, predicate)
    expect(result).toEqual(nodeMap['node1']) // Title match should be prioritized when checkCommandFirst is false
  })

  it('should prioritize command over title when checkCommandFirst is true', () => {
    const predicate = text => !!text && text.includes('@reference')
    const result = findInNodeMap(nodeMap, true, predicate)
    expect(result).toEqual(nodeMap['node2']) // Command match should be prioritized
  })

  it('should work with separate title and command predicates', () => {
    const titlePredicate = text => !!text && text.includes('@different')
    const commandPredicate = text => !!text && text.includes('@reference')

    // Command first, should find node2
    let result = findInNodeMap(nodeMap, true, titlePredicate, commandPredicate)
    expect(result).toEqual(nodeMap['node2'])

    // Title first, should find node3
    result = findInNodeMap(nodeMap, false, titlePredicate, commandPredicate)
    expect(result).toEqual(nodeMap['node3'])
  })

  it('should return undefined when no matches found', () => {
    const predicate = text => !!text && text.includes('nonexistent')
    const result = findInNodeMap(nodeMap, false, predicate)
    expect(result).toBeUndefined()
  })

  it('should handle empty object', () => {
    const predicate = text => !!text && text.includes('@reference')
    const result = findInNodeMap({}, false, predicate)
    expect(result).toBeUndefined()
  })
})

describe('findInNodeWorkflow with reference patterns', () => {
  // Tests for the functionality that was previously in getCiteNode
  const nodes = {
    node1: {id: 'node1', title: 'Contains @reference', command: null},
    node2: {id: 'node2', title: null, command: 'Command with @reference'},
    node3: {id: 'node3', title: 'Has @different-ref', command: null},
    node4: {id: 'node4', title: 'No references here', command: 'Neither here'},
  }

  it('should find nodes with specific references in title', () => {
    const refName = 'reference'
    const refPattern = referencePatterns.specificWholeWord(refName, REF_DEF_PREFIX)
    const result = findInNodeMap(nodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual(nodes.node1)
  })

  it('should find nodes with specific references in command when prioritized', () => {
    const refName = 'reference'
    const refPattern = referencePatterns.specificWholeWord(refName, REF_DEF_PREFIX)
    const result = findInNodeMap(nodes, true, text => !!text && refPattern.test(text))

    expect(result).toEqual(nodes.node2)
  })

  it('should find different references correctly', () => {
    const refName = 'different-ref'
    const refPattern = referencePatterns.specificWholeWord(refName, REF_DEF_PREFIX)
    const result = findInNodeMap(nodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual(nodes.node3)
  })

  it('should return undefined when no matching reference is found', () => {
    const refName = 'nonexistent'
    const refPattern = referencePatterns.specificWholeWord(refName, REF_DEF_PREFIX)
    const result = findInNodeMap(nodes, false, text => !!text && refPattern.test(text))

    expect(result).toBeUndefined()
  })

  it('should work with custom prefix', () => {
    const customNodes = {
      node1: {id: 'node1', title: 'Contains #_customref', command: null},
    }

    const refName = 'customref'
    const refPattern = referencePatterns.specificWholeWord(refName, '#_')
    const result = findInNodeMap(customNodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual(customNodes.node1)
  })
})

describe('getReferences utility', () => {
  it('should return empty array for undefined input', () => {
    expect(getReferences(undefined)).toEqual([])
  })

  it('should return empty array for non-string input', () => {
    expect(getReferences(123)).toEqual([])
  })

  it('should return empty array for string without references', () => {
    expect(getReferences('This is a test string')).toEqual([])
  })

  it('should extract single reference', () => {
    expect(getReferences('This is a @test reference')).toEqual(['@test'])
  })

  it('should extract multiple references', () => {
    expect(getReferences('This has @one and @two references')).toEqual(['@one', '@two'])
  })

  it('should work with custom prefix', () => {
    expect(getReferences('This has #one and #two tags', '#')).toEqual(['#one', '#two'])
  })

  it('should handle references with dashes', () => {
    expect(getReferences('This has @reference-with-dashes')).toEqual(['@reference-with-dashes'])
  })
})

describe('findAllSiblingsMatch', () => {
  it('should find a sibling node matching title(single predicate)', () => {
    const refNode = {id: 'refNode', title: '#_ref value'}
    const currentNode = {id: 'currentNode', title: '##_ref'}
    const parent = {id: 'parent', title: 'parent', children: [refNode.id, currentNode.id]}

    refNode.parent = parent.id
    currentNode.parent = parent.id

    const nodes = {
      refNode,
      currentNode,
      parent,
    }

    const refPattern = referencePatterns.specificWholeWord('ref', HASHREF_DEF_PREFIX)

    const result = findAllSiblingsMatch(currentNode, nodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual([refNode])
  })

  it('should find a sibling node matching title(two predicates, checkCommandFirst)', () => {
    const refNode = {id: 'refNode', command: '#_ref value'}
    const currentNode = {id: 'currentNode', title: '##_ref'}
    const parent = {id: 'parent', title: 'parent', children: [refNode.id, currentNode.id]}

    refNode.parent = parent.id
    currentNode.parent = parent.id

    const nodes = {
      refNode,
      currentNode,
      parent,
    }

    const refPattern = referencePatterns.specificWholeWord('ref', HASHREF_DEF_PREFIX)

    const result = findAllSiblingsMatch(
      currentNode,
      nodes,
      true,
      () => false, // title never matches
      text => !!text && refPattern.test(text),
    )

    expect(result).toEqual([refNode])
  })

  it('should check title if command does not match', () => {
    const refNode = {id: 'refNode', title: '#_ref value'}
    const currentNode = {id: 'currentNode', title: '##_ref'}
    const parent = {id: 'parent', title: 'parent', children: [refNode.id, currentNode.id]}

    refNode.parent = parent.id
    currentNode.parent = parent.id

    const nodes = {
      refNode,
      currentNode,
      parent,
    }

    const refPattern = referencePatterns.specificWholeWord('ref', HASHREF_DEF_PREFIX)

    const result = findAllSiblingsMatch(currentNode, nodes, true, text => !!text && refPattern.test(text))

    expect(result).toEqual([refNode])
  })

  it('should returns undefined if no match', () => {
    const currentNode = {id: 'currentNode', title: '##_ref'}
    const parent = {id: 'parent', title: 'parent', children: [currentNode.id]}

    currentNode.parent = parent.id

    const nodes = {
      currentNode,
      parent,
    }

    const refPattern = referencePatterns.specificWholeWord('ref', HASHREF_DEF_PREFIX)

    const result = findAllSiblingsMatch(currentNode, nodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual([])
  })

  it('should skip already visited nodes using', () => {
    const refNode = {id: 'refNode', title: '#_ref value'}
    const currentNode = {id: 'currentNode', title: '##_ref'}
    const parent = {id: 'parent', title: 'parent', children: [refNode.id, currentNode.id, refNode.id, refNode.id]}

    refNode.parent = parent.id
    currentNode.parent = parent.id

    const nodes = {
      refNode,
      currentNode,
      parent,
    }

    const refPattern = referencePatterns.specificWholeWord('ref', HASHREF_DEF_PREFIX)

    const result = findAllSiblingsMatch(currentNode, nodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual([refNode])
  })

  it('should traverse up multiple levels to find a match', () => {
    const refNode = {id: 'refNode', title: '#_ref value', depth: 4}
    const refParent1 = {id: 'refParent1', title: 'Ref Parent 1', depth: 3, children: [refNode.id]}
    refNode.parent = refNode.id

    const refParent2 = {id: 'refParent2', title: 'Ref Parent 2', depth: 2, children: [refParent1.id]}
    refParent1.parent = refParent1.id

    const refParent3 = {id: 'refParent3', title: 'Ref Parent 3', depth: 1, children: [refParent2.id]}
    refParent2.parent = refParent3.id

    const currentNode = {id: 'currentNode', title: '##_ref', depth: 1}
    const parent = {id: 'parent', title: 'parent', depth: 0, children: [refParent3.id, currentNode.id]}

    refParent3.parent = parent.id
    currentNode.parent = parent.id

    const nodes = {
      refNode,
      currentNode,
      parent,
      refParent1,
      refParent2,
      refParent3,
    }

    const refPattern = referencePatterns.specificWholeWord('ref', HASHREF_DEF_PREFIX)

    const result = findAllSiblingsMatch(currentNode, nodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual([refNode])
  })

  it('should find both nodes', () => {
    const refNode = {id: 'refNode', title: '#_ref value', depth: 4}
    const refParent1 = {id: 'refParent1', title: 'Ref Parent 1', depth: 3, children: ['refNode']}
    refNode.parent = 'refParent1'

    const refParent2 = {id: 'refParent2', title: 'Ref Parent 2', depth: 2, children: ['refParent1']}
    refParent1.parent = 'refParent2'

    const refParent3 = {id: 'refParent3', title: 'Ref Parent 3', depth: 1, children: ['refParent2']}
    refParent2.parent = 'refParent3'

    const refNode2 = {id: 'refNode2', title: '#_ref value', depth: 3}
    const refParent4 = {id: 'refParent4', title: 'Ref Parent 4', depth: 2, children: ['refNode2']}
    refNode2.parent = 'refParent4'

    const refParent5 = {id: 'refParent5', title: 'Ref Parent 5', depth: 1, children: ['refParent4']}
    refParent4.parent = 'refParent5'

    const currentNode = {id: 'current', title: '##_ref', depth: 1}
    const parent = {
      id: 'parent',
      title: 'parent',
      depth: 0,
      children: ['refParent3', 'refParent5', 'current'],
    }

    refParent3.parent = 'parent'
    refParent5.parent = 'parent'
    currentNode.parent = 'parent'

    const nodes = {
      refNode,
      refParent1,
      refParent2,
      refParent3,
      refNode2,
      refParent4,
      refParent5,
      current: currentNode,
      parent,
    }

    const refPattern = referencePatterns.specificWholeWord('ref', HASHREF_DEF_PREFIX)

    const result = findAllSiblingsMatch(currentNode, nodes, false, text => !!text && refPattern.test(text))

    expect(result).toEqual([refNode, refNode2])
  })
})
