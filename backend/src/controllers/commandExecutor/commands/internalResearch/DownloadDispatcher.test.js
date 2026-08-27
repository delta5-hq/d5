import {dispatchDownload} from './DownloadDispatcher'
import Store from '../utils/Store'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

jest.mock('../../../utils/scrape', () => ({
  scrapeFiles: jest.fn(),
}))

jest.mock('../../../../models/WorkflowFile', () => ({
  __esModule: true,
  default: {write: jest.fn()},
}))

jest.mock('../references/substitution', () => ({
  substituteReferencesAndHashrefsChildrenAndSelf: jest.fn(node => node?.title ?? ''),
}))

const {scrapeFiles} = require('../../../utils/scrape')
const WorkflowFile = require('../../../../models/WorkflowFile').default
const {substituteReferencesAndHashrefsChildrenAndSelf} = require('../references/substitution')

const buildStore = (nodes, files = {}) => {
  const store = new Store({userId: 'user-1', workflowId: 'wf-1', nodes})
  Object.entries(files).forEach(([id, content]) => store.createFile(id, content))
  return store
}

const makeCell = (command, extra = {}) => ({
  id: 'dlNode',
  command,
  title: command,
  parent: 'rootNode',
  ...extra,
})

const makeRootedStore = (command, files = {}) => {
  const cell = makeCell(command)
  const rootNode = {id: 'rootNode', title: 'Workflow', children: [cell.id]}
  return {cell, store: buildStore({dlNode: cell, rootNode}, files)}
}

const onlyChild = store => {
  const output = store.getOutput()
  return output.nodes.find(n => n.parent === 'dlNode') ?? null
}

beforeEach(() => {
  jest.clearAllMocks()
  WorkflowFile.write.mockResolvedValue({_id: 'default-file-id'})
  substituteReferencesAndHashrefsChildrenAndSelf.mockImplementation(node => node?.title ?? '')
})

describe('DownloadDispatcher — never throws', () => {
  it('resolves without throwing when scrapeFiles rejects', async () => {
    scrapeFiles.mockRejectedValueOnce(new Error('Network error'))
    const {cell, store} = makeRootedStore('/download https://example.com')
    await expect(dispatchDownload(cell, store, undefined)).resolves.not.toThrow()
  })

  it('resolves without throwing when WorkflowFile.write rejects', async () => {
    scrapeFiles.mockResolvedValueOnce([{filename: 'a.txt', content: 'data'}])
    WorkflowFile.write.mockRejectedValueOnce(new Error('Disk full'))
    const {cell, store} = makeRootedStore('/download https://example.com')
    await expect(dispatchDownload(cell, store, undefined)).resolves.not.toThrow()
  })

  it('creates an error node rather than propagating any rejection', async () => {
    scrapeFiles.mockRejectedValueOnce(new Error('Timeout'))
    const {cell, store} = makeRootedStore('/download https://example.com')
    const spy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await dispatchDownload(cell, store, undefined)

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Error:'), cell.id)
  })
})

describe('DownloadDispatcher — URL extraction', () => {
  it('creates an error node when the resolved prompt contains no URL', async () => {
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('download some content please')
    const {cell, store} = makeRootedStore('/download no url here')
    const spy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await dispatchDownload(cell, store, undefined)

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No valid URL'), cell.id)
    expect(scrapeFiles).not.toHaveBeenCalled()
  })

  it('creates an error node for a bare word that is not a URL', async () => {
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('example.com')
    const {cell, store} = makeRootedStore('/download example.com')

    await dispatchDownload(cell, store, undefined)

    expect(scrapeFiles).not.toHaveBeenCalled()
  })

  it('passes de-duplicated URLs to scrapeFiles when the same URL appears twice in the prompt', async () => {
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('https://example.com https://example.com/')
    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content: 'x'}])
    const {cell, store} = makeRootedStore('/download https://example.com')

    await dispatchDownload(cell, store, undefined)

    const [urls] = scrapeFiles.mock.calls[0]
    expect(urls).toHaveLength(1)
    expect(urls[0]).toBe('https://example.com')
  })

  it('passes multiple distinct URLs to scrapeFiles', async () => {
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce(
      'https://a.example.com and https://b.example.com',
    )
    scrapeFiles.mockResolvedValueOnce([
      {filename: 'a.txt', content: 'aaa'},
      {filename: 'b.txt', content: 'bbb'},
    ])
    const {cell, store} = makeRootedStore('/download https://a.example.com https://b.example.com')

    await dispatchDownload(cell, store, undefined)

    const [urls] = scrapeFiles.mock.calls[0]
    expect(urls).toHaveLength(2)
  })

  it('strips trailing punctuation from URLs before calling scrapeFiles', async () => {
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('see https://example.com/path.')
    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content: 'x'}])
    const {cell, store} = makeRootedStore('/download https://example.com/path.')

    await dispatchDownload(cell, store, undefined)

    const [urls] = scrapeFiles.mock.calls[0]
    expect(urls[0]).not.toMatch(/\.$/)
    expect(urls[0]).toBe('https://example.com/path')
  })

  it('normalises URL by removing a trailing slash', async () => {
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('https://example.com/')
    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content: 'x'}])
    const {cell, store} = makeRootedStore('/download https://example.com/')

    await dispatchDownload(cell, store, undefined)

    const [urls] = scrapeFiles.mock.calls[0]
    expect(urls[0]).toBe('https://example.com')
  })
})

describe('DownloadDispatcher — scrape params', () => {
  it('passes default max_size and max_pages when no params given in command', async () => {
    scrapeFiles.mockResolvedValueOnce([{filename: 'p.txt', content: 'x'}])
    const {cell, store} = makeRootedStore('/download https://example.com')

    await dispatchDownload(cell, store, undefined)

    const [, params] = scrapeFiles.mock.calls[0]
    expect(params.max_size).toBe('5mb')
    expect(params.max_pages).toBe('100')
  })

  it('forwards explicit --max_size param to scrapeFiles', async () => {
    scrapeFiles.mockResolvedValueOnce([{filename: 'p.txt', content: 'x'}])
    const {cell, store} = makeRootedStore('/download --max_size=1mb https://example.com')

    await dispatchDownload(cell, store, undefined)

    const [, params] = scrapeFiles.mock.calls[0]
    expect(params.max_size).toBe('1mb')
  })

  it('forwards explicit --max_pages param to scrapeFiles', async () => {
    scrapeFiles.mockResolvedValueOnce([{filename: 'p.txt', content: 'x'}])
    const {cell, store} = makeRootedStore('/download --max_pages=5 https://example.com')

    await dispatchDownload(cell, store, undefined)

    const [, params] = scrapeFiles.mock.calls[0]
    expect(params.max_pages).toBe('5')
  })
})

describe('DownloadDispatcher — scrape result validation', () => {
  it('creates an error node when scrapeFiles returns an empty array', async () => {
    scrapeFiles.mockResolvedValueOnce([])
    const {cell, store} = makeRootedStore('/download https://example.com')
    const spy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await dispatchDownload(cell, store, undefined)

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No downloadable content'), cell.id)
    expect(WorkflowFile.write).not.toHaveBeenCalled()
  })

  it('creates an error node when scrapeFiles returns null', async () => {
    scrapeFiles.mockResolvedValueOnce(null)
    const {cell, store} = makeRootedStore('/download https://example.com')
    const spy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await dispatchDownload(cell, store, undefined)

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No downloadable content'), cell.id)
  })

  it('creates an error node when scrapeFiles returns a non-array value', async () => {
    scrapeFiles.mockResolvedValueOnce('raw string')
    const {cell, store} = makeRootedStore('/download https://example.com')
    const spy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await dispatchDownload(cell, store, undefined)

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('No downloadable content'), cell.id)
  })
})

describe('DownloadDispatcher — new file persistence', () => {
  it('calls WorkflowFile.write once for a single new file', async () => {
    scrapeFiles.mockResolvedValueOnce([{filename: 'doc.txt', content: 'hello'}])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'file-abc'})
    const {cell, store} = makeRootedStore('/download https://example.com')

    await dispatchDownload(cell, store, undefined)

    expect(WorkflowFile.write).toHaveBeenCalledTimes(1)
    const [meta] = WorkflowFile.write.mock.calls[0]
    expect(meta.filename).toBe('doc.txt')
    expect(meta.metadata.userId).toBe('user-1')
    expect(meta.metadata.workflowId).toBe('wf-1')
    expect(meta.metadata.contentType).toBe('text/plain')
  })

  it('creates a file-referencing child node with the correct fileId and title', async () => {
    scrapeFiles.mockResolvedValueOnce([{filename: 'report.txt', content: 'data'}])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'file-xyz'})
    const {cell, store} = makeRootedStore('/download https://example.com')

    await dispatchDownload(cell, store, undefined)

    const child = onlyChild(store)
    expect(child).not.toBeNull()
    expect(child.file).toBe('file-xyz')
    expect(child.title).toBe('report.txt')
    expect(child.parent).toBe(cell.id)
  })

  it('calls WorkflowFile.write once per unique new file when scrapeFiles returns multiple results', async () => {
    scrapeFiles.mockResolvedValueOnce([
      {filename: 'a.txt', content: 'alpha'},
      {filename: 'b.txt', content: 'beta'},
    ])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'id-a'}).mockResolvedValueOnce({_id: 'id-b'})
    const {cell, store} = makeRootedStore('/download https://a.com https://b.com')

    await dispatchDownload(cell, store, undefined)

    expect(WorkflowFile.write).toHaveBeenCalledTimes(2)
    const output = store.getOutput()
    const children = output.nodes.filter(n => n.parent === cell.id)
    expect(children).toHaveLength(2)
    expect(children.map(c => c.file).sort()).toEqual(['id-a', 'id-b'].sort())
  })

  it('stores file content in the store files index so dedup works on subsequent downloads', async () => {
    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content: 'unique-content'}])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'fid-1'})
    const {cell, store} = makeRootedStore('/download https://example.com')

    await dispatchDownload(cell, store, undefined)

    expect(store._files['fid-1']).toBe('unique-content')
  })

  it('handles Buffer content by writing it as-is to WorkflowFile', async () => {
    const buf = Buffer.from('binary data', 'utf-8')
    scrapeFiles.mockResolvedValueOnce([{filename: 'file.pdf', content: buf}])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'buf-id'})
    const {cell, store} = makeRootedStore('/download https://example.com/file.pdf')

    await dispatchDownload(cell, store, undefined)

    expect(WorkflowFile.write).toHaveBeenCalledTimes(1)
    expect(onlyChild(store)?.file).toBe('buf-id')
  })

  it('creates an error node when WorkflowFile.write rejects for one of multiple files', async () => {
    scrapeFiles.mockResolvedValueOnce([
      {filename: 'ok.txt', content: 'data'},
      {filename: 'bad.txt', content: 'other'},
    ])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'id-ok'}).mockRejectedValueOnce(new Error('Write failed'))
    const {cell, store} = makeRootedStore('/download https://a.com https://b.com')
    const spy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})

    await dispatchDownload(cell, store, undefined)

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Write failed'), cell.id)
  })
})

describe('DownloadDispatcher — content deduplication', () => {
  it('attaches an existing file node and emits a duplicate-confirmation message when content was already downloaded', async () => {
    const existingContent = 'already downloaded page'
    const {cell, store} = makeRootedStore('/download https://example.com', {'existing-file': existingContent})

    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content: existingContent}])

    const spy = jest.spyOn(store.importer, 'createNodes')
    await dispatchDownload(cell, store, undefined)

    expect(WorkflowFile.write).not.toHaveBeenCalled()
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('already attached'), cell.id)
  })

  it('does not re-upload a file that already exists in the store as a child of the node', async () => {
    const content = 'shared content'

    const existingChild = {id: 'existing-child', file: 'existing-file-id', parent: 'dlNode', title: 'page.txt'}
    const cell = makeCell('/download https://example.com')
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [cell.id]}
    const store = buildStore({dlNode: cell, rootNode, 'existing-child': existingChild}, {'existing-file-id': content})

    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content}])

    await dispatchDownload(cell, store, undefined)

    expect(WorkflowFile.write).not.toHaveBeenCalled()
  })

  it('throws an error (caught by runWithErrorNode) when all results are content-duplicates already attached', async () => {
    const content = 'same content'

    const existingChild = {id: 'ch', file: 'fid', parent: 'dlNode', title: 'page.txt'}
    const cell = makeCell('/download https://example.com')
    const rootNode = {id: 'rootNode', title: 'Workflow', children: [cell.id]}
    const store = buildStore({dlNode: cell, rootNode, ch: existingChild}, {fid: content})

    scrapeFiles.mockResolvedValueOnce([{filename: 'page.txt', content}])

    const spy = jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
    await dispatchDownload(cell, store, undefined)

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Error:'), cell.id)
    expect(WorkflowFile.write).not.toHaveBeenCalled()
  })

  it('persists genuinely new files even when some results are content-duplicates in the store', async () => {
    const dupContent = 'duplicate content'
    const newContent = 'brand new content'
    const {cell, store} = makeRootedStore('/download https://a.com https://b.com', {'dup-file-id': dupContent})

    scrapeFiles.mockResolvedValueOnce([
      {filename: 'dup.txt', content: dupContent},
      {filename: 'new.txt', content: newContent},
    ])
    WorkflowFile.write.mockResolvedValueOnce({_id: 'new-file-id'})

    await dispatchDownload(cell, store, undefined)

    expect(WorkflowFile.write).toHaveBeenCalledTimes(1)
    const [[meta]] = WorkflowFile.write.mock.calls
    expect(meta.filename).toBe('new.txt')
  })

  it('duplicate-confirmation message lists filenames of already-attached files', async () => {
    const content = 'cached page'
    const {cell, store} = makeRootedStore('/download https://example.com', {'cached-id': content})

    scrapeFiles.mockResolvedValueOnce([{filename: 'page.html', content}])

    const spy = jest.spyOn(store.importer, 'createNodes')
    await dispatchDownload(cell, store, undefined)

    const [msg] = spy.mock.calls[0]
    expect(msg).toContain('page.html')
  })
})

describe('DownloadDispatcher — prompt resolution', () => {
  it('resolves the cell prompt via substituteReferencesAndHashrefsChildrenAndSelf', async () => {
    substituteReferencesAndHashrefsChildrenAndSelf.mockReturnValueOnce('https://resolved.example.com')
    scrapeFiles.mockResolvedValueOnce([{filename: 'r.txt', content: 'x'}])
    const {cell, store} = makeRootedStore('/download @ref')

    await dispatchDownload(cell, store, undefined)

    expect(substituteReferencesAndHashrefsChildrenAndSelf).toHaveBeenCalledWith(
      expect.objectContaining({id: cell.id}),
      store,
    )
    const [urls] = scrapeFiles.mock.calls[0]
    expect(urls[0]).toBe('https://resolved.example.com')
  })
})
