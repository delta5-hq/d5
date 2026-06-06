import http from 'http'
import {DownloadCommand} from './DownloadCommand'
import Store from './utils/Store'
import WorkflowFile from '../../../models/WorkflowFile'

jest.mock('../../../models/WorkflowFile', () => ({
  write: jest.fn(),
}))

const startServer = handler =>
  new Promise(resolve => {
    const server = http.createServer(handler)
    server.listen(0, '127.0.0.1', () => {
      const {port} = server.address()
      resolve({server, origin: `http://127.0.0.1:${port}`})
    })
  })

const stopServer = server =>
  new Promise((resolve, reject) => {
    server.close(error => (error ? reject(error) : resolve()))
  })

const servedResources = [
  {
    path: '/sample.txt',
    contentType: 'text/plain',
    body: 'plain reachable file content',
    filename: 'sample.txt',
    expectedContent: 'plain reachable file content',
  },
  {
    path: '/sample.html',
    contentType: 'text/html; charset=utf-8',
    body: '<html><body><main>html reachable file content</main></body></html>',
    filename: 'sample.html',
    expectedContent: 'html reachable file content',
  },
]

const resourceByPath = new Map(servedResources.map(resource => [resource.path, resource]))

describe('DownloadCommand — reachable text/html persistence', () => {
  let server
  let origin
  let store
  let parent
  let command

  beforeEach(async () => {
    let fileId = 0
    WorkflowFile.write.mockImplementation(() => Promise.resolve({_id: `file-${++fileId}`}))

    const started = await startServer((req, res) => {
      const resource = resourceByPath.get(req.url)
      if (resource) {
        res.writeHead(200, {'content-type': resource.contentType})
        res.end(resource.body)
        return
      }

      res.writeHead(404, {'content-type': 'text/plain'})
      res.end('not found')
    })

    server = started.server
    origin = started.origin
    parent = {id: 'parent', title: '/download', children: []}
    store = new Store({userId: 'qa-bot', workflowId: 'workflow', nodes: {parent}})
    command = new DownloadCommand('qa-bot', 'workflow', store)
  })

  afterEach(async () => {
    jest.clearAllMocks()
    await stopServer(server)
  })

  it('creates one file node per reachable URL with correct content and parent linkage', async () => {
    const input = servedResources.map(resource => `${origin}${resource.path}`).join('\n')
    const result = await command.insertFileToWorkflow(parent, input, {})
    const outputNodes = store.getOutput().nodes
    const fileNodes = outputNodes.filter(node => node.file)

    expect(result.failures).toEqual([])
    expect(result.createdNodes).toEqual(fileNodes)
    expect(WorkflowFile.write).toHaveBeenCalledTimes(servedResources.length)
    expect(fileNodes).toHaveLength(servedResources.length)
    expect(fileNodes.map(node => node.title).sort()).toEqual(servedResources.map(resource => resource.filename).sort())
    for (const resource of servedResources) {
      const fileNode = fileNodes.find(node => node.title === resource.filename)
      expect(fileNode).toEqual(expect.objectContaining({parent: 'parent'}))
      expect(store.getFile(fileNode.file)).toContain(resource.expectedContent)
    }
    expect(outputNodes.map(node => node.title)).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Download produced no files')]),
    )
  })

  it('any served response body is treated as downloadable content — HTTP status is not filtered', async () => {
    const input = `${origin}/does-not-exist.html`
    const result = await command.insertFileToWorkflow(parent, input, {})
    expect(result.createdNodes).toHaveLength(1)
    expect(WorkflowFile.write).toHaveBeenCalledTimes(1)
    const fileNode = store.getOutput().nodes.find(n => n.file)
    expect(fileNode).toBeDefined()
    expect(fileNode.parent).toBe(parent.id)
  })

  it('writes an error node when a network-unreachable URL produces no content', async () => {
    // Port 1 is reliably connection-refused on loopback — no valid TCP listener.
    const input = 'http://127.0.0.1:1/definitely-unreachable.txt'
    const result = await command.insertFileToWorkflow(parent, input, {})
    const outputNodes = store.getOutput().nodes

    expect(result.createdNodes).toHaveLength(0)
    expect(WorkflowFile.write).not.toHaveBeenCalled()
    expect(outputNodes.some(n => !n.file)).toBe(true)
  })

  it('partial batch — valid URL succeeds and unreachable URL does not block the valid result', async () => {
    const validUrl = `${origin}/sample.txt`
    const unreachableUrl = 'http://127.0.0.1:1/gone.txt'
    const input = [validUrl, unreachableUrl].join('\n')

    const result = await command.insertFileToWorkflow(parent, input, {})
    const outputNodes = store.getOutput().nodes

    expect(result.createdNodes).toHaveLength(1)
    expect(WorkflowFile.write).toHaveBeenCalledTimes(1)
    const fileNode = outputNodes.find(n => n.file)
    expect(fileNode).toBeDefined()
    expect(fileNode.parent).toBe(parent.id)
  })

  it('file node is linked directly to the parent command node — not orphaned at root', async () => {
    const input = `${origin}/sample.txt`
    await command.insertFileToWorkflow(parent, input, {})
    const fileNodes = store.getOutput().nodes.filter(n => n.file)
    expect(fileNodes).toHaveLength(1)
    expect(fileNodes[0].parent).toBe(parent.id)
  })
})
