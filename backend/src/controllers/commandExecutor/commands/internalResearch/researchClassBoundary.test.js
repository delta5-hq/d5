import path from 'path'
import fs from 'fs'

const BACKEND_SRC = path.resolve(__dirname, '../../../../')

const SEVERED_CLASSES = [
  'WebCommand',
  'ScholarCommand',
  'ExtCommand',
  'OutlineCommand',
  'DownloadCommand',
  'MemorizeCommand',
]

const RETAINED_LLM_PROVIDER_CLASSES = ['PerplexityCommand']

const IMPORT_RE = new RegExp(`^import\\s[\\s\\S]*?\\b(${SEVERED_CLASSES.join('|')})\\b`)
const RETAINED_RE = new RegExp(`\\b(${RETAINED_LLM_PROVIDER_CLASSES.join('|')})\\b`)

const isMcpServersDir = segment => segment === 'mcp-servers'
const isTestFile = name => name.endsWith('.test.js') || name.endsWith('.spec.js')
const isSourceFile = name => name.endsWith('.js')

const walkSrc = (dir, onFile) => {
  for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (!isMcpServersDir(entry.name) && entry.name !== 'node_modules') walkSrc(full, onFile)
    } else if (isSourceFile(entry.name) && !isTestFile(entry.name)) {
      onFile(full)
    }
  }
}

const collectViolations = dir => {
  const violations = []
  walkSrc(dir, full => {
    const lines = fs.readFileSync(full, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (IMPORT_RE.test(line.trim())) violations.push(`${full}:${i + 1}: ${line.trim()}`)
    })
  })
  return violations
}

const collectRetainedImports = dir => {
  const found = []
  walkSrc(dir, full => {
    if (RETAINED_RE.test(fs.readFileSync(full, 'utf8'))) found.push(full)
  })
  return found
}

describe('R1 invariant — research command class boundary', () => {
  it('no production module outside mcp-servers imports the severed research command classes', () => {
    const violations = collectViolations(BACKEND_SRC)
    if (violations.length) {
      throw new Error(
        `R1 violation: ${violations.length} production file(s) outside mcp-servers import severed research classes:\n` +
          violations.join('\n'),
      )
    }
  })
})

describe('R1 boundary — LLM provider classes retained in monolith', () => {
  it('PerplexityCommand is imported directly by the monolith — OpenAI-compatible LLM provider, no internal MCP server', () => {
    const found = collectRetainedImports(BACKEND_SRC)
    if (!found.length) {
      throw new Error(
        'PerplexityCommand is no longer imported by any monolith production file outside mcp-servers. ' +
          'If intentionally severed, remove it from RETAINED_LLM_PROVIDER_CLASSES and document the MCP migration path.',
      )
    }
  })
})
