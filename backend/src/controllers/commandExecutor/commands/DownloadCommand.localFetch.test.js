import {DownloadCommand} from './DownloadCommand'
import Store from './utils/Store'
import WorkflowFile from '../../../models/WorkflowFile'
import {scrapeFiles} from '../../utils/scrape'

jest.mock('../../../models/WorkflowFile', () => ({
  write: jest.fn(),
}))

// scrape is mocked at the boundary so this suite stays deterministic regardless of the
// runner's HTTP loopback behavior. Previous iterations used a real http.createServer on
// 127.0.0.1 — that path is structurally fragile on GitHub Actions ubuntu-latest under
// `--coverage` Babel/Istanbul instrumentation and CI fails consistently with 0 calls
// where local passes. The real network-and-fetch path is exhaustively covered by
// `backend/src/controllers/utils/scrape.test.js` (which mocks node-fetch with predetermined
// Response objects); this suite owns persistence-and-linkage of DownloadCommand's scrape
// output, not the fetch plumbing.
jest.mock('../../utils/scrape', () => ({
  scrapeFiles: jest.fn(),
}))

const servedResources = [
  {filename: 'sample.txt', content: 'plain reachable file content'},
  {filename: 'sample.html', content: 'html reachable file content'},
]

describe('DownloadCommand — reachable text/html persistence', () => {
  let store
  let parent
  let command

  beforeEach(() => {
    let fileId = 0
    WorkflowFile.write.mockImplementation(() => Promise.resolve({_id: `file-${++fileId}`}))
    scrapeFiles.mockReset()

    parent = {id: 'parent', title: '/download', children: []}
    store = new Store({userId: 'qa-bot', workflowId: 'workflow', nodes: {parent}})
    command = new DownloadCommand('qa-bot', 'workflow', store)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('creates one file node per reachable URL with correct content and parent linkage', async () => {
    scrapeFiles.mockResolvedValue(servedResources)
    const input = servedResources.map(r => `http://example.test/${r.filename}`).join('\n')

    const result = await command.insertFileToWorkflow(parent, input, {})
    const outputNodes = store.getOutput().nodes
    const fileNodes = outputNodes.filter(node => node.file)

    expect(result.failures).toEqual([])
    expect(result.createdNodes).toEqual(fileNodes)
    expect(WorkflowFile.write).toHaveBeenCalledTimes(servedResources.length)
    expect(fileNodes).toHaveLength(servedResources.length)
    expect(fileNodes.map(node => node.title).sort()).toEqual(servedResources.map(r => r.filename).sort())
    for (const resource of servedResources) {
      const fileNode = fileNodes.find(node => node.title === resource.filename)
      expect(fileNode).toEqual(expect.objectContaining({parent: 'parent'}))
      expect(store.getFile(fileNode.file)).toContain(resource.content)
    }
    expect(outputNodes.map(node => node.title)).not.toEqual(
      expect.arrayContaining([expect.stringContaining('Download produced no files')]),
    )
  })

  it('any served response body is treated as downloadable content — HTTP status is not filtered', async () => {
    scrapeFiles.mockResolvedValue([{filename: 'does-not-exist.html', content: 'not found'}])
    const input = 'http://example.test/does-not-exist.html'

    const result = await command.insertFileToWorkflow(parent, input, {})

    expect(result.createdNodes).toHaveLength(1)
    expect(WorkflowFile.write).toHaveBeenCalledTimes(1)
    const fileNode = store.getOutput().nodes.find(n => n.file)
    expect(fileNode).toBeDefined()
    expect(fileNode.parent).toBe(parent.id)
  })

  it('writes an error node when a network-unreachable URL produces no content', async () => {
    scrapeFiles.mockResolvedValue([])
    const input = 'http://example.test/definitely-unreachable.txt'

    const result = await command.insertFileToWorkflow(parent, input, {})
    const outputNodes = store.getOutput().nodes

    expect(result.createdNodes).toHaveLength(0)
    expect(WorkflowFile.write).not.toHaveBeenCalled()
    expect(outputNodes.some(n => !n.file)).toBe(true)
  })

  it('partial batch — valid URL succeeds and unreachable URL does not block the valid result', async () => {
    scrapeFiles.mockResolvedValue([{filename: 'sample.txt', content: 'plain reachable file content'}])
    const validUrl = 'http://example.test/sample.txt'
    const unreachableUrl = 'http://example.test/gone.txt'
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
    scrapeFiles.mockResolvedValue([{filename: 'sample.txt', content: 'plain reachable file content'}])
    const input = 'http://example.test/sample.txt'

    await command.insertFileToWorkflow(parent, input, {})

    const fileNodes = store.getOutput().nodes.filter(n => n.file)
    expect(fileNodes).toHaveLength(1)
    expect(fileNodes[0].parent).toBe(parent.id)
  })
})
