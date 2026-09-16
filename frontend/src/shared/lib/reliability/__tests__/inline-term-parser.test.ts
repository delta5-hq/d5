import { describe, it, expect } from 'vitest'
import {
  parseInlineTerm,
  syntheticTermParentId,
  buildSyntheticTermParent,
  NON_GENERATING_TERM_QUERY_TYPES,
} from '../inline-term-parser'
import { getFullCommandMap, type DynamicAlias } from '../../command-querytype-mapper'
import { BUILTIN_COMMANDS } from '../../builtin-command-aliases'

describe('parseInlineTerm (frontend)', () => {
  describe('absent or empty trailing text → null', () => {
    it('returns null for undefined', () => {
      expect(parseInlineTerm(undefined)).toBeNull()
    })

    it('returns null for empty string', () => {
      expect(parseInlineTerm('')).toBeNull()
    })
  })

  describe('recognized built-in command → return trailingText', () => {
    it.each(['/chat propose four directions', '/chatgpt summarize the transcript', '/web latest benchmark results'])(
      'accepts built-in command as inline term: %s',
      text => {
        expect(parseInlineTerm(text)).toBe(text)
      },
    )
  })

  describe('recognized dynamic alias → return trailingText', () => {
    it('accepts a registered dynamic alias as the inline command token', () => {
      const aliases: DynamicAlias[] = [{ alias: '/coder1' }]
      expect(parseInlineTerm('/coder1 fix the bug', aliases)).toBe('/coder1 fix the bug')
    })

    it('returns null for the same token when no aliases are registered', () => {
      expect(parseInlineTerm('/coder1 fix the bug', [])).toBeNull()
    })
  })

  describe('non-command prose → null', () => {
    it.each(['must cite sources', 'be concise and accurate'])('returns null for criterion prose: "%s"', text => {
      expect(parseInlineTerm(text)).toBeNull()
    })

    it('returns null for an unrecognized slash keyword', () => {
      expect(parseInlineTerm('/unknown-tool do something')).toBeNull()
    })
  })

  describe('P0.2: modifier / control commands → null (non-generating terms rejected)', () => {
    it.each([
      '/elect :n=3',
      '/validate must cite sources',
      '/refine improve the tone',
      '/foreach item in list',
      '/summarize the above',
      '/memorize this fact',
      '/switch condition',
    ])('returns null for modifier/control command: "%s"', text => {
      expect(parseInlineTerm(text)).toBeNull()
    })
  })

  describe('aliases parameter absent → built-ins still resolve', () => {
    it('resolves built-in command without aliases argument', () => {
      expect(parseInlineTerm('/chat prompt')).toBe('/chat prompt')
    })

    it('returns null for an alias-only token when aliases is omitted', () => {
      expect(parseInlineTerm('/coder1 prompt')).toBeNull()
    })
  })

  describe('P0.3 parity: frontend token set matches backend — explicit named cases', () => {
    it('admits /reason (chat alias) — resolves to chat queryType, not in NON_GENERATING set', () => {
      expect(parseInlineTerm('/reason explain the tradeoffs')).toBe('/reason explain the tradeoffs')
    })

    it('admits /instruct (chat alias) — resolves to chat queryType, not in NON_GENERATING set', () => {
      expect(parseInlineTerm('/instruct rewrite in formal tone')).toBe('/instruct rewrite in formal tone')
    })

    it('rejects /case (switch child) — resolves to switch queryType, which is in NON_GENERATING set', () => {
      expect(parseInlineTerm('/case branch condition')).toBeNull()
    })

    it('admits /steps — a sequencing term run per fork by StepsCommand', () => {
      expect(parseInlineTerm('/steps')).toBe('/steps')
    })

    it('admits #N-prefixed term — matchesAnyCommandWithOrder allows the order prefix', () => {
      expect(parseInlineTerm('#1 /chat propose directions')).toBe('#1 /chat propose directions')
    })

    it('admits #N-prefixed term with negative index', () => {
      expect(parseInlineTerm('#-1 /web search query')).toBe('#-1 /web search query')
    })
  })
})

describe('P0.4 — /outline refused and #N prefix classified like its bare form', () => {
  it('refuses /outline unconditionally', () => {
    expect(parseInlineTerm('/outline the topic')).toBeNull()
  })

  it('refuses a #N-prefixed non-generating term, same as its bare form', () => {
    expect(parseInlineTerm('#2 /outline t')).toBeNull()
    expect(parseInlineTerm('#1 /foreach x')).toBeNull()
  })

  it('the pinned non-generating set matches the backend contents', () => {
    expect([...NON_GENERATING_TERM_QUERY_TYPES].sort()).toEqual(
      ['elect', 'foreach', 'memorize', 'outline', 'refine', 'summarize', 'switch', 'validate'].sort(),
    )
  })

  // Mechanical parity: every built-in command classifies its bare and #N-prefixed forms identically,
  // matching the derived non-generating set — the same guarantee the backend pins over queryCommands.
  it.each(BUILTIN_COMMANDS.map(c => c.alias))('classifies "%s" bare and #N-prefixed identically', alias => {
    const queryType = getFullCommandMap()[alias]
    const expectedNull = queryType === undefined || NON_GENERATING_TERM_QUERY_TYPES.has(queryType)
    const bare = parseInlineTerm(`${alias} x`)
    const prefixed = parseInlineTerm(`#3 ${alias} x`)
    expect(bare === null).toBe(expectedNull)
    expect(prefixed === null).toBe(bare === null)
  })
})

describe('syntheticTermParentId (frontend)', () => {
  it('appends :term to the given node id', () => {
    expect(syntheticTermParentId('elect1')).toBe('elect1:term')
  })

  it('is stable — calling twice with the same input returns the same value', () => {
    expect(syntheticTermParentId('r1')).toBe(syntheticTermParentId('r1'))
  })
})

describe('buildSyntheticTermParent (frontend)', () => {
  it('produces id = nodeId + :term', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').id).toBe('r1:term')
  })

  it('sets command and title to the provided command string', () => {
    const node = buildSyntheticTermParent('r1', '/chat propose directions')
    expect(node.command).toBe('/chat propose directions')
    expect(node.title).toBe('/chat propose directions')
  })

  it('children contains only nodeId', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').children).toEqual(['r1'])
  })

  it('prompts is empty', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').prompts).toEqual([])
  })

  it('parent is undefined when omitted', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').parent).toBeUndefined()
  })

  it('parent is undefined when passed null', () => {
    expect(buildSyntheticTermParent('r1', '/chat X', null).parent).toBeUndefined()
  })

  it('parent is set to the given ancestor id for nested elects', () => {
    expect(buildSyntheticTermParent('r1', '/chat X', 'ancestor1').parent).toBe('ancestor1')
  })

  it('prompts is always empty — a wrapped term has no prior output to reuse', () => {
    expect(buildSyntheticTermParent('r1', '/chat X').prompts).toEqual([])
    expect(buildSyntheticTermParent('r1', '/chat X', 'ancestor1').prompts).toEqual([])
  })
})
