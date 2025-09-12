import {ForeachCommand} from './ForeachCommand.js'
import {runCommand} from './utils/runCommand'
import Store from './utils/Store.js'

jest.mock('./utils/runCommand', () => ({
  runCommand: jest.fn(),
  updateMapNodes: jest.fn().mockImplementation(mapNodes => node => {
    mapNodes[node.id] = node
  }),
}))

jest.mock('./StepsCommand')

describe('ForeachCommand reference substitution', () => {
  let foreachCommand
  const userId = 'testUser'
  const mapId = 'testMap'
  const mockStore = new Store({
    userId,
    mapId,
    nodes: {},
  })

  beforeEach(() => {
    // Initialize with backend constructor parameters - userId, mapId
    foreachCommand = new ForeachCommand(userId, mapId, mockStore)
    foreachCommand.logError = jest.fn()
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('references in foreach commands with parent context', () => {
    it('should substitute references correctly in nested foreach commands', async () => {
      // Input structure:
      //
      // Reference Definitions
      //   @dog_name_reqs use only russian dog names
      //   @dog_breeds_reqs translate breed names into chineese
      //   @dog_toys_reqs use only russian dog toys
      // /chatgpt give me list of 2 dog breeds, no explanations
      //   /foreach /chatgpt for @@@ give me list of 2 dog names, no explanations (@@dog_name_reqs)
      //   /foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations (@@dog_toys_reqs)
      //   1. Labrador Retriever
      //     1. Boris
      //     2. Mishka
      //   2. German Shepherd
      //     1. Laika
      //     2. Umka

      // Create reference nodes
      const dogNameReqNode = {
        id: 'dogNameReqs',
        title: '@dog_name_reqs use only russian dog names',
        command: '@dog_name_reqs use only russian dog names',
        children: [],
        parent: 'refsContainer',
      }
      const dogBreedsReqNode = {
        id: 'dogBreedsReqs',
        title: '@dog_breeds_reqs translate breed names into chineese',
        command: '@dog_breeds_reqs translate breed names into chineese',
        children: [],
        parent: 'refsContainer',
      }
      const dogToysReqNode = {
        id: 'dogToysReqs',
        title: '@dog_toys_reqs use only russian dog toys',
        command: '@dog_toys_reqs use only russian dog toys',
        children: [],
        parent: 'refsContainer',
      }

      const refsContainer = {
        id: 'refsContainer',
        title: 'Reference Definitions',
        children: [dogNameReqNode.id, dogBreedsReqNode.id, dogToysReqNode.id],
        parent: 'root',
      }

      // Create the dog breed nodes and their dog name children
      const borisNode = {id: 'boris', title: '1. Boris', parent: 'labrador', children: []}
      const mishkaNode = {id: 'mishka', title: '2. Mishka', parent: 'labrador', children: []}
      const laikaNode = {id: 'laika', title: '1. Laika', parent: 'shepherd', children: []}
      const umkaNode = {id: 'umka', title: '2. Umka', parent: 'shepherd', children: []}

      const labradorNode = {
        id: 'labrador',
        title: '1. Labrador Retriever',
        parent: 'parent',
        children: [borisNode.id, mishkaNode.id],
      }

      const shepherdNode = {
        id: 'shepherd',
        title: '2. German Shepherd',
        parent: 'parent',
        children: [laikaNode.id, umkaNode.id],
      }

      // Create the foreach command nodes
      const foreachToysNode = {
        id: 'foreachToys',
        title: '/foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations (@@dog_toys_reqs)',
        command: '/foreach /chatgpt for @@@ give me list of 2 dog toys, no explanations (@@dog_toys_reqs)',
        parent: 'parent',
        children: [],
      }

      // Create the parent node containing all the above
      const parentNode = {
        id: 'parent',
        title: '/chatgpt give me list of 2 dog breeds, no explanations',
        command: '/chatgpt give me list of 2 dog breeds, no explanations',
        parent: 'root',
        children: [foreachToysNode.id, labradorNode.id, shepherdNode.id],
      }

      const rootNode = {
        id: 'root',
        children: [parentNode.id, refsContainer.id],
      }

      // Create mapNodes object for the backend implementation
      mockStore._nodes = {
        [dogNameReqNode.id]: dogNameReqNode,
        [dogBreedsReqNode.id]: dogBreedsReqNode,
        [dogToysReqNode.id]: dogToysReqNode,
        [refsContainer.id]: refsContainer,
        [borisNode.id]: borisNode,
        [mishkaNode.id]: mishkaNode,
        [laikaNode.id]: laikaNode,
        [umkaNode.id]: umkaNode,
        [labradorNode.id]: labradorNode,
        [shepherdNode.id]: shepherdNode,
        [foreachToysNode.id]: foreachToysNode,
        [parentNode.id]: parentNode,
        [rootNode.id]: rootNode,
      }

      // Setup mock responses for the runCommand calls
      const borisResponse = {
        id: 'responseBorisToys',
        command:
          '/chatgpt for 1. Labrador Retriever, 1. Boris give me list of 2 dog toys, no explanations (use only russian dog toys)',
      }

      const mishkaResponse = {
        id: 'responseMishkaToys',
        command:
          '/chatgpt for 1. Labrador Retriever, 2. Mishka give me list of 2 dog toys, no explanations (use only russian dog toys)',
      }

      const laikaResponse = {
        id: 'responseLaikaToys',
        command:
          '/chatgpt for 2. German Shepherd, 1. Laika give me list of 2 dog toys, no explanations (use only russian dog toys)',
      }

      const umkaResponse = {
        id: 'responseUmkaToys',
        command:
          '/chatgpt for 2. German Shepherd, 2. Umka give me list of 2 dog toys, no explanations (use only russian dog toys)',
      }

      runCommand
        .mockImplementationOnce(() => {
          mockStore.createNode(borisResponse, true)
        })
        .mockImplementationOnce(() => {
          mockStore.createNode(mishkaResponse, true)
        })
        .mockImplementationOnce(() => {
          mockStore.createNode(laikaResponse, true)
        })
        .mockImplementationOnce(() => {
          mockStore.createNode(umkaResponse, true)
        })

      // Execute the foreachToysNode command
      await foreachCommand.run(foreachToysNode)
      const result = mockStore.getOutput()

      // Verify that runCommand was called with the right parameters - without mocking findLeafs or getParentsTitles
      expect(runCommand).toHaveBeenCalledTimes(4)

      // Assert exact commands for each call to runCommand
      const callArgs1 = runCommand.mock.calls[0][0]
      expect(callArgs1).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'boris',
            command:
              '/chatgpt for 1. Labrador Retriever, 1. Boris give me list of 2 dog toys, no explanations (@@dog_toys_reqs)',
          }),
        }),
      )

      const callArgs2 = runCommand.mock.calls[1][0]
      expect(callArgs2).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'mishka',
            command:
              '/chatgpt for 1. Labrador Retriever, 2. Mishka give me list of 2 dog toys, no explanations (@@dog_toys_reqs)',
          }),
        }),
      )

      const callArgs3 = runCommand.mock.calls[2][0]
      expect(callArgs3).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'laika',
            command:
              '/chatgpt for 2. German Shepherd, 1. Laika give me list of 2 dog toys, no explanations (@@dog_toys_reqs)',
          }),
        }),
      )

      const callArgs4 = runCommand.mock.calls[3][0]
      expect(callArgs4).toEqual(
        expect.objectContaining({
          cell: expect.objectContaining({
            id: 'umka',
            command:
              '/chatgpt for 2. German Shepherd, 2. Umka give me list of 2 dog toys, no explanations (@@dog_toys_reqs)',
          }),
        }),
      )

      // Verify the result contains the expected nodes
      expect(result).toEqual({
        edges: [],
        nodes: expect.arrayContaining([
          {
            id: 'responseBorisToys',
            command:
              '/chatgpt for 1. Labrador Retriever, 1. Boris give me list of 2 dog toys, no explanations (use only russian dog toys)',
          },
          {
            id: 'responseMishkaToys',
            command:
              '/chatgpt for 1. Labrador Retriever, 2. Mishka give me list of 2 dog toys, no explanations (use only russian dog toys)',
          },
          {
            id: 'responseLaikaToys',
            command:
              '/chatgpt for 2. German Shepherd, 1. Laika give me list of 2 dog toys, no explanations (use only russian dog toys)',
          },
          {
            id: 'responseUmkaToys',
            command:
              '/chatgpt for 2. German Shepherd, 2. Umka give me list of 2 dog toys, no explanations (use only russian dog toys)',
          },
        ]),
      })
    })
  })
})
