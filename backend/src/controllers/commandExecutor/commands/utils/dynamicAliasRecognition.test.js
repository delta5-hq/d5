import {isAnyCommand} from './commandRecognition'
import {composeAllDynamicAliases} from './aliasComposition'
import {createContextForChat} from './createContextForChat'
import {NodeTextExtractor} from './NodeTextExtractor'
import {indentedText} from '../references/substitution'
import Store from './Store'

const mkAlias = alias => ({alias})
const mkStore = ({mcp = [], rpc = []} = {}) => new Store({userId: 'test-user', aliases: {mcp, rpc}})

describe('Dynamic Alias Support', () => {
  describe('composeAllDynamicAliases', () => {
    it.each([
      ['empty registry', undefined, []],
      ['null registry', null, []],
      ['no aliases', {mcp: [], rpc: []}, []],
      ['only mcp', {mcp: [mkAlias('/c1'), mkAlias('/c2')], rpc: []}, [mkAlias('/c1'), mkAlias('/c2')]],
      ['only rpc', {mcp: [], rpc: [mkAlias('/r1')]}, [mkAlias('/r1')]],
      ['both mcp and rpc', {mcp: [mkAlias('/c1')], rpc: [mkAlias('/r1')]}, [mkAlias('/c1'), mkAlias('/r1')]],
    ])('%s', (_label, registry, expected) => {
      expect(composeAllDynamicAliases(registry)).toEqual(expected)
    })

    it('handles missing fields gracefully', () => {
      expect(composeAllDynamicAliases({rpc: [mkAlias('/r1')]})).toEqual([mkAlias('/r1')])
      expect(composeAllDynamicAliases({mcp: [mkAlias('/c1')]})).toEqual([mkAlias('/c1')])
    })
  })

  describe('isAnyCommand with dynamic aliases', () => {
    const aliases = [mkAlias('/coder1'), mkAlias('/vm3-shell')]

    it.each([
      ['built-in command', '/chatgpt hello', true],
      ['built-in with whitespace', '  /claude test', true],
      ['mcp alias', '/coder1 implement', true],
      ['rpc alias', '/vm3-shell ls', true],
      ['exact alias match', '/coder1', true],
      ['order-prefixed mcp', '#1 /coder1 fix', true],
      ['order-prefixed rpc', '#-2 /vm3-shell run', true],
    ])('recognizes command — %s', (_label, text, expected) => {
      expect(isAnyCommand(text, aliases)).toBe(expected)
    })

    it.each([
      ['unknown alias', '/unknown cmd', false],
      ['partial match', '/code', false],
      ['plain text', 'no command here', false],
      ['empty string', '', false],
      ['null', null, false],
    ])('rejects non-command — %s', (_label, text, expected) => {
      expect(isAnyCommand(text, aliases)).toBe(expected)
    })

    it('defaults to empty aliases when not provided', () => {
      expect(isAnyCommand('/chatgpt test')).toBe(true)
      expect(isAnyCommand('/coder1 test')).toBe(false)
    })
  })

  describe('indentedText — command exclusion', () => {
    const mkNode = (id, title, {depth = 0, parent = null, children = []} = {}) => ({
      id,
      title,
      depth,
      parent,
      children,
    })

    it.each([
      ['built-in', mkStore(), ['/chatgpt', '/web'], 'Plain text'],
      ['mcp alias', mkStore({mcp: [mkAlias('/coder1')]}), ['/coder1 impl'], 'Project'],
      ['rpc alias', mkStore({rpc: [mkAlias('/vm3')]}), ['/vm3 deploy'], 'Deploy plan'],
      ['mixed', mkStore({mcp: [mkAlias('/c1')], rpc: [mkAlias('/r1')]}), ['/c1 x', '/r1 y'], 'Root'],
    ])('excludes %s commands from text', (_label, store, commandTitles, plainTitle) => {
      const root = mkNode('root', plainTitle, {children: commandTitles.map((_, i) => `cmd${i}`)})
      const cmdNodes = commandTitles.map((title, i) => mkNode(`cmd${i}`, title, {depth: 1, parent: 'root'}))

      store._nodes = {root, ...Object.fromEntries(cmdNodes.map(n => [n.id, n]))}

      const result = indentedText(root, store, {})

      expect(result[0].text).toBe(plainTitle)
      expect(result.length).toBe(1)
      commandTitles.forEach(cmd => expect(result.map(r => r.text).join()).not.toContain(cmd))
    })

    it('includes plain text children', () => {
      const store = mkStore({mcp: [mkAlias('/coder1')]})
      const root = mkNode('root', 'Parent', {children: ['txt1', 'cmd1', 'txt2']})
      const txt1 = mkNode('txt1', 'Text child 1', {depth: 1, parent: 'root'})
      const cmd1 = mkNode('cmd1', '/coder1 skip this', {depth: 1, parent: 'root'})
      const txt2 = mkNode('txt2', 'Text child 2', {depth: 1, parent: 'root'})

      store._nodes = {root, txt1, cmd1, txt2}

      const result = indentedText(root, store, {})

      expect(result.map(r => r.text)).toContain('Parent')
      expect(result.map(r => r.text)).toContain('  Text child 1')
      expect(result.map(r => r.text)).toContain('  Text child 2')
      expect(result.map(r => r.text).join()).not.toContain('/coder1')
    })
  })

  describe('createContextForChat — command exclusion', () => {
    const mkNode = (id, title, parent = null) => ({id, title, parent})

    it.each([
      ['built-in', mkStore(), '/chatgpt analyze'],
      ['mcp alias', mkStore({mcp: [mkAlias('/coder1')]}), '/coder1 impl'],
      ['rpc alias', mkStore({rpc: [mkAlias('/ssh1')]}), '/ssh1 run'],
    ])('excludes %s from parent chain', (_label, store, commandTitle) => {
      const gp = mkNode('gp', 'Grandparent', 'root')
      const parent = mkNode('p', commandTitle, 'gp')
      const node = mkNode('n', 'Current node', 'p')

      store._nodes = {gp, p: parent, n: node}

      const context = createContextForChat(node, {store, parents: 3})

      expect(context).toContain('Grandparent')
      expect(context).toContain('Current node')
      expect(context).not.toContain(commandTitle.split(' ')[0])
    })

    it('includes plain text parents', () => {
      const store = mkStore({mcp: [mkAlias('/coder1')]})
      const gp = mkNode('gp', 'Context level 1', 'root')
      const parent = mkNode('p', 'Context level 2', 'gp')
      const node = mkNode('n', 'Current', 'p')

      store._nodes = {gp, p: parent, n: node}

      const context = createContextForChat(node, {store, parents: 3})

      expect(context).toContain('Context level 1')
      expect(context).toContain('Context level 2')
      expect(context).toContain('Current')
    })

    it('supports legacy allNodes parameter without dynamic alias support', () => {
      const gp = mkNode('gp', 'GP', 'root')
      const p = mkNode('p', 'P', 'gp')
      const n = mkNode('n', 'N', 'p')

      const context = createContextForChat(n, {allNodes: {gp, p, n}, parents: 3})

      expect(context).toContain('GP')
      expect(context).toContain('P')
      expect(context).toContain('N')
    })

    it('prefers store over allNodes when both provided', () => {
      const store = mkStore({mcp: [mkAlias('/coder1')]})
      const p = mkNode('p', '/coder1 skip', 'root')
      const n = mkNode('n', 'Text', 'p')
      store._nodes = {p, n}

      const context = createContextForChat(n, {store, allNodes: {}, parents: 2})

      expect(context).not.toContain('/coder1')
      expect(context).toContain('Text')
    })
  })

  describe('NodeTextExtractor — command exclusion', () => {
    const mkNode = (id, title, children = []) => ({id, title, children})

    it.each([
      ['built-in', mkStore(), '/chatgpt analyze'],
      ['mcp alias', mkStore({mcp: [mkAlias('/coder1')]}), '/coder1 impl'],
      ['rpc alias', mkStore({rpc: [mkAlias('/vm3')]}), '/vm3 deploy'],
    ])('skips %s during text extraction', async (_label, store, commandTitle) => {
      const root = mkNode('root', 'Extract this', ['cmd'])
      const cmd = mkNode('cmd', commandTitle, [])

      store._nodes = {root, cmd}

      const extractor = new NodeTextExtractor(10000, () => false, store)
      const extracted = await extractor.extractFullContent(root)

      expect(extracted).toContain('Extract this')
      expect(extracted).not.toContain(commandTitle.split(' ')[0])
    })

    it('extracts plain text nodes', async () => {
      const store = mkStore({mcp: [mkAlias('/coder1')]})
      const root = mkNode('root', 'Root text', ['txt1', 'cmd1', 'txt2'])
      const txt1 = mkNode('txt1', 'Child text 1', [])
      const cmd1 = mkNode('cmd1', '/coder1 skip', [])
      const txt2 = mkNode('txt2', 'Child text 2', [])

      store._nodes = {root, txt1, cmd1, txt2}

      const extractor = new NodeTextExtractor(10000, () => false, store)
      const extracted = await extractor.extractFullContent(root)

      expect(extracted).toContain('Root text')
      expect(extracted).toContain('Child text 1')
      expect(extracted).toContain('Child text 2')
      expect(extracted).not.toContain('/coder1')
    })
  })

  describe('Edge cases and boundary conditions', () => {
    it('handles Store with no aliases configured', () => {
      const store = new Store({userId: 'test-user'})
      const composed = composeAllDynamicAliases(store._aliases)

      expect(composed).toEqual([])
      expect(isAnyCommand('/chatgpt test', composed)).toBe(true)
      expect(isAnyCommand('/unknown test', composed)).toBe(false)
    })

    it('handles empty string and null node titles', () => {
      const store = mkStore({mcp: [mkAlias('/coder1')]})
      const aliases = composeAllDynamicAliases(store._aliases)

      expect(isAnyCommand('', aliases)).toBe(false)
      expect(isAnyCommand(null, aliases)).toBe(false)
      expect(isAnyCommand(undefined, aliases)).toBe(false)
    })

    it('handles order-prefixed dynamic aliases in all contexts', () => {
      const store = mkStore({mcp: [mkAlias('/coder1')]})
      const aliases = composeAllDynamicAliases(store._aliases)

      expect(isAnyCommand('#1 /coder1 test', aliases)).toBe(true)
      expect(isAnyCommand('#-5 /coder1 test', aliases)).toBe(true)
      expect(isAnyCommand('#999 /coder1 test', aliases)).toBe(true)
    })

    it('preserves built-in command recognition when aliases present', () => {
      const store = mkStore({mcp: [mkAlias('/coder1')], rpc: [mkAlias('/vm3')]})
      const aliases = composeAllDynamicAliases(store._aliases)

      const builtIns = ['/chatgpt', '/claude', '/web', '/steps', '/foreach', '/switch']
      builtIns.forEach(cmd => {
        expect(isAnyCommand(cmd, aliases)).toBe(true)
      })
    })
  })
})
