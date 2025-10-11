import Store from './Store'

describe('Store', () => {
  let store

  beforeEach(() => {
    store = new Store({userId: 'test-user-123'})
  })

  describe('constructor', () => {
    it('should create a store with optional parameters', () => {
      const nodes = {'node-1': {id: 'node-1', title: 'Test Node'}}
      const edges = {'edge-1': {id: 'edge-1', start: 'node-1', end: 'node-2'}}
      const files = {'file-1': 'file content'}

      const storeWithData = new Store({
        userId: 'test-user-123',
        workflowId: 'test-map-123',
        nodes,
        edges,
        files,
      })

      expect(storeWithData._workflowId).toBe('test-map-123')
      expect(storeWithData._nodes).toEqual(nodes)
      expect(storeWithData._edges).toEqual(edges)
      expect(storeWithData._files).toEqual(files)
    })

    it('should throw error when userId is missing', () => {
      expect(() => new Store()).toThrow('User ID is required')
      expect(() => new Store({})).toThrow('User ID is required')
      expect(() => new Store({userId: ''})).toThrow('User ID is required')
    })

    it('should throw error when nodes is invalid', () => {
      expect(() => new Store({userId: 'test', nodes: 'invalid'})).toThrow('Nodes must be a Record<string, NodeData>')
    })

    it('should throw error when edges is invalid', () => {
      expect(() => new Store({userId: 'test', edges: 'invalid'})).toThrow('Edges must be a Record<string, EdgeData>')
    })

    it('should throw error when files is invalid', () => {
      expect(() => new Store({userId: 'test', files: 'invalid'})).toThrow('Files must be a Record<string, string>')
    })
  })

  describe('createNode', () => {
    it('should create a node with valid data', () => {
      const nodeData = {
        title: 'Test Node',
        color: '#ff0000',
        x: 100,
        y: 200,
      }

      const createdNode = store.createNode(nodeData)

      expect(createdNode.id).toBeDefined()
      expect(createdNode.title).toBe('Test Node')
      expect(createdNode.color).toBe('#ff0000')
      expect(createdNode.x).toBe(100)
      expect(createdNode.y).toBe(200)
      expect(store._nodes[createdNode.id]).toEqual(createdNode)
      expect(store._output.nodes).toContain(createdNode.id)
    })

    it('should create a node with existing id', () => {
      const nodeData = {
        id: 'custom-node-id',
        title: 'Test Node',
      }

      const createdNode = store.createNode(nodeData)

      expect(createdNode.id).toBe('custom-node-id')
      expect(store._nodes['custom-node-id']).toEqual(createdNode)
    })

    it('should generate new id when provided id already exists', () => {
      const existingNode = store.createNode({id: 'node-1', title: 'Existing Node'})

      const newNodeData = {id: 'node-1', title: 'New Node'}
      const newNode = store.createNode(newNodeData)

      expect(newNode.id).not.toBe('node-1')
      expect(newNode.title).toBe('New Node')
      expect(store._nodes[existingNode.id]).toEqual(existingNode)
      expect(store._nodes[newNode.id]).toEqual(newNode)
    })

    it('should update parent node children when creating child node', () => {
      const parentNode = store.createNode({title: 'Parent Node'})
      const childNode = store.createNode({
        title: 'Child Node',
        parent: parentNode.id,
      })

      expect(store._nodes[parentNode.id].children).toContain(childNode.id)
    })

    it('should set prompts when isPrompt is true', () => {
      const parentNode = store.createNode({title: 'Parent Node'})
      const promptNode = store.createNode(
        {
          title: 'Prompt Node',
          parent: parentNode.id,
        },
        true,
      )

      expect(store._nodes[parentNode.id].prompts).toEqual([promptNode.id])
    })

    it('should filter out previous prompts from children', () => {
      const parentNode = store.createNode({title: 'Parent Node'})
      const oldPrompt = store.createNode(
        {
          title: 'Old Prompt',
          parent: parentNode.id,
        },
        true,
      )

      const newPrompt = store.createNode(
        {
          title: 'New Prompt',
          parent: parentNode.id,
        },
        true,
      )

      expect(store._nodes[parentNode.id].children).not.toContain(oldPrompt.id)
      expect(store._nodes[parentNode.id].prompts).toEqual([newPrompt.id])
    })

    it('should throw error when node data is invalid', () => {
      expect(() => store.createNode(null)).toThrow('NodeData must be an object')
      expect(() => store.createNode('invalid')).toThrow('NodeData must be an object')
      expect(() => store.createNode({id: 123})).toThrow('Node "[unknown id]": "id" is required and must be a string')
    })
  })

  describe('editNode', () => {
    it('should edit existing node', () => {
      const originalNode = store.createNode({title: 'Original Title'})

      const editData = {
        id: originalNode.id,
        title: 'Updated Title',
        color: '#00ff00',
      }

      const editedNode = store.editNode(editData)

      expect(editedNode.title).toBe('Updated Title')
      expect(editedNode.color).toBe('#00ff00')
      expect(store._nodes[originalNode.id]).toEqual(editedNode)
      expect(store._output.nodes).toContain(originalNode.id)
    })

    it('should create new node when id does not exist', () => {
      const editData = {
        id: 'non-existent-id',
        title: 'New Node',
      }

      const result = store.editNode(editData)

      expect(result.id).toBe('non-existent-id')
      expect(result.title).toBe('New Node')
      expect(store._nodes['non-existent-id']).toEqual(result)
    })

    it('should preserve existing properties not in edit data', () => {
      const originalNode = store.createNode({
        title: 'Original Title',
        color: '#ff0000',
        x: 100,
        y: 200,
      })

      const editData = {
        id: originalNode.id,
        title: 'Updated Title',
      }

      const editedNode = store.editNode(editData)

      expect(editedNode.title).toBe('Updated Title')
      expect(editedNode.color).toBe('#ff0000')
      expect(editedNode.x).toBe(100)
      expect(editedNode.y).toBe(200)
    })

    it('should throw error when edit data is invalid', () => {
      expect(() => store.editNode(null)).toThrow('NodeData must be an object')
      expect(() => store.editNode({id: 123})).toThrow('Node "[unknown id]": "id" is required and must be a string')
    })
  })

  describe('createEdge', () => {
    it('should create an edge with valid data', () => {
      const edgeData = {
        start: 'node-1',
        end: 'node-2',
        title: 'Test Edge',
      }

      const createdEdge = store.createEdge(edgeData)

      expect(createdEdge.id).toBeDefined()
      expect(createdEdge.start).toBe('node-1')
      expect(createdEdge.end).toBe('node-2')
      expect(createdEdge.title).toBe('Test Edge')
      expect(store._edges[createdEdge.id]).toEqual(createdEdge)
      expect(store._output.edges).toContain(createdEdge.id)
    })

    it('should create an edge with existing id', () => {
      const edgeData = {
        id: 'custom-edge-id',
        start: 'node-1',
        end: 'node-2',
      }

      const createdEdge = store.createEdge(edgeData)

      expect(createdEdge.id).toBe('custom-edge-id')
      expect(store._edges['custom-edge-id']).toEqual(createdEdge)
    })

    it('should throw error when edge with same id already exists', () => {
      const edgeData = {
        id: 'edge-1',
        start: 'node-1',
        end: 'node-2',
      }

      store.createEdge(edgeData)

      expect(() => store.createEdge(edgeData)).toThrow('Edge edge-1 already exists')
    })

    it('should throw error when edge data is invalid', () => {
      expect(() => store.createEdge(null)).toThrow('Edge must be an object')
      expect(() => store.createEdge({start: 'node-1', end: 123})).toThrow(
        'Edge "undefined" has invalid "end" (must be a non-empty string)',
      )
    })
  })

  describe('editEdge', () => {
    it('should edit existing edge', () => {
      const originalEdge = store.createEdge({
        id: 'node-1:node-2',
        start: 'node-1',
        end: 'node-2',
        title: 'Original Title',
      })

      const editData = {
        id: originalEdge.id,
        title: 'Updated Title',
      }

      const editedEdge = store.editEdge(editData)

      expect(editedEdge.title).toBe('Updated Title')
      expect(editedEdge.start).toBe('node-1')
      expect(editedEdge.end).toBe('node-2')
      expect(store._edges[originalEdge.id]).toEqual(editedEdge)
      expect(store._output.edges).toContain(originalEdge.id)
    })

    it('should create new edge when id does not exist', () => {
      const editData = {
        id: 'non-existent-edge',
        start: 'node-1',
        end: 'node-2',
      }

      const result = store.editEdge(editData)

      expect(result.id).toBe('non-existent-edge')
      expect(result.start).toBe('node-1')
      expect(result.end).toBe('node-2')
      expect(store._edges['non-existent-edge']).toEqual(result)
    })

    it('should preserve existing properties not in edit data', () => {
      const edge = store.createEdge({
        id: 'node-1:node-2',
        start: 'node-1',
        end: 'node-2',
        title: 'Original Title',
      })

      const editData = {
        id: edge.id,
        title: 'Updated Title',
      }

      const editedEdge = store.editEdge(editData)

      expect(editedEdge.title).toBe('Updated Title')
      expect(editedEdge.start).toBe('node-1')
      expect(editedEdge.end).toBe('node-2')
    })

    it('should throw error when edit data is invalid', () => {
      expect(() => store.editEdge(null)).toThrow('Edge must be an object')
      expect(() => store.editEdge({id: 'edge-1', start: 123})).toThrow(
        'Edge "edge-1" has invalid "start" (must be a non-empty string)',
      )
    })
  })

  describe('createFile', () => {
    it('should create a file with valid content', () => {
      const nodeId = 'node-1'
      const fileContent = 'This is file content'

      store.createFile(nodeId, fileContent)

      expect(store._files[nodeId]).toBe(fileContent)
    })

    it('should not create file when content is null', () => {
      const nodeId = 'node-1'
      const fileContent = null

      store.createFile(nodeId, fileContent)

      expect(store._files[nodeId]).toBeUndefined()
    })

    it('should not create file when content is undefined', () => {
      const nodeId = 'node-1'
      const fileContent = undefined

      store.createFile(nodeId, fileContent)

      expect(store._files[nodeId]).toBeUndefined()
    })

    it('should not create file when content is not a string', () => {
      const nodeId = 'node-1'
      const fileContent = 123

      store.createFile(nodeId, fileContent)

      expect(store._files[nodeId]).toBeUndefined()
    })

    it('should throw error when fileId is missing', () => {
      expect(() => store.createFile()).toThrow('File ID is required')
      expect(() => store.createFile(null, 'content')).toThrow('File ID is required')
      expect(() => store.createFile('', 'content')).toThrow('File ID is required')
    })

    it('should overwrite existing file content', () => {
      const nodeId = 'node-1'
      const originalContent = 'Original content'
      const newContent = 'New content'

      store.createFile(nodeId, originalContent)
      store.createFile(nodeId, newContent)

      expect(store._files[nodeId]).toBe(newContent)
    })
  })

  describe('addPromptsToNode', () => {
    it('should add prompts to existing node', () => {
      const node = store.createNode({title: 'Parent Node'})
      const prompt1 = store.createNode({title: 'Prompt 1'})
      const prompt2 = store.createNode({title: 'Prompt 2'})

      store.addPromptsToNode(node.id, [prompt1.id, prompt2.id])

      expect(store._nodes[node.id].prompts).toEqual([prompt1.id, prompt2.id])
    })

    it('should replace existing prompts', () => {
      const node = store.createNode({title: 'Parent Node'})
      const oldPrompt = store.createNode({title: 'Old Prompt'})
      const newPrompt1 = store.createNode({title: 'New Prompt 1'})
      const newPrompt2 = store.createNode({title: 'New Prompt 2'})

      // Set initial prompts
      store.addPromptsToNode(node.id, [oldPrompt.id])

      // Replace with new prompts
      store.addPromptsToNode(node.id, [newPrompt1.id, newPrompt2.id])

      expect(store._nodes[node.id].prompts).toEqual([newPrompt1.id, newPrompt2.id])
    })

    it('should handle empty prompts array', () => {
      const node = store.createNode({title: 'Parent Node'})

      store.addPromptsToNode(node.id, [])

      expect(store._nodes[node.id].prompts).toEqual([])
    })

    it('should do nothing when node does not exist', () => {
      expect(() => store.addPromptsToNode('non-existent-node', ['prompt-1'])).not.toThrow()
    })
  })

  describe('getOutput', () => {
    it('should return empty arrays when no nodes or edges created', () => {
      const output = store.getOutput()

      expect(output.nodes).toEqual([])
      expect(output.edges).toEqual([])
    })

    it('should return created nodes and edges', () => {
      const node1 = store.createNode({title: 'Node 1'})
      const node2 = store.createNode({title: 'Node 2'})
      const edge = store.createEdge({start: node1.id, end: node2.id})

      const output = store.getOutput()

      expect(output.nodes).toHaveLength(2)
      expect(output.nodes.map(n => n.id)).toContain(node1.id)
      expect(output.nodes.map(n => n.id)).toContain(node2.id)
      expect(output.edges).toHaveLength(1)
      expect(output.edges[0].id).toBe(edge.id)
    })

    it('should filter out non-existent nodes and edges', () => {
      store._output.nodes.push('non-existent-node')
      store._output.edges.push('non-existent-edge')

      const output = store.getOutput()

      expect(output.nodes).toEqual([])
      expect(output.edges).toEqual([])
    })
  })

  describe('getNode, getEdge, getFile', () => {
    it('should return node when it exists', () => {
      const node = store.createNode({title: 'Test Node'})

      const retrievedNode = store.getNode(node.id)

      expect(retrievedNode).toEqual(node)
    })

    it('should return undefined when node does not exist', () => {
      const retrievedNode = store.getNode('non-existent')

      expect(retrievedNode).toBeUndefined()
    })

    it('should return edge when it exists', () => {
      const edge = store.createEdge({start: 'node-1', end: 'node-2'})

      const retrievedEdge = store.getEdge(edge.id)

      expect(retrievedEdge).toEqual(edge)
    })

    it('should return undefined when edge does not exist', () => {
      const retrievedEdge = store.getEdge('non-existent')

      expect(retrievedEdge).toBeUndefined()
    })

    it('should return file when it exists', () => {
      store.createFile('node-1', 'file content')

      const retrievedFile = store.getFile('node-1')

      expect(retrievedFile).toBe('file content')
    })

    it('should return undefined when file does not exist', () => {
      const retrievedFile = store.getFile('non-existent')

      expect(retrievedFile).toBeUndefined()
    })
  })
})
