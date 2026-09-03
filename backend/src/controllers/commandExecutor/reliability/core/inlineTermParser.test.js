import {parseInlineTerm, syntheticTermParentId, buildSyntheticTermParent} from './inlineTermParser'
import {NON_GENERATING_TERM_QUERY_TYPES} from './nonGeneratingTermTypes'
import {queryCommands} from '../../constants/commandRegExp'
import {resolveCommand} from '../../commands/utils/queryTypeResolver'

describe('parseInlineTerm', () => {
  describe('absent or empty trailing text → null', () => {
    it.each([undefined, null, ''])('returns null for %p', text => {
      expect(parseInlineTerm(text)).toBeNull()
    })
  })

  describe('recognized built-in command → return trailingText', () => {
    it.each([
      ['/chat propose directions'],
      ['/chatgpt propose directions'],
      ['/claude analyze'],
      ['/web search query'],
    ])('accepts %s', text => {
      expect(parseInlineTerm(text)).toBe(text)
    })
  })

  describe('recognized MCP alias → return trailingText', () => {
    it('accepts a registered MCP alias as the inline command token', () => {
      expect(parseInlineTerm('/tool run', {mcp: [{alias: '/tool'}], rpc: []})).toBe('/tool run')
    })
    it('returns null for the same token when no aliases are registered', () => {
      expect(parseInlineTerm('/tool run')).toBeNull()
    })
  })

  describe('recognized RPC alias → return trailingText', () => {
    it('accepts a registered RPC alias as the inline command token', () => {
      expect(parseInlineTerm('/ssh deploy', {mcp: [], rpc: [{alias: '/ssh'}]})).toBe('/ssh deploy')
    })
  })

  describe('non-command prose → null', () => {
    it.each(['just some text', 'analyze the data', 'must include 3 competitors'])('returns null for "%s"', text => {
      expect(parseInlineTerm(text)).toBeNull()
    })
    it('returns null for an unrecognized slash keyword', () => {
      expect(parseInlineTerm('/notacommand do a thing')).toBeNull()
    })
  })

  describe('modifier / control / post-processor commands → null (non-generating terms rejected)', () => {
    it.each([
      '/elect :n=3',
      '/validate must cite sources',
      '/refine improve the tone',
      '/foreach item in list',
      '/summarize the above',
      '/memorize this fact',
      '/switch condition',
      '/steps plan the work',
      '/outline the topic',
    ])('returns null for non-generating command: "%s"', text => {
      expect(parseInlineTerm(text)).toBeNull()
    })
  })

  describe('/reason and /instruct are reserved compatibility names, not executor commands → null', () => {
    it('refuses /reason as an inline term', () => {
      expect(parseInlineTerm('/reason explain the tradeoffs')).toBeNull()
    })
    it('refuses /instruct as an inline term', () => {
      expect(parseInlineTerm('/instruct rewrite in formal tone')).toBeNull()
    })
  })

  describe('aliases parameter absent or undefined → built-ins still resolve', () => {
    it('resolves built-in command without aliases argument', () => {
      expect(parseInlineTerm('/chat prompt')).toBe('/chat prompt')
    })
    it('resolves built-in command when aliases is undefined', () => {
      expect(parseInlineTerm('/chat prompt', undefined)).toBe('/chat prompt')
    })
    it('returns null for an alias-only token when aliases is omitted', () => {
      expect(parseInlineTerm('/coder1 prompt')).toBeNull()
    })
  })

  describe('#N order prefix is stripped before classification', () => {
    it('admits #N-prefixed generating term', () => {
      expect(parseInlineTerm('#1 /chat propose directions')).toBe('#1 /chat propose directions')
    })
    it('admits #N-prefixed generating term with negative index', () => {
      expect(parseInlineTerm('#-1 /web search query')).toBe('#-1 /web search query')
    })
    it('refuses a #N-prefixed non-generating term, same as its bare form', () => {
      expect(parseInlineTerm('#2 /outline t')).toBeNull()
      expect(parseInlineTerm('#1 /foreach x')).toBeNull()
    })
  })

  // P0.4: the exclusion is derived from ONE token set, and the bare and #N-prefixed forms of every
  // built-in command classify identically. This is the mechanical guarantee the drift kept breaking.
  describe('mechanical parity over every built-in command token', () => {
    it.each(queryCommands)('classifies "%s" bare and #N-prefixed identically, matching the derived set', token => {
      const queryType = resolveCommand(token).queryType
      const expectedNull = queryType === undefined || NON_GENERATING_TERM_QUERY_TYPES.has(queryType)
      const bare = parseInlineTerm(`${token} x`)
      const prefixed = parseInlineTerm(`#3 ${token} x`)
      expect(bare === null).toBe(expectedNull)
      expect(prefixed === null).toBe(bare === null)
    })
  })
})

describe('NON_GENERATING_TERM_QUERY_TYPES — pinned contents (frontend mirror must match)', () => {
  it('contains exactly the control-flow and post-processor query types', () => {
    expect([...NON_GENERATING_TERM_QUERY_TYPES].sort()).toEqual(
      ['elect', 'foreach', 'memorize', 'outline', 'refine', 'steps', 'summarize', 'switch', 'validate'].sort(),
    )
  })
})

describe('syntheticTermParentId', () => {
  it('appends :term to the given node id', () => {
    expect(syntheticTermParentId('r1')).toBe('r1:term')
  })
  it('is stable — calling twice with the same input returns the same value', () => {
    expect(syntheticTermParentId('r1')).toBe(syntheticTermParentId('r1'))
  })
})

describe('buildSyntheticTermParent', () => {
  it('produces id = nodeId + :term', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').id).toBe('r1:term')
  })
  it('sets command and title to the provided command string', () => {
    const node = buildSyntheticTermParent('r1', '/chat propose directions', null)
    expect(node.command).toBe('/chat propose directions')
    expect(node.title).toBe('/chat propose directions')
  })
  it('children contains only nodeId', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').children).toEqual(['r1'])
  })
  it('parent defaults to null when omitted', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').parent).toBeNull()
  })
  it('parent is set to the given ancestor id for nested elects', () => {
    expect(buildSyntheticTermParent('r1', '/chat X', 'ancestor1').parent).toBe('ancestor1')
  })
  it('prompts is always empty — a wrapped term has no prior output to reuse', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').prompts).toEqual([])
    expect(buildSyntheticTermParent('r1', '/chat X', 'ancestor1').prompts).toEqual([])
  })
})
