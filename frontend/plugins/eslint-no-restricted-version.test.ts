// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Linter } from 'eslint'
import { noInlineDisableGuardrailRule } from './no-inline-disable-guardrail.js'
import { hardcodedVersionRestrictions } from './jsx-version-restrictions.js'
import deployedConfig from '../eslint.config.js'

const FIXTURE_FILE = path.join(__dirname, '__fixtures__', 'hardcoded-version-violation.tsx')
const FIXTURE_CODE = fs.readFileSync(FIXTURE_FILE, 'utf-8')

const flatConfig: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'd5-guardrails': { rules: { 'no-inline-disable-restricted-syntax': noInlineDisableGuardrailRule } },
    },
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true } },
    },
    rules: {
      'd5-guardrails/no-inline-disable-restricted-syntax': 'error',
      'no-restricted-syntax': ['error', ...hardcodedVersionRestrictions],
    },
  },
]

const BANNED_KEYWORDS = ['dev', 'local', 'unknown'] as const
const SEMVER_VARIANTS = [
  ['single-digit components', '1.2.3'],
  ['multi-digit components', '10.20.300'],
  ['zero components', '0.0.0'],
] as const

const linter = new Linter()

function lint(code: string) {
  return linter.verify(code, flatConfig, { filename: 'test.tsx' })
    .filter(m => m.ruleId === 'no-restricted-syntax')
}

function lintAll(code: string) {
  return linter.verify(code, flatConfig, { filename: 'test.tsx' })
}

function selectorRegex(entry: { selector: string }): RegExp {
  const m = entry.selector.match(/\[value=\/(.*?)\/]/)
  if (!m) throw new Error(`no embedded regex in selector: ${entry.selector}`)
  return new RegExp(m[1])
}

// ─── Module contract ─────────────────────────────────────────────

describe('jsx-version-restrictions — module and type contract', () => {
  it('exports exactly three restriction entries — one per JSX node category', () => {
    expect(hardcodedVersionRestrictions).toHaveLength(3)
  })

  it('each entry exposes a non-empty selector string and a non-empty message string', () => {
    for (const { selector, message } of hardcodedVersionRestrictions) {
      expect(selector.length).toBeGreaterThan(0)
      expect(message.length).toBeGreaterThan(0)
    }
  })

  it('each selector embeds a syntactically extractable and compilable regex pattern', () => {
    for (const entry of hardcodedVersionRestrictions) {
      expect(() => selectorRegex(entry)).not.toThrow()
    }
  })

  it('each embedded regex matches all three semver variant shapes', () => {
    for (const entry of hardcodedVersionRestrictions) {
      const regex = selectorRegex(entry)
      const matchesSemver = ['1.2.3', ' 1.2.3', '1.2.3 ', ' 1.2.3 '].some(s => regex.test(s))
      expect(matchesSemver, `regex in "${entry.selector}" does not match "1.2.3"`).toBe(true)
    }
  })

  it('each embedded regex matches every banned build-environment keyword', () => {
    for (const entry of hardcodedVersionRestrictions) {
      const regex = selectorRegex(entry)
      for (const keyword of BANNED_KEYWORDS) {
        const matches = [keyword, ` ${keyword}`, `${keyword} `, ` ${keyword} `].some(s => regex.test(s))
        expect(matches, `regex in "${entry.selector}" does not match keyword "${keyword}"`).toBe(true)
      }
    }
  })

})

// ─── Deployed-config wiring (regression guard for the config→rule binding) ─────

describe('eslint.config — restrictions are actually wired into the deployed config', () => {
  it('a source-files block wires no-restricted-syntax with the hardcoded-version restrictions', () => {
    const blocks = (deployedConfig as Linter.Config[]).filter(
      c => Array.isArray(c?.rules?.['no-restricted-syntax']),
    )
    expect(blocks.length, 'no config block wires no-restricted-syntax at all').toBeGreaterThan(0)

    const wired = blocks.some(block => {
      const rule = block.rules!['no-restricted-syntax'] as unknown[]
      const selectors = rule.slice(1).map(entry => (entry as { selector?: string }).selector)
      return hardcodedVersionRestrictions.every(hv => selectors.includes(hv.selector))
    })
    expect(
      wired,
      'eslint.config must wire no-restricted-syntax with hardcodedVersionRestrictions — ' +
        'unwiring it would silently disable the gate',
    ).toBe(true)
  })
})

// ─── no-inline-disable-guardrail module contract ─────────────────────────────────

describe('no-inline-disable-guardrail — module contract', () => {
  it('exposes a create function conforming to the Rule.RuleModule interface', () => {
    expect(typeof noInlineDisableGuardrailRule.create).toBe('function')
  })
})

// ─── Character class and boundary semantics ──────────────────────────────────────

describe('selector pattern semantics — character class and boundary behaviour', () => {
  it('digit positions require numeric characters — alpha characters in the digit positions do not match', () => {
    for (const entry of hardcodedVersionRestrictions) {
      const regex = selectorRegex(entry)
      expect(regex.test('d.d.d'), `alpha char matched digit position in: ${entry.selector}`).toBe(false)
      const anyNumericSemver = ['0.0.0', '1.2.3', '10.20.300'].some(v => regex.test(v))
      expect(anyNumericSemver, `no numeric semver matched in: ${entry.selector}`).toBe(true)
    }
  })

  it('version part separators require a literal dot — dash and other non-dot separators do not match', () => {
    for (const entry of hardcodedVersionRestrictions) {
      const regex = selectorRegex(entry)
      expect(regex.test('dXdXd'), `non-dot separator matched in: ${entry.selector}`).toBe(false)
      expect(regex.test('1-2-3'), `dash separator matched in: ${entry.selector}`).toBe(false)
    }
  })

  it('JSXText word-boundary anchors match all Unicode whitespace categories (tab, newline, carriage return)', () => {
    const textEntry = hardcodedVersionRestrictions.find(e => e.selector.startsWith('JSXText'))
    expect(textEntry).toBeDefined()
    const regex = selectorRegex(textEntry!)
    expect(regex.test('\t1.2.3\n')).toBe(true)
    expect(regex.test('\r1.2.3\r')).toBe(true)
    expect(regex.test('s1.2.3s')).toBe(false)
  })

  it('JSXAttribute and JSXExpressionContainer selectors require an exact full-string match — padded whitespace is not a valid boundary', () => {
    const exactSelectors = hardcodedVersionRestrictions.filter(
      e => e.selector.startsWith('JSXAttribute') || e.selector.startsWith('JSXExpressionContainer'),
    )
    expect(exactSelectors).toHaveLength(2)
    for (const entry of exactSelectors) {
      const regex = selectorRegex(entry)
      expect(regex.test(' 1.2.3 '), `padded semver matched in: ${entry.selector}`).toBe(false)
      expect(regex.test('1.2.3'), `exact semver did not match in: ${entry.selector}`).toBe(true)
      expect(regex.test(' dev '), `padded keyword matched in: ${entry.selector}`).toBe(false)
      expect(regex.test('dev'), `exact keyword did not match in: ${entry.selector}`).toBe(true)
    }
  })

  it('a partially-alphabetic semver-shaped string is rejected — every digit position must be fully numeric', () => {
    for (const entry of hardcodedVersionRestrictions) {
      const regex = selectorRegex(entry)
      expect(regex.test('1.x.3'), `mixed alpha/digit semver matched in: ${entry.selector}`).toBe(false)
      expect(regex.test('a.2.3'), `leading alpha semver matched in: ${entry.selector}`).toBe(false)
    }
  })
})

// ─── JSXText selector ────────────────────────────────────────────────────────────

describe('no-restricted-syntax — JSXText selector', () => {
  describe('fires on banned strings', () => {
    it.each(SEMVER_VARIANTS)('%s semver fires as JSX text content', (_label, semver) => {
      expect(lint(`export const C = () => <div>${semver}</div>`)).toHaveLength(1)
    })

    it('fires on semver padded with whitespace in JSX text', () => {
      expect(lint('export const C = () => <div> 1.2.3 </div>')).toHaveLength(1)
    })

    it.each(BANNED_KEYWORDS)('fires on banned keyword "%s" as direct JSX text', keyword => {
      expect(lint(`export const C = () => <span>${keyword}</span>`)).toHaveLength(1)
    })

    it('fires on a banned keyword embedded in surrounding text when whitespace boundaries are satisfied', () => {
      expect(lint('export const C = () => <div>in dev mode</div>')).toHaveLength(1)
    })

    it('fires on a semver preceded by a space mid-sentence', () => {
      expect(lint('export const C = () => <div>Version 1.2.3</div>')).toHaveLength(1)
    })

    it('fires on a semver at the start of JSX text followed by a whitespace-delimited word', () => {
      expect(lint('export const C = () => <div>1.2.3 available</div>')).toHaveLength(1)
    })

    it('fires on semver bounded by tab characters', () => {
      expect(lint('export const C = () => <div>\t1.2.3\t</div>')).toHaveLength(1)
    })

    it('fires on semver bounded by newline characters', () => {
      expect(lint('export const C = () => <div>\n1.2.3\n</div>')).toHaveLength(1)
    })

    it('fires on semver indented inside multiline JSX content — newline+spaces satisfy the whitespace boundary', () => {
      expect(lint('export const C = () => <div>\n  1.2.3\n</div>')).toHaveLength(1)
    })

    it('fires on a banned keyword indented inside multiline JSX content', () => {
      expect(lint('export const C = () => <span>\n  dev\n</span>')).toHaveLength(1)
    })
  })

  describe('does not fire outside the pattern', () => {
    it('does not fire on a two-part version — three numeric parts are required', () => {
      expect(lint('export const C = () => <div>1.2</div>')).toHaveLength(0)
    })

    it('does not fire on a four-part version — trailing ".N" violates the end-of-word boundary', () => {
      expect(lint('export const C = () => <div>1.2.3.4</div>')).toHaveLength(0)
    })

    it('does not fire on a letter-prefixed semver — the leading non-whitespace character breaks the start boundary', () => {
      expect(lint('export const C = () => <div>v1.2.3</div>')).toHaveLength(0)
    })

    it('does not fire when a semver is immediately preceded by any non-whitespace character', () => {
      expect(lint('export const C = () => <div>x1.2.3</div>')).toHaveLength(0)
    })

    it('does not fire on a semver with a pre-release suffix — the trailing non-whitespace character breaks the end boundary', () => {
      expect(lint('export const C = () => <div>1.2.3-rc</div>')).toHaveLength(0)
    })

    it('does not fire on arbitrary safe text', () => {
      expect(lint('export const C = () => <div>loading…</div>')).toHaveLength(0)
    })

    it('does not fire when a banned keyword is a prefix of a longer word without whitespace separation', () => {
      expect(lint('export const C = () => <div>devtools</div>')).toHaveLength(0)
    })

    it('does not fire when a banned keyword is connected to adjacent text by a non-whitespace character', () => {
      expect(lint('export const C = () => <div>dev-mode</div>')).toHaveLength(0)
    })
  })
})

// ─── JSXAttribute selector ─────────────────────────────────────────────────────

describe('no-restricted-syntax — JSXAttribute selector', () => {
  describe('fires on banned strings', () => {
    it.each(SEMVER_VARIANTS)('%s semver fires as a JSX attribute literal value', (_label, semver) => {
      expect(lint(`export const C = () => <input data-version="${semver}" />`)).toHaveLength(1)
    })

    it.each(BANNED_KEYWORDS)('fires on banned keyword "%s" as a JSX attribute literal value', keyword => {
      expect(lint(`export const C = () => <span data-env="${keyword}" />`)).toHaveLength(1)
    })
  })

  describe('does not fire outside the pattern', () => {
    it('does not fire on a partial semver — the attribute value must match the full three-part pattern', () => {
      expect(lint('export const C = () => <span data-ver="1.2" />')).toHaveLength(0)
    })

    it('does not fire on a four-part version — only three-part semver is matched', () => {
      expect(lint('export const C = () => <span data-ver="1.2.3.4" />')).toHaveLength(0)
    })

    it('does not fire on a semver with a pre-release suffix — the attribute value must match exactly', () => {
      expect(lint('export const C = () => <span data-ver="1.2.3-rc" />')).toHaveLength(0)
    })

    it('does not fire on an unrelated string attribute value', () => {
      expect(lint('export const C = () => <div className="version-label" />')).toHaveLength(0)
    })

    it('does not fire on a plain numeric attribute value that is not semver-shaped', () => {
      expect(lint('export const C = () => <span data-count="42" />')).toHaveLength(0)
    })

    it('does not fire on an identifier reference in an attribute expression container — only Literal nodes are targeted', () => {
      expect(lint('const v = "1.2.3"\nexport const C = () => <input data-v={v} />')).toHaveLength(0)
    })

    it('does not fire on a JSX spread attribute — spread props are not JSXAttribute > Literal nodes', () => {
      expect(lint("export const C = () => <input {...{version: '1.2.3'}} />")).toHaveLength(0)
    })

    it('does not fire on a semver attribute value padded with whitespace — the selector requires an exact full-string match', () => {
      expect(lint('export const C = () => <span data-ver=" 1.2.3 " />')).toHaveLength(0)
    })
  })
})

// ─── JSXExpressionContainer selector ──────────────────────────────────────────────

describe('no-restricted-syntax — JSXExpressionContainer selector', () => {
  describe('fires on banned string literals', () => {
    it.each(SEMVER_VARIANTS)('%s semver fires as a string literal inside an expression', (_label, semver) => {
      expect(lint(`export const C = () => <div>{'${semver}'}</div>`)).toHaveLength(1)
    })

    it('fires regardless of string delimiter — double-quoted literals are detected identically to single-quoted', () => {
      expect(lint('export const C = () => <div>{"1.2.3"}</div>')).toHaveLength(1)
    })

    it.each(BANNED_KEYWORDS)('fires on banned keyword "%s" as a string literal in an expression', keyword => {
      expect(lint(`export const C = () => <span>{'${keyword}'}</span>`)).toHaveLength(1)
    })
  })

  describe('does not fire on non-literal expressions', () => {
    it('does not fire on an identifier reference — only Literal nodes are targeted, not identifiers', () => {
      expect(lint('const v = "1.2.3"\nexport const C = () => <div>{v}</div>')).toHaveLength(0)
    })

    it('does not fire on a template literal — rule targets Literal nodes, not TemplateLiteral nodes', () => {
      expect(lint('export const C = () => <div>{`1.2.3`}</div>')).toHaveLength(0)
    })

    it('does not fire on a numeric literal — only string Literal nodes are matched', () => {
      expect(lint('export const C = () => <div>{42}</div>')).toHaveLength(0)
    })

    it('does not fire on a partial semver string literal', () => {
      expect(lint("export const C = () => <div>{'1.2'}</div>")).toHaveLength(0)
    })

    it('does not fire on a semver string with a pre-release suffix', () => {
      expect(lint("export const C = () => <div>{'1.2.3-rc'}</div>")).toHaveLength(0)
    })

    it('does not fire on a four-part version string — only three-part semver is matched', () => {
      expect(lint("export const C = () => <div>{'1.2.3.4'}</div>")).toHaveLength(0)
    })

    it('does not fire on a semver string literal padded with whitespace — the selector requires an exact full-string match', () => {
      expect(lint("export const C = () => <div>{' 1.2.3 '}</div>")).toHaveLength(0)
    })
  })
})

// ─── Cross-selector boundary and count semantics ───────────────────────────────────────────────

describe('no-restricted-syntax — cross-selector boundary and violation count semantics', () => {
  it('a string literal in an expression container inside an attribute fires the expression selector, not the attribute selector', () => {
    const code = "export const C = () => <input data-v={'1.2.3'} />"
    const all = lintAll(code).filter(m => m.ruleId === 'no-restricted-syntax')
    expect(all).toHaveLength(1)
    expect(all[0].message).toContain('expressions')
  })

  it('a plain string attribute literal fires the attribute selector, not the expression selector', () => {
    const code = 'export const C = () => <input data-version="1.2.3" />'
    const all = lintAll(code).filter(m => m.ruleId === 'no-restricted-syntax')
    expect(all).toHaveLength(1)
    expect(all[0].message).toContain('attributes')
  })

  it('a string in JSX text fires the render-path selector, not the attribute or expression selector', () => {
    const code = 'export const C = () => <div>1.2.3</div>'
    const all = lintAll(code).filter(m => m.ruleId === 'no-restricted-syntax')
    expect(all).toHaveLength(1)
    expect(all[0].message).toContain('render paths')
  })

  it('a JSXText node containing multiple distinct banned patterns fires exactly once — the rule is node-scoped, not match-scoped', () => {
    expect(lint('export const C = () => <div>1.2.3 and 1.0.0</div>')).toHaveLength(1)
  })

  it('a banned JSXText node and a banned JSXAttribute on the same element each fire their own selector independently', () => {
    const code = 'export const C = () => <input data-version="1.2.3">1.2.3</input>'
    const all = lintAll(code).filter(m => m.ruleId === 'no-restricted-syntax')
    expect(all).toHaveLength(2)
    expect(all.some(m => m.message.includes('render paths'))).toBe(true)
    expect(all.some(m => m.message.includes('attributes'))).toBe(true)
  })
})

// ─── Inline-disable guardrail ───────────────────────────────────────────────────────────

describe('no-inline-disable-restricted-syntax guardrail', () => {
  describe('fires for disable comments that name no-restricted-syntax', () => {
    it.each([
      ['eslint-disable-next-line', "export const C = () => <div>\n{/* eslint-disable-next-line no-restricted-syntax */}\n{'1.2.3'}\n</div>"],
      ['eslint-disable (block)', "/* eslint-disable no-restricted-syntax */\nexport const C = () => <div>{'1.2.3'}</div>"],
      ['eslint-disable-line', "export const C = () => <div>\n{/* eslint-disable-line no-restricted-syntax */}{'1.2.3'}\n</div>"],
      ['disable listing both guardrail and target rule', "export const C = () => <div>\n{/* eslint-disable-next-line no-restricted-syntax, d5-guardrails/no-inline-disable-restricted-syntax */}\n{'1.2.3'}\n</div>"],
      ['no-restricted-syntax listed first among multiple rules', "/* eslint-disable no-restricted-syntax, react/no-danger */\nexport const C = () => <div>safe</div>"],
      ['no-restricted-syntax listed after an unrelated rule', "/* eslint-disable react/no-danger, no-restricted-syntax */\nexport const C = () => <div>safe</div>"],
    ])('fires for "%s"', (_form, code) => {
      expect(lintAll(code).some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(true)
    })
  })

  describe('does not fire for comments that are not targeted disable directives', () => {
    it('does not fire for an eslint-enable comment — only disable directives are targeted', () => {
      const code = "/* eslint-enable no-restricted-syntax */\nexport const C = () => <div>{'1.2.3'}</div>"
      expect(lintAll(code).some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(false)
    })

    it('does not fire for a disable comment targeting an unrelated rule — the violation still surfaces from no-restricted-syntax', () => {
      const code = "export const C = () => <div>\n{/* eslint-disable-next-line react/no-danger */}\n{'1.2.3'}\n</div>"
      const messages = lintAll(code)
      expect(messages.some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(false)
      expect(messages.some(m => m.ruleId === 'no-restricted-syntax')).toBe(true)
    })

    it('does not fire for a plain comment that mentions the rule name without being a disable directive', () => {
      const code = "// no-restricted-syntax applies here\nexport const C = () => <div>{'1.2.3'}</div>"
      expect(lintAll(code).some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(false)
    })

    it('does not fire for an eslint-disable-all comment — only targeted disables are matched', () => {
      const code = "/* eslint-disable */\nexport const C = () => <div>{'1.2.3'}</div>"
      expect(lintAll(code).some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(false)
    })

    it('does not fire for a disable comment naming only the guardrail rule itself, not no-restricted-syntax', () => {
      const code = "/* eslint-disable d5-guardrails/no-inline-disable-restricted-syntax */\nexport const C = () => <div>safe</div>"
      expect(lintAll(code).some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(false)
    })
  })
})

// ─── Non-JSX contexts ─────────────────────────────────────────────────────────────

describe('non-JSX contexts — no false positives outside JSX render paths', () => {
  it('does not fire on a version string in a variable assignment', () => {
    expect(lint("const version = '1.2.3'")).toHaveLength(0)
  })

  it('does not fire on a banned keyword passed as a function argument', () => {
    expect(lint("console.log('dev')")).toHaveLength(0)
  })

  it('does not fire on banned keywords in a plain string array', () => {
    expect(lint("const envs = ['dev', 'local', 'unknown']")).toHaveLength(0)
  })

  it('does not fire on a banned keyword as an object property value', () => {
    expect(lint("const config = { env: 'dev', version: '1.2.3' }")).toHaveLength(0)
  })
})

// ─── JSX structural contexts ─────────────────────────────────────────────────────────

describe('JSX structural contexts — nesting and fragments', () => {
  describe('fragment context', () => {
    it.each(['1.2.3', ...Array.from(BANNED_KEYWORDS)])('fires on "%s" as direct text content of a JSX fragment', text => {
      expect(lint(`export const C = () => <>${text}</>`)).toHaveLength(1)
    })

    it('does not fire on safe text inside a fragment', () => {
      expect(lint('export const C = () => <>loading…</>')).toHaveLength(0)
    })
  })

  describe('nested element context', () => {
    it('fires once per banned text node regardless of element nesting depth', () => {
      expect(lint('export const C = () => <div><span>1.2.3</span></div>')).toHaveLength(1)
    })

    it('fires independently for each sibling element containing a banned string', () => {
      expect(lint('export const C = () => <><span>1.2.3</span><span>dev</span></>')).toHaveLength(2)
    })
  })
})

// ─── Fixture regression gate ───────────────────────────────────────────────────────────

describe('fixture regression gate — all three selectors active simultaneously', () => {
  function fixtureViolations() {
    return linter.verify(FIXTURE_CODE, flatConfig, { filename: 'fixture.tsx' })
      .filter(m => m.ruleId === 'no-restricted-syntax')
  }

  it('reports exactly 4 violations from the JSXText selector', () => {
    expect(fixtureViolations().filter(v => v.message.includes('render paths'))).toHaveLength(4)
  })

  it('reports exactly 1 violation from the JSXAttribute selector', () => {
    expect(fixtureViolations().filter(v => v.message.includes('attributes'))).toHaveLength(1)
  })

  it('reports exactly 4 violations from the JSXExpressionContainer selector', () => {
    expect(fixtureViolations().filter(v => v.message.includes('expressions'))).toHaveLength(4)
  })

  it('all violations carry the standard message prefix', () => {
    expect(
      fixtureViolations().every(v => v.message.startsWith('Hardcoded version/build/environment strings')),
    ).toBe(true)
  })
})
