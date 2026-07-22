import {resolveExternalCommandPrompt} from './resolveExternalCommandPrompt'

const createStore = () => {
  const nodes = {
    commandNode: {
      id: 'commandNode',
      title: '/alias use @@topic and ##_source',
      command: '/alias use @@topic and ##_source',
      children: [],
      depth: 1,
      parent: 'rootNode',
    },
    topicNode: {id: 'topicNode', title: '@topic resolved topic', children: [], depth: 1, parent: 'rootNode'},
    sourceNode: {id: 'sourceNode', title: '#_source resolved source', children: [], depth: 1, parent: 'rootNode'},
    rootNode: {id: 'rootNode', title: 'Workflow', children: ['commandNode', 'topicNode', 'sourceNode'], depth: 0},
  }

  return {
    _nodes: nodes,
    _edges: {},
    getNode: id => nodes[id],
  }
}

const expectResolvedReferences = result => {
  expect(result).toContain('resolved topic')
  expect(result).toContain('resolved source')
  expect(result).not.toMatch(/@@|##_/)
}

describe('resolveExternalCommandPrompt', () => {
  it.each([
    ['undefined text', undefined, ''],
    ['non-string text', 42, ''],
    ['missing store', '/alias @@topic', '/alias @@topic'],
    ['missing node map', '/alias @@topic', '/alias @@topic', {}],
  ])('returns a safe raw value for %s', (_name, text, expected, store = undefined) => {
    expect(resolveExternalCommandPrompt(text, {id: 'commandNode'}, store)).toBe(expected)
  })

  it('leaves ordinary prompt text unchanged', () => {
    const store = createStore()

    expect(resolveExternalCommandPrompt('/alias plain prompt', store.getNode('commandNode'), store)).toBe(
      '/alias plain prompt',
    )
  })

  it.each([
    ['single space', ' '],
    ['multiple spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
    ['mixed whitespace', ' \t\n'],
  ])('preserves typed trailing whitespace in ordinary prompt text: %s', (_name, suffix) => {
    const store = createStore()
    const text = `/alias plain prompt${suffix}`

    expect(resolveExternalCommandPrompt(text, store.getNode('commandNode'), store)).toBe(text)
  })

  it('resolves @ and # references in one external command prompt', () => {
    const store = createStore()

    const result = resolveExternalCommandPrompt('/alias use @@topic and ##_source', store.getNode('commandNode'), store)

    expectResolvedReferences(result)
  })

  it.each([
    ['single space', ' '],
    ['multiple spaces', '   '],
    ['tab', '\t'],
    ['newline', '\n'],
    ['mixed whitespace', ' \t\n'],
  ])('preserves typed trailing whitespace after resolving references: %s', (_name, suffix) => {
    const store = createStore()

    const result = resolveExternalCommandPrompt(
      `/alias use @@topic and ##_source${suffix}`,
      store.getNode('commandNode'),
      store,
    )

    expectResolvedReferences(result)
    expect(result.endsWith(suffix)).toBe(true)
  })
})
