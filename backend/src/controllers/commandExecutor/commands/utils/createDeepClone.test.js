import {resetCounter} from '../../../../shared/utils/generateId'
import {createDeepClone} from './createDeepClone'

jest.mock('../../../../shared/utils/generateId', () => {
  let counter = 0
  return {
    generateNodeId: jest.fn(() => `new-id-${counter++}`),
    resetCounter: () => (counter = 0),
  }
})

describe('createDeepClone', () => {
  afterEach(() => {
    resetCounter()
  })

  it('should create clone of a single node without children', () => {
    const copyNode = {id: 'node1', title: 'Root Node'}
    const parentId = 'parent1'
    const allNodes = {}

    const clonedNodes = createDeepClone(copyNode, parentId, allNodes)

    expect(clonedNodes).toHaveLength(1)
    expect(clonedNodes[0]).toEqual({...copyNode, id: 'new-id-0', parent: parentId, children: [], prompts: []})
  })

  it('should create a deep clone of a node with children', () => {
    const copyNode = {id: 'node1', title: 'Root', children: ['node2']}
    const allNodes = {node2: {id: 'node2', title: 'Child'}}
    const parentId = 'parent1'

    const clonedNodes = createDeepClone(copyNode, parentId, allNodes)

    expect(clonedNodes).toHaveLength(2)
    expect(clonedNodes[0].id).toBe('new-id-0')
    expect(clonedNodes[0].children).toContain('new-id-1')
    expect(clonedNodes[1].id).toBe('new-id-1')
    expect(clonedNodes[1].parent).toBe('new-id-0')
  })

  it('should not create a child if it does not exist in the workflow', () => {
    const copyNode = {id: 'node1', title: 'Root', prompts: ['prompt1'], children: ['prompt1']}
    const allNodes = {}
    const parentId = 'parent1'

    const clonedNodes = createDeepClone(copyNode, parentId, allNodes)

    expect(clonedNodes).toHaveLength(1)
    expect(clonedNodes[0].children).toEqual([])
    expect(clonedNodes[0].prompts).toEqual([])
  })

  it('should create a deep clone of a nested node structure', () => {
    const copyNode = {id: 'node1', title: 'Root', children: ['node2']}
    const allNodes = {
      node2: {id: 'node2', title: 'Child 1', children: ['node3']},
      node3: {id: 'node3', title: 'Child 2', children: ['node4']},
      node4: {id: 'node4', title: 'Child 3'},
    }
    const parentId = 'parent1'

    const clonedNodes = createDeepClone(copyNode, parentId, allNodes)

    expect(clonedNodes).toHaveLength(4)

    expect(clonedNodes[0].id).toBe('new-id-0')
    expect(clonedNodes[0].parent).toBe(parentId)
    expect(clonedNodes[0].children).toContain('new-id-1')

    expect(clonedNodes[1].id).toBe('new-id-1')
    expect(clonedNodes[1].parent).toBe('new-id-0')
    expect(clonedNodes[1].children).toContain('new-id-2')

    expect(clonedNodes[2].id).toBe('new-id-2')
    expect(clonedNodes[2].parent).toBe('new-id-1')
    expect(clonedNodes[2].children).toContain('new-id-3')

    expect(clonedNodes[3].id).toBe('new-id-3')
    expect(clonedNodes[3].parent).toBe('new-id-2')
    expect(clonedNodes[3].children).toEqual([])
  })
})
