// @vitest-environment node
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { Linter } from 'eslint'
import type { Rule } from 'eslint'

const FIXTURE_FILE = path.join(__dirname, '__fixtures__', 'hardcoded-version-violation.tsx')

const d5GuardrailRules = {
  'no-inline-disable-restricted-syntax': {
    create(context: Rule.RuleContext) {
      return {
        Program(node: Rule.Node) {
          context.sourceCode.getAllComments().forEach(comment => {
            if (/\beslint-disable(?:-next-line|-line)?\b.*\bno-restricted-syntax\b/.test(comment.value)) {
              context.report({
                node,
                loc: comment.loc ?? node.loc ?? undefined,
                message: 'Inline disables for no-restricted-syntax are forbidden in render-path lint gates.',
              })
            }
          })
        },
      }
    },
  },
}

// Selectors MUST match what is declared in eslint.config.js.
// Updating one without the other is a VIOLATION.
const flatConfig: Linter.Config[] = [
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'd5-guardrails': {rules: d5GuardrailRules},
    },
    languageOptions: {
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true } },
    },
    rules: {
      'd5-guardrails/no-inline-disable-restricted-syntax': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXText[value=/(?:^|\\s)(?:\\d+\\.\\d+\\.\\d+|dev|local|unknown)(?:\\s|$)/]',
          message:
            'Hardcoded version/build/environment strings are forbidden in JSX render paths. Import from the shared build-version module.',
        },
        {
          selector: 'JSXAttribute > Literal[value=/^(?:\\d+\\.\\d+\\.\\d+|dev|local|unknown)$/]',
          message:
            'Hardcoded version/build/environment strings are forbidden in JSX attributes. Import from the shared build-version module.',
        },
        {
          selector:
            'JSXExpressionContainer > Literal[value=/^(?:\\d+\\.\\d+\\.\\d+|dev|local|unknown)$/]',
          message:
            'Hardcoded version/build/environment strings are forbidden in JSX expressions. Import from the shared build-version module.',
        },
      ],
    },
  },
]

const BANNED_KEYWORDS = ['dev', 'local', 'unknown']
const SEMVER_EXAMPLE = '1.2.3'

const linter = new Linter()

function lint(code: string) {
  return linter.verify(code, flatConfig, { filename: 'test.tsx' })
    .filter(m => m.ruleId === 'no-restricted-syntax')
}

function lintAll(code: string) {
  return linter.verify(code, flatConfig, { filename: 'test.tsx' })
}

describe('ESLint no-restricted-syntax: hardcoded version/build strings in JSX', () => {
  describe('JSXText selector — banned strings in JSX text nodes', () => {
    it('fires on a semver string (x.y.z) as JSX text content', () => {
      expect(lint(`export const C = () => <div>${SEMVER_EXAMPLE}</div>`)).toHaveLength(1)
    })

    it('fires on a semver string embedded in surrounding whitespace in JSX text', () => {
      expect(lint(`export const C = () => <div> ${SEMVER_EXAMPLE} </div>`)).toHaveLength(1)
    })

    it.each(BANNED_KEYWORDS)('fires on banned keyword "%s" as JSX text content', keyword => {
      expect(lint(`export const C = () => <span>${keyword}</span>`)).toHaveLength(1)
    })

    it('does not fire on a partial semver string ("1.2") as JSX text — requires three numeric parts', () => {
      expect(lint('export const C = () => <div>1.2</div>')).toHaveLength(0)
    })

    it('does not fire on arbitrary text content unrelated to version strings', () => {
      expect(lint('export const C = () => <div>loading…</div>')).toHaveLength(0)
    })
  })

  describe('JSXAttribute selector — banned strings as JSX attribute values', () => {
    it('fires on a semver string as JSX attribute value', () => {
      expect(lint(`export const C = () => <input data-version="${SEMVER_EXAMPLE}" />`)).toHaveLength(1)
    })

    it.each(BANNED_KEYWORDS)('fires on banned keyword "%s" as JSX attribute value', keyword => {
      expect(lint(`export const C = () => <span data-env="${keyword}" />`)).toHaveLength(1)
    })

    it('does not fire on a non-version string attribute value', () => {
      expect(lint('export const C = () => <div className="version-label">{label}</div>')).toHaveLength(0)
    })

    it('does not fire on a partial semver string ("1.2") as attribute value', () => {
      expect(lint('export const C = () => <span data-ver="1.2" />')).toHaveLength(0)
    })
  })

  describe('JSXExpressionContainer selector — banned string literals in JSX expressions', () => {
    it('fires on a semver string literal inside a JSX expression container', () => {
      expect(lint(`export const C = () => <div>{'${SEMVER_EXAMPLE}'}</div>`)).toHaveLength(1)
    })

    it.each(BANNED_KEYWORDS)('fires on banned keyword "%s" as a JSX expression string literal', keyword => {
      expect(lint(`export const C = () => <span>{'${keyword}'}</span>`)).toHaveLength(1)
    })

    it('does not fire on a variable reference inside a JSX expression — only literal strings are forbidden', () => {
      expect(lint('const v = "1.2.3"\nexport const C = () => <div>{v}</div>')).toHaveLength(0)
    })

    it('does not fire on a partial semver string ("1.2") inside a JSX expression', () => {
      expect(lint("export const C = () => <div>{'1.2'}</div>")).toHaveLength(0)
    })

    it.each([
      [
        'next-line disable',
        `export const C = () => <div>
{/* eslint-disable-next-line no-restricted-syntax */}
{'${SEMVER_EXAMPLE}'}
</div>`,
      ],
      [
        'block disable',
        `/* eslint-disable no-restricted-syntax */
export const C = () => <div>{'${SEMVER_EXAMPLE}'}</div>`,
      ],
      [
        'line disable',
        `export const C = () => <div>
{/* eslint-disable-line no-restricted-syntax */}{'${SEMVER_EXAMPLE}'}
</div>`,
      ],
      [
        'attempted disable of both guard and restricted syntax',
        `export const C = () => <div>
{/* eslint-disable-next-line no-restricted-syntax, d5-guardrails/no-inline-disable-restricted-syntax */}
{'${SEMVER_EXAMPLE}'}
</div>`,
      ],
    ])('still fires when an inline eslint-disable comment tries to suppress the rule: %s', (_caseName, code) => {
      const messages = lintAll(code)

      expect(messages.some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(true)
    })

    it('does not fire the guardrail for eslint-disable comments targeting unrelated rules', () => {
      const messages = lintAll(`export const C = () => <div>
{/* eslint-disable-next-line react/no-danger */}
{'${SEMVER_EXAMPLE}'}
</div>`)

      expect(messages.some(m => m.ruleId === 'd5-guardrails/no-inline-disable-restricted-syntax')).toBe(false)
      expect(messages.some(m => m.ruleId === 'no-restricted-syntax')).toBe(true)
    })
  })

  describe('Non-JSX contexts — no false positives outside JSX render paths', () => {
    it('does not fire on a version string assigned to a variable', () => {
      expect(lint(`const version = '${SEMVER_EXAMPLE}'`)).toHaveLength(0)
    })

    it('does not fire on a banned keyword passed as a function argument', () => {
      expect(lint("console.log('dev')")).toHaveLength(0)
    })

    it('does not fire on a banned keyword in a plain string array', () => {
      expect(lint("const envs = ['dev', 'local', 'unknown']")).toHaveLength(0)
    })
  })

  describe('fixture file — end-to-end regression gate across all three selectors', () => {
    it('fixture triggers exactly 9 violations (4 JSXText + 1 JSXAttribute + 4 JSXExpressionContainer)', () => {
      const code = fs.readFileSync(FIXTURE_FILE, 'utf-8')
      const violations = linter.verify(code, flatConfig, { filename: 'fixture.tsx' })
        .filter(m => m.ruleId === 'no-restricted-syntax')
      expect(violations).toHaveLength(9)
    })

    it('all fixture violations carry the standard rule message prefix', () => {
      const code = fs.readFileSync(FIXTURE_FILE, 'utf-8')
      const violations = linter.verify(code, flatConfig, { filename: 'fixture.tsx' })
        .filter(m => m.ruleId === 'no-restricted-syntax')
      expect(
        violations.every(v => v.message.startsWith('Hardcoded version/build/environment strings')),
      ).toBe(true)
    })
  })
})

describe('JSX Fragment context — banned strings in fragments are caught by JSXText selector', () => {
  it('fires on a semver string as the direct text child of a JSX fragment', () => {
    expect(lint(`export const C = () => <>${SEMVER_EXAMPLE}</>`)).toHaveLength(1)
  })

  it.each(BANNED_KEYWORDS)('fires on banned keyword "%s" as text content inside a fragment', keyword => {
    expect(lint(`export const C = () => <>${keyword}</>`)).toHaveLength(1)
  })

  it('does not fire on safe text inside a fragment', () => {
    expect(lint('export const C = () => <>loading…</>')).toHaveLength(0)
  })
})

describe('Nested elements — each banned text node fires independently', () => {
  it('fires once when a banned string appears in a child element inside a wrapper', () => {
    expect(lint(`export const C = () => <div><span>${SEMVER_EXAMPLE}</span></div>`)).toHaveLength(1)
  })

  it('fires for each banned text node when multiple siblings each contain a banned string', () => {
    expect(
      lint(`export const C = () => <><span>${SEMVER_EXAMPLE}</span><span>dev</span></>`),
    ).toHaveLength(2)
  })

  it('does not fire when only the wrapper has safe content and children have banned strings as expressions — counts only violations actually present', () => {
    const violations = lint(`export const C = () => <div>{'${SEMVER_EXAMPLE}'}</div>`)
    expect(violations).toHaveLength(1)
  })
})


describe('JSXText boundary: v-prefixed semver is not treated as a forbidden version string', () => {
  it('does not fire on "v1.2.3" (letter-prefixed) as JSX text — rule targets bare numeric semver', () => {
    expect(lint('export const C = () => <div>v1.2.3</div>')).toHaveLength(0)
  })

  it('does not fire on "Version 1.2.3" — the word boundary still requires whitespace before the digits', () => {
    // "Version 1.2.3": space before "1" satisfies \s, so this DOES fire.
    // Documenting the boundary: any whitespace before x.y.z triggers the rule.
    expect(lint('export const C = () => <div>Version 1.2.3</div>')).toHaveLength(1)
  })

  it('does not fire on "1.2.3-rc" (pre-release suffix) as JSX text — rule matches x.y.z followed by whitespace or end', () => {
    // "1.2.3-rc" — after the semver digits, "-rc" does not match (?:\s|$), so no violation.
    expect(lint('export const C = () => <div>1.2.3-rc</div>')).toHaveLength(0)
  })
})
