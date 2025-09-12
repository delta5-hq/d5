import {createContextForChat} from './createContextForChat'

describe('createContextForChat', () => {
  it('should return an empty context when provided title is empty', () => {
    const context = createContextForChat({title: ''}, {maxLength: 100})
    expect(context).toBe('Context:\n```\n```\n')
  })

  it('should create context with node title when title is not empty', () => {
    const node = {title: 'Title'}
    const context = createContextForChat(node, {maxLength: 100})
    expect(context).toBe('Context:\n```\nTitle\n```\n')
  })

  it('should not include commands in the context', () => {
    const node = {title: '/chatgpt sample command'}
    const context = createContextForChat(node, {maxLength: 100})
    expect(context).not.toContain(node.title)
  })

  it('should trim extra spaces from the title', () => {
    const node = {title: '  Title  '}
    const context = createContextForChat(node, {maxLength: 100})
    expect(context).toContain(node.title?.trim())
  })

  it('should handle long titles exceeding maxLength', () => {
    const node = {title: 'Very long title'.repeat(10)}
    const context = createContextForChat(node, {maxLength: 5})
    expect(context).toBe('Context:\n```\n```\n')
  })

  it('should include node title even if it contains newlines', () => {
    const node = {title: 'Title\nwith\nnewlines'}
    const context = createContextForChat(node, {maxLength: 100})
    expect(context).toBe('Context:\n```\nTitle\nwith\nnewlines\n```\n')
  })

  it('should handle indentation correctly', () => {
    const node = {title: 'Sample Title'}
    const context = createContextForChat(
      node,
      {maxLength: 100, parents: 0, indent: 2},
      'Context:\n```\nIndented Title\n```\n',
    )
    expect(context).toBe('Context:\n```\nSample Title\n  Indented Title\n```\n')
  })

  it('should exclude parent title', () => {
    const parent = {id: 'parent', title: 'Parent Node'}
    const node = {id: 'node', title: 'Child Node', parent: parent.id}
    const allNodes = {
      node,
      parent,
    }

    const context = createContextForChat(node, {allNodes, maxLength: 100, parents: 1})
    expect(context).toBe('Context:\n```\nChild Node\n```\n')
  })

  it('should stop including parent title when parent isRoot', () => {
    const parent = {id: 'parent', title: 'Parent Node'}
    const node = {title: 'Child Node', isRoot: false, parent: parent.id}
    const allNodes = {
      parent,
      node,
    }

    const context = createContextForChat(node, {allNodes, maxLength: 100, parents: 1})
    expect(context).not.toContain('Parent Node')
    expect(context).toContain('Context:\n```\nChild Node\n```\n')
  })

  it('should handle multiple levels of parents', () => {
    const grandParent = {id: 'grandParent', title: 'Grandparent Node', parent: 'root'}
    const parent = {id: 'parent', title: 'Parent Node', parent: grandParent.id}
    const node = {id: 'node', title: 'Child Node', parent: parent.id}
    const allNodes = {
      grandParent,
      parent,
      node,
    }

    const context = createContextForChat(node, {allNodes, maxLength: 100, parents: 3})
    expect(context).toBe('Context:\n```\nGrandparent Node\n  Parent Node\n    Child Node\n```\n')
  })

  it('should exclude root node', () => {
    const root = {id: 'root', title: 'Unnamed Workflow'}
    const grandParent = {id: 'grandParent', title: 'Grandparent Node', parent: root.id}
    const parent = {id: 'parent', title: 'Parent Node', parent: grandParent.id}
    const node = {id: 'node', title: 'Child Node', parent: parent.id}
    const allNodes = {
      grandParent,
      parent,
      node,
      root,
    }

    const context = createContextForChat(node, {allNodes, maxLength: 100, parents: 10})
    expect(context).toBe('Context:\n```\nGrandparent Node\n  Parent Node\n    Child Node\n```\n')
  })
})
