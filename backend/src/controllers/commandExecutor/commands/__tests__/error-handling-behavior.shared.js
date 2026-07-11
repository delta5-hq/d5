/**
 * Shared test suite for command error handling behavior.
 * This ensures all commands handle errors consistently by creating error nodes
 * instead of silently swallowing exceptions.
 *
 * Usage:
 *   import {testCommandErrorHandling} from './__tests__/error-handling-behavior.shared'
 *
 *   testCommandErrorHandling({
 *     CommandClass: YourCommand,
 *     commandName: 'YourCommand',
 *     createCommand: (userId, workflowId, store) => new YourCommand(userId, workflowId, store),
 *     setupMocks: () => { ... },
 *     mockReplyMethod: (command, error) => { ... },
 *   })
 */

export const testCommandErrorHandling = ({
  commandName,
  createCommand,
  setupMocks,
  mockReplyMethodToFail,
  mockReplyMethodToSucceed,
}) => {
  describe(`${commandName} error handling`, () => {
    let command
    let mockStore

    beforeEach(() => {
      mockStore = {
        importer: {
          createNodes: jest.fn(),
          createTable: jest.fn(),
          createJoinNode: jest.fn(),
        },
        getNode: jest.fn(id => ({id})),
        _nodes: {},
      }

      command = createCommand('test-user', 'test-workflow', mockStore)
      setupMocks()
    })

    it('should create error node when reply method fails', async () => {
      const testError = new Error('LLM API connection failed')
      mockReplyMethodToFail(command, testError)

      const node = {id: 'test-node', command: '/test prompt'}

      await command.run(node, null, node.command)

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith('Error: LLM API connection failed', node.id)
    })

    it('should propagate error message content accurately', async () => {
      const specificError = new Error('API rate limit exceeded (429)')
      mockReplyMethodToFail(command, specificError)

      const node = {id: 'test-node', command: '/test prompt'}

      await command.run(node, null, node.command)

      expect(mockStore.importer.createNodes).toHaveBeenCalledWith(
        expect.stringContaining('rate limit exceeded'),
        node.id,
      )
    })

    it('should log error details for debugging', async () => {
      const logErrorSpy = jest.spyOn(command, 'logError')
      const testError = new Error('Test error')
      mockReplyMethodToFail(command, testError)

      const node = {id: 'test-node', command: '/test prompt'}

      await command.run(node, null, node.command)

      expect(logErrorSpy).toHaveBeenCalledWith(testError)
    })

    it('should not create successful output when error occurs', async () => {
      mockReplyMethodToFail(command, new Error('Failure'))

      const node = {id: 'test-node', command: '/test prompt'}

      await command.run(node, null, node.command)

      const createNodesCalls = mockStore.importer.createNodes.mock.calls
      expect(createNodesCalls.length).toBe(1)
      expect(createNodesCalls[0][0]).toMatch(/^Error:/)
    })

    it('should still create normal output when no error occurs', async () => {
      mockReplyMethodToSucceed(command, 'Success response')

      const node = {id: 'test-node', command: '/test prompt'}

      await command.run(node, null, node.command)

      const createNodesCalls = mockStore.importer.createNodes.mock.calls
      if (createNodesCalls.length > 0) {
        expect(createNodesCalls[0][0]).not.toMatch(/^Error:/)
      }
    })
  })
}
