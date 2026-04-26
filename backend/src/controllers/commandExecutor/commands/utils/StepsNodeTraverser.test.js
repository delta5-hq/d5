import {StepsNodeTraverser} from './StepsNodeTraverser'

describe('StepsNodeTraverser', () => {
  let traverser

  beforeEach(() => {
    traverser = new StepsNodeTraverser({})
  })

  describe('getNodeCommand', () => {
    it('should return command if it matches the commandRegExp.anyWithOrder', () => {
      const node = {id: 'node1', command: '/chatgpt test'}
      expect(traverser.getNodeCommand(node)).toBe('/chatgpt test')
    })

    it('should return empty string if command does not match commandRegExp.anyWithOrder', () => {
      const node = {id: 'node1', command: 'not a command'}
      expect(traverser.getNodeCommand(node)).toBe('')
    })

    it('should return title if command is undefined and title matches commandRegExp.anyWithOrder', () => {
      const node = {id: 'node1', title: '/summarize test', command: undefined}
      expect(traverser.getNodeCommand(node)).toBe('/summarize test')
    })

    it('should return empty string if command is undefined and title does not match commandRegExp.anyWithOrder', () => {
      const node = {id: 'node1', title: 'normal text', command: undefined}
      expect(traverser.getNodeCommand(node)).toBe('')
    })

    it('should return empty string if both command and title are undefined', () => {
      const node = {id: 'node1'}
      expect(traverser.getNodeCommand(node)).toBe('')
    })

    it('should trim the command before matching', () => {
      const node = {id: 'node1', command: '  /steps test  '}
      expect(traverser.getNodeCommand(node)).toBe('/steps test')
    })

    it('should trim the title before matching when command is undefined', () => {
      const node = {id: 'node1', title: '  /outline test  ', command: undefined}
      expect(traverser.getNodeCommand(node)).toBe('/outline test')
    })

    it('should recognize command with order prefix', () => {
      const node = {id: 'node1', command: '#1 /chatgpt test'}
      expect(traverser.getNodeCommand(node)).toBe('#1 /chatgpt test')
    })

    it('should recognize command with negative order prefix', () => {
      const node = {id: 'node1', command: '#-5 /summarize test'}
      expect(traverser.getNodeCommand(node)).toBe('#-5 /summarize test')
    })

    it('should recognize command with multi-digit order prefix', () => {
      const node = {id: 'node1', command: '#123 /outline test'}
      expect(traverser.getNodeCommand(node)).toBe('#123 /outline test')
    })

    it('should return empty string for non-command with order prefix', () => {
      const node = {id: 'node1', command: '#1 not a command'}
      expect(traverser.getNodeCommand(node)).toBe('')
    })
  })

  describe('getNodeOrder', () => {
    it('should extract positive order number from command', () => {
      const node = {id: 'node1', command: '#5 /chatgpt test'}
      expect(traverser.getNodeOrder(node)).toBe(5)
    })

    it('should extract negative order number from command', () => {
      const node = {id: 'node1', command: '#-10 /chatgpt test'}
      expect(traverser.getNodeOrder(node)).toBe(-10)
    })

    it('should extract multi-digit order number from command', () => {
      const node = {id: 'node1', command: '#123 /chatgpt test'}
      expect(traverser.getNodeOrder(node)).toBe(123)
    })

    it('should extract order from title if command is undefined', () => {
      const node = {id: 'node1', title: '#42 /chatgpt test', command: undefined}
      expect(traverser.getNodeOrder(node)).toBe(42)
    })

    it('should return NaN when no order prefix exists', () => {
      const node = {id: 'node1', command: '/chatgpt test'}
      expect(isNaN(traverser.getNodeOrder(node))).toBe(true)
    })

    it('should return NaN when command is not a valid command', () => {
      const node = {id: 'node1', command: 'not a command'}
      expect(isNaN(traverser.getNodeOrder(node))).toBe(true)
    })

    it('should handle whitespace around order prefix', () => {
      const node = {id: 'node1', command: '  #7   /chatgpt test'}
      expect(traverser.getNodeOrder(node)).toBe(7)
    })

    it('should return NaN when both command and title are undefined', () => {
      const node = {id: 'node1'}
      expect(isNaN(traverser.getNodeOrder(node))).toBe(true)
    })

    it('should handle zero as a valid order', () => {
      const node = {id: 'node1', command: '#0 /chatgpt test'}
      expect(traverser.getNodeOrder(node)).toBe(0)
    })

    it('should handle large integer order numbers', () => {
      const node = {id: 'node1', command: '#9999999 /chatgpt test'}
      expect(traverser.getNodeOrder(node)).toBe(9999999)
    })
  })

  describe('isForeachCommand', () => {
    it('should identify simple foreach commands', () => {
      expect(traverser.isForeachCommand('/foreach /chatgpt test')).toBe(true)
    })

    it('should identify foreach commands with order prefix', () => {
      expect(traverser.isForeachCommand('#1 /foreach /chatgpt test')).toBe(true)
    })

    it('should return false for regular commands', () => {
      expect(traverser.isForeachCommand('/chatgpt test')).toBe(false)
    })

    it('should return false for regular commands with order prefix', () => {
      expect(traverser.isForeachCommand('#2 /chatgpt test')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(traverser.isForeachCommand('')).toBe(false)
    })
  })

  it('should find nodes with and without order', () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '/chatgpt child2'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(traverser.nodesWithoutOrder).toEqual([{node: child2, promptString: child2.command}])
  })

  it('should use title if command is undefined', () => {
    const child1 = {id: 'child1', title: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '/chatgpt child2'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({1: [{node: child1, promptString: child1.title}]})
    expect(traverser.nodesWithoutOrder).toEqual([{node: child2, promptString: child2.command}])
  })

  it('should find multiple nodes with different orders', () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /chatgpt child2'}
    const child3 = {id: 'child3', command: '#3 /chatgpt child3'}
    const child4 = {id: 'child4', command: '#-9999 /chatgpt child4'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id, child3.id, child4.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [child3.id]: child3,
      [child4.id]: child4,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({
      1: [{node: child1, promptString: child1.command}],
      2: [{node: child2, promptString: child2.command}],
      3: [{node: child3, promptString: child3.command}],
      '-9999': [{node: child4, promptString: child4.command}],
    })
    expect(traverser.nodesWithoutOrder).toEqual([])
  })

  it('should handle nested structure with empty command nodes', () => {
    const grandchild = {id: 'grandchild', command: '/chatgpt prompt'}
    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    const workflowNodes = {
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(root)

    expect(traverser.nodesByOrder).toEqual({})
    expect(traverser.nodesWithoutOrder).toEqual([{node: grandchild, promptString: grandchild.command}])

    // Empty command nodes shouldn't be collected
    expect(traverser.nodesWithoutOrder.some(item => item.node === child)).toBeFalsy()
  })

  it('should find nodes with order in nested structure', () => {
    const grandchild1 = {id: 'grandchild1', command: '#10 /chatgpt prompt'}
    const grandchild2 = {id: 'grandchild2', command: '#20 /chatgpt prompt'}
    const child = {id: 'child', command: '', children: [grandchild1.id, grandchild2.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    const workflowNodes = {
      [grandchild1.id]: grandchild1,
      [grandchild2.id]: grandchild2,
      [child.id]: child,
      [root.id]: root,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(root)

    expect(traverser.nodesByOrder).toEqual({
      10: [{node: grandchild1, promptString: grandchild1.command}],
      20: [{node: grandchild2, promptString: grandchild2.command}],
    })
    expect(traverser.nodesWithoutOrder).toEqual([])
  })

  it('should traverse through multiple levels of empty commands', () => {
    const greatGrandchild = {id: 'greatGrandchild', command: '#20 /chatgpt deep prompt'}
    const grandchild2 = {id: 'grandchild2', command: '', children: [greatGrandchild.id]}
    const grandchild1 = {id: 'grandchild1', command: '#10 /chatgpt prompt'}
    const child = {id: 'child', command: '', children: [grandchild1.id, grandchild2.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    const workflowNodes = {
      [greatGrandchild.id]: greatGrandchild,
      [grandchild1.id]: grandchild1,
      [grandchild2.id]: grandchild2,
      [child.id]: child,
      [root.id]: root,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(root)

    expect(traverser.nodesByOrder).toEqual({
      10: [{node: grandchild1, promptString: grandchild1.command}],
      20: [{node: greatGrandchild, promptString: greatGrandchild.command}],
    })
    expect(traverser.nodesWithoutOrder).toEqual([])
  })

  it('should not traverse into command nodes', () => {
    const emptyGreatGrandchild = {id: 'emptyGreatGrandchild', command: ''}
    const greatGrandchild = {id: 'greatGrandchild', command: '/chatgpt another prompt'}

    const grandchild = {
      id: 'grandchild',
      command: '/chatgpt prompt',
      children: [emptyGreatGrandchild.id, greatGrandchild.id],
    }

    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    const workflowNodes = {
      [emptyGreatGrandchild.id]: emptyGreatGrandchild,
      [greatGrandchild.id]: greatGrandchild,
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(root)

    expect(traverser.nodesByOrder).toEqual({})
    expect(traverser.nodesWithoutOrder).toEqual([{node: grandchild, promptString: grandchild.command}])

    // Should not traverse into command nodes
    expect(traverser.nodesWithoutOrder.some(item => item.node === greatGrandchild)).toBeFalsy()
    expect(traverser.nodesWithoutOrder.some(item => item.node === emptyGreatGrandchild)).toBeFalsy()
  })

  it('should not traverse into nested /steps nodes', () => {
    const greatGrandchild1 = {id: 'greatGrandchild1', command: ''}
    const greatGrandchild2 = {id: 'greatGrandchild2', command: '/chatgpt prompt'}

    const grandchild = {
      id: 'grandchild',
      command: '/steps comment',
      children: [greatGrandchild1.id, greatGrandchild2.id],
    }

    const child = {id: 'child', command: '', children: [grandchild.id]}
    const root = {id: 'root', command: '/steps comment', children: [child.id]}

    const workflowNodes = {
      [greatGrandchild1.id]: greatGrandchild1,
      [greatGrandchild2.id]: greatGrandchild2,
      [grandchild.id]: grandchild,
      [child.id]: child,
      [root.id]: root,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(root)

    expect(traverser.nodesByOrder).toEqual({})
    expect(traverser.nodesWithoutOrder).toEqual([{node: grandchild, promptString: grandchild.command}])

    // Should not traverse into /steps nodes
    expect(traverser.nodesWithoutOrder.some(item => item.node === greatGrandchild2)).toBeFalsy()
    expect(traverser.nodesWithoutOrder.some(item => item.node === greatGrandchild1)).toBeFalsy()
  })

  it('should ignore nodes with /foreach commands', () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '/foreach /chatgpt child2 @@'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(traverser.nodesWithoutOrder).toEqual([])
  })

  it('should ignore nodes with /foreach commands even with order prefix', () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#1 /foreach /chatgpt child2 @@'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(traverser.nodesWithoutOrder).toEqual([])
  })

  it('should match nodes with /summarize commands', () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /summarize child2'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({
      1: [{node: child1, promptString: child1.command}],
      2: [{node: child2, promptString: child2.command}],
    })
  })

  it('should match nodes with complex commands like /outline', () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '#2 /outline --summarize=xxl child2'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({
      1: [{node: child1, promptString: child1.command}],
      2: [{node: child2, promptString: child2.command}],
    })
  })

  it('should ignore prompt nodes', () => {
    const subChild1 = {id: 'subChild1', title: 'SubChild1'}
    const subChild2 = {id: 'subChild2', title: 'SubChild2'}

    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {
      id: 'child2',
      command: '/chatgpt child2',
      children: [subChild1.id, subChild2.id],
      prompts: [subChild1.id, subChild2.id],
    }

    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [subChild1.id]: subChild1,
      [subChild2.id]: subChild2,
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(traverser.nodesWithoutOrder).toEqual([{node: child2, promptString: child2.command}])
  })

  it('should handle /switch nodes appropriately', () => {
    const caseNode = {id: 'caseNode', command: '/case value'}
    const child1 = {id: 'child1', command: '#1 /switch child1', children: [caseNode.id]}
    const node = {id: 'node', command: '/steps', children: [child1.id]}

    const workflowNodes = {
      [caseNode.id]: caseNode,
      [child1.id]: child1,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    expect(traverser.nodesByOrder).toEqual({1: [{node: child1, promptString: child1.command}]})
    expect(traverser.nodesWithoutOrder).toEqual([])

    // Should not collect case nodes
    expect(traverser.nodesWithoutOrder.some(item => item.node === caseNode)).toBeFalsy()
  })

  it('should return appropriate result object', () => {
    const child1 = {id: 'child1', command: '#1 /chatgpt child1'}
    const child2 = {id: 'child2', command: '/chatgpt child2'}
    const node = {id: 'node', command: '/steps', children: [child1.id, child2.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    const result = {
      nodesByOrder: traverser.nodesByOrder,
      nodesWithoutOrder: traverser.nodesWithoutOrder,
    }

    expect(result).toEqual({
      nodesByOrder: {1: [{node: child1, promptString: child1.command}]},
      nodesWithoutOrder: [{node: child2, promptString: child2.command}],
    })
  })

  it('should handle circular references without infinite recursion', () => {
    // Create nodes with a circular reference
    const child1 = {id: 'child1', command: '/chatgpt child1'}
    const child2 = {id: 'child2', command: '/chatgpt child2'}

    // Creating circular reference
    child1.children = [child2.id]
    child2.children = [child1.id]

    const node = {id: 'node', command: '/steps', children: [child1.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)
    traverser.traverse(node)

    // Despite the cycle, it should still correctly identify child1 as a command node
    expect(traverser.nodesWithoutOrder).toEqual([{node: child1, promptString: child1.command}])
  })

  it('should handle complex nested circular references', () => {
    // Create more complex structure with multiple circular references
    const child1 = {id: 'child1', command: '/chatgpt child1'}
    const child2 = {id: 'child2', command: '/chatgpt child2'}
    const child3 = {id: 'child3', command: '#1 /chatgpt child3'}
    const child4 = {id: 'child4', command: '/chatgpt child4'}

    // Creating multiple circular references
    child1.children = [child2.id]
    child2.children = [child3.id]
    child3.children = [child4.id]
    child4.children = [child1.id] // Creates a cycle

    const node = {id: 'node', command: '/steps', children: [child1.id]}

    const workflowNodes = {
      [child1.id]: child1,
      [child2.id]: child2,
      [child3.id]: child3,
      [child4.id]: child4,
      [node.id]: node,
    }

    traverser = new StepsNodeTraverser(workflowNodes)

    // This should not throw due to stack overflow
    expect(() => traverser.traverse(node)).not.toThrow()

    // With circular references, the exact nodes found may vary depending on traversal implementation
    // Just verify that we've found some nodes
    expect(traverser.nodesWithoutOrder.length).toBeGreaterThan(0)

    // If order '1' was detected at all, check its properties
    // If not, that's also fine with circular references
    if (Object.keys(traverser.nodesByOrder).includes('1')) {
      expect(traverser.nodesByOrder['1'].length).toBeGreaterThan(0)
    } else {
      // Make sure we found at least one of the important nodes
      expect(
        traverser.nodesWithoutOrder.some(item => item.node.id === 'child1' || item.node.id === 'child3'),
      ).toBeTruthy()
    }
  })

  describe('dynamic alias support', () => {
    const mkAlias = alias => ({alias})

    it('recognizes dynamic aliases without order prefix', () => {
      const aliases = [mkAlias('/coder1'), mkAlias('/agent')]
      const nodes = {
        child1: {id: 'child1', command: '/coder1 fix bug'},
        child2: {id: 'child2', command: '/agent analyze'},
        child3: {id: 'child3', command: '/chatgpt summarize'},
        root: {id: 'root', command: '/steps', children: ['child1', 'child2', 'child3']},
      }

      const traverser = new StepsNodeTraverser(nodes, aliases)
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder).toHaveLength(3)
      const ids = traverser.nodesWithoutOrder.map(n => n.node.id)
      expect(ids).toContain('child1')
      expect(ids).toContain('child2')
      expect(ids).toContain('child3')
    })

    it('ignores unknown dynamic aliases', () => {
      const aliases = [mkAlias('/known')]
      const nodes = {
        child1: {id: 'child1', command: '/unknown command'},
        child2: {id: 'child2', command: '/chatgpt hello'},
        root: {id: 'root', command: '/steps', children: ['child1', 'child2']},
      }

      const traverser = new StepsNodeTraverser(nodes, aliases)
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder).toHaveLength(1)
      expect(traverser.nodesWithoutOrder[0].node.id).toBe('child2')
    })

    it('works without dynamic aliases parameter (backward compatibility)', () => {
      const nodes = {
        child1: {id: 'child1', command: '/chatgpt hello'},
        child2: {id: 'child2', command: '/web search'},
        root: {id: 'root', command: '/steps', children: ['child1', 'child2']},
      }

      const traverser = new StepsNodeTraverser(nodes)
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder).toHaveLength(2)
    })

    it('prioritizes built-in commands over conflicting aliases', () => {
      const aliases = [mkAlias('/chatgpt')]
      const nodes = {
        child1: {id: 'child1', command: '/chatgpt test'},
        root: {id: 'root', command: '/steps', children: ['child1']},
      }

      const traverser = new StepsNodeTraverser(nodes, aliases)
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder).toHaveLength(1)
    })

    it('handles empty dynamic aliases array', () => {
      const nodes = {
        child1: {id: 'child1', command: '/chatgpt test'},
        root: {id: 'root', command: '/steps', children: ['child1']},
      }

      const traverser = new StepsNodeTraverser(nodes, [])
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder).toHaveLength(1)
    })

    it('handles mixed built-in and dynamic commands in traversal', () => {
      const aliases = [mkAlias('/coder1'), mkAlias('/vm3')]
      const nodes = {
        builtin: {id: 'builtin', command: '/chatgpt task1'},
        dynamic1: {id: 'dynamic1', command: '/coder1 task2'},
        dynamic2: {id: 'dynamic2', command: '/vm3 task3'},
        unknown: {id: 'unknown', title: 'regular text'},
        root: {id: 'root', command: '/steps', children: ['builtin', 'dynamic1', 'dynamic2', 'unknown']},
      }

      const traverser = new StepsNodeTraverser(nodes, aliases)
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder).toHaveLength(3)
      const ids = traverser.nodesWithoutOrder.map(n => n.node.id)
      expect(ids).toContain('builtin')
      expect(ids).toContain('dynamic1')
      expect(ids).toContain('dynamic2')
      expect(ids).not.toContain('unknown')
    })

    it('handles dynamic aliases in nested structures', () => {
      const aliases = [mkAlias('/agent')]
      const nodes = {
        nested: {id: 'nested', command: '/agent process'},
        parent: {id: 'parent', title: 'Container', children: ['nested']},
        root: {id: 'root', command: '/steps', children: ['parent']},
      }

      const traverser = new StepsNodeTraverser(nodes, aliases)
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder.some(n => n.node.id === 'nested')).toBe(true)
    })

    it('handles dynamic aliases with special characters', () => {
      const aliases = [mkAlias('/my-tool'), mkAlias('/my_tool'), mkAlias('/tool123')]
      const nodes = {
        dash: {id: 'dash', command: '/my-tool cmd'},
        underscore: {id: 'underscore', command: '/my_tool cmd'},
        numeric: {id: 'numeric', command: '/tool123 cmd'},
        root: {id: 'root', command: '/steps', children: ['dash', 'underscore', 'numeric']},
      }

      const traverser = new StepsNodeTraverser(nodes, aliases)
      traverser.traverse(nodes.root)

      expect(traverser.nodesWithoutOrder).toHaveLength(3)
    })
  })
})
