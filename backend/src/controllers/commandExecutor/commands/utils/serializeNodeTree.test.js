import serializeNodeTree from './serializeNodeTree'

describe('serializeNodeTree', () => {
  describe('node label resolution', () => {
    it('uses title when present', () => {
      const node = {id: '1', title: 'My Node', children: []}
      expect(serializeNodeTree([node], {1: node})).toBe('My Node')
    })

    it('falls back to (table) when title absent and gridOptions present', () => {
      const node = {id: '1', gridOptions: {columnDefs: []}, children: []}
      expect(serializeNodeTree([node], {1: node})).toBe('(table)')
    })

    it('falls back to (untitled) when title absent and no gridOptions', () => {
      const node = {id: '1', children: []}
      expect(serializeNodeTree([node], {1: node})).toBe('(untitled)')
    })

    it('prefers title over gridOptions when both are present', () => {
      const node = {id: '1', title: 'Named Table', gridOptions: {columnDefs: []}, children: []}
      expect(serializeNodeTree([node], {1: node})).toBe('Named Table')
    })
  })

  describe('tree structure', () => {
    it('indents children relative to their depth', () => {
      const allNodes = {
        1: {id: '1', title: 'Root', children: ['2', '3']},
        2: {id: '2', title: 'Child 1', children: []},
        3: {id: '3', title: 'Child 2', children: ['4']},
        4: {id: '4', title: 'Grandchild', children: []},
      }
      expect(serializeNodeTree([allNodes['1']], allNodes)).toBe('Root\n  Child 1\n  Child 2\n    Grandchild')
    })

    it('joins multiple root nodes with single newline', () => {
      const outputNodes = [
        {id: '1', title: 'Root1'},
        {id: '2', title: 'Root2'},
      ]
      expect(serializeNodeTree(outputNodes, Object.fromEntries(outputNodes.map(n => [n.id, n])))).toBe('Root1\nRoot2')
    })

    it('treats a node as root only when its parent id is not among outputNodes', () => {
      const allNodes = {
        1: {id: '1', title: 'Parent', children: ['2']},
        2: {id: '2', title: 'Child', parent: '1', children: []},
      }
      expect(serializeNodeTree([allNodes['1'], allNodes['2']], allNodes)).toBe('Parent\n  Child')
    })

    it('skips child ids absent from allNodes without error', () => {
      const node = {id: '1', title: 'Parent', children: ['missing']}
      expect(serializeNodeTree([node], {1: node})).toBe('Parent')
    })
  })

  describe('boundary conditions', () => {
    it('returns empty string for empty outputNodes', () => {
      expect(serializeNodeTree([], {})).toBe('')
    })
  })
})
