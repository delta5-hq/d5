import assert from 'node:assert/strict'
import {execFileSync, execSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import path from 'node:path'
import {mkdtempSync, writeFileSync, mkdirSync, rmSync, copyFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {describe, test} from 'node:test'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GATE_SCRIPT = path.join(__dirname, '..', 'forbid-staged-agent-artifacts.sh')
const LOCKED_SURFACE_REGISTRY = '.github/docs/locked-surfaces-360.md'
const ALLOWED_DOCS = [
  '.github/docs/lessons-360.md',
]
const BLOCKED_PROCESS_ARTIFACTS = [
  '.github/docs/naming-decisions.md',
  '.github/docs/prr-360.md',
  '.github/docs/qa-probe-coverage-360.md',
  '.github/docs/review-entry-360.md',
  '.github/docs/workpad.md',
  'backend-v2/.github/docs/ADR-001-backend-separation.md',
  'frontend/.github/docs/design-note.md',
  'packages/plugin/.github/docs/session-log.md',
  'frontend/.interface-design/system.md',
  '.claude/session-notes.md',
]
const ALLOWED_PRODUCTION_PATHS = [
  'backend/src/feature.js',
  'backend-v2/internal/config/config.go',
  'frontend/src/feature.tsx',
  '.github/workflows/ci.yml',
  LOCKED_SURFACE_REGISTRY,
  ...ALLOWED_DOCS,
]

function withRepo(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), 'staged-agent-artifacts-'))

  try {
    execSync('git init -q', {cwd: dir})
    execSync('git config user.email t@t.t', {cwd: dir})
    execSync('git config user.name T', {cwd: dir})
    writeFile(dir, '.gitkeep', '')
    execSync('git add .gitkeep', {cwd: dir})
    execSync('git commit -q -m init', {cwd: dir})

    mkdirSync(path.join(dir, 'scripts', 'ci'), {recursive: true})
    copyFileSync(GATE_SCRIPT, path.join(dir, 'scripts', 'ci', 'forbid-staged-agent-artifacts.sh'))

    fn(dir)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

function writeFile(root, relPath, content = 'content\n') {
  const fullPath = path.join(root, relPath)
  mkdirSync(path.dirname(fullPath), {recursive: true})
  writeFileSync(fullPath, content, 'utf8')
}

function stageFile(root, relPath, content = 'content\n') {
  writeFile(root, relPath, content)
  execSync(`git add -f "${relPath}"`, {cwd: root})
}

function stageFiles(root, relPaths) {
  relPaths.forEach(relPath => stageFile(root, relPath))
}

function runGate(root) {
  try {
    execFileSync('bash', [path.join(root, 'scripts', 'ci', 'forbid-staged-agent-artifacts.sh')], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return {exitCode: 0, stderr: ''}
  } catch (err) {
    return {exitCode: err.status ?? 1, stderr: err.stderr ?? ''}
  }
}

function runGateStdin(root, paths) {
  const input = paths.join('\n') + '\n'
  try {
    execFileSync('bash', [path.join(root, 'scripts', 'ci', 'forbid-staged-agent-artifacts.sh'), '--from-stdin'], {
      cwd: root,
      encoding: 'utf8',
      input,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    return {exitCode: 0, stderr: ''}
  } catch (err) {
    return {exitCode: err.status ?? 1, stderr: err.stderr ?? ''}
  }
}

function assertClean(root) {
  const result = runGate(root)
  assert.equal(result.exitCode, 0, result.stderr)
}

function assertBlocked(root, relPath) {
  const result = runGate(root)
  assert.equal(result.exitCode, 1)
  assert.match(result.stderr, /AGENT-ARTIFACT-VIOLATION/)
  assert.match(result.stderr, new RegExp(relPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
}

describe('staged agent artifact gate', () => {
  test('empty staged set passes', () => {
    withRepo(root => {
      assertClean(root)
    })
  })

  test('production source and CI surfaces staged outside private roots pass', () => {
    withRepo(root => {
      stageFiles(root, ALLOWED_PRODUCTION_PATHS)
      assertClean(root)
    })
  })

  for (const relPath of BLOCKED_PROCESS_ARTIFACTS) {
    test(`blocks staged private/process artifact ${relPath}`, () => {
      withRepo(root => {
        stageFile(root, relPath)
        assertBlocked(root, relPath)
      })
    })
  }

  test('reports every blocked path in the same staged set', () => {
    withRepo(root => {
      stageFiles(root, ['.github/docs/prr-360.md', 'backend-v2/.github/docs/ADR.md', '.claude/session-notes.md'])

      const result = runGate(root)

      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /.github\/docs\/prr-360\.md/)
      assert.match(result.stderr, /backend-v2\/.github\/docs\/ADR\.md/)
      assert.match(result.stderr, /.claude\/session-notes\.md/)
    })
  })

  test('working-tree private artifact that is not staged is ignored', () => {
    withRepo(root => {
      writeFile(root, '.github/docs/prr-360.md')
      assertClean(root)
    })
  })
})


describe('--from-stdin mode (CI semantics: no git staging area required)', () => {
  test('empty input passes', () => {
    withRepo(root => {
      const result = runGateStdin(root, [])
      assert.equal(result.exitCode, 0, result.stderr)
    })
  })

  test('allowed production paths pass', () => {
    withRepo(root => {
      const result = runGateStdin(root, ALLOWED_PRODUCTION_PATHS)
      assert.equal(result.exitCode, 0, result.stderr)
    })
  })

  test('blocks a private/process artifact via stdin', () => {
    withRepo(root => {
      const result = runGateStdin(root, ['.github/docs/prr-360.md'])
      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /AGENT-ARTIFACT-VIOLATION/)
      assert.match(result.stderr, /.github\/docs\/prr-360\.md/)
    })
  })

  test('blocks multiple private artifacts in a single stdin list', () => {
    withRepo(root => {
      const paths = ['.github/docs/prr-360.md', '.claude/session-notes.md']
      const result = runGateStdin(root, paths)
      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /prr-360/)
      assert.match(result.stderr, /session-notes/)
    })
  })

  test('mixed allowed + blocked: blocks on blocked, allows allowed', () => {
    withRepo(root => {
      const result = runGateStdin(root, ['backend/src/feature.js', '.github/docs/workpad.md'])
      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /workpad/)
    })
  })
})


describe('path classification — boundary cases', () => {
  test('blocks any path anywhere under .github/docs/ regardless of depth (nested repos)', () => {
    withRepo(root => {
      const result = runGateStdin(root, ['a/b/c/.github/docs/design.md'])
      assert.equal(result.exitCode, 1)
      assert.match(result.stderr, /AGENT-ARTIFACT-VIOLATION/)
    })
  })

  test('does not block a .github/ path that is not inside the docs/ subdirectory', () => {
    withRepo(root => {
      const result = runGateStdin(root, ['.github/workflows/ci.yml', '.github/CODEOWNERS'])
      assert.equal(result.exitCode, 0, result.stderr)
    })
  })

  test('allows locked-surface-registry explicitly while blocking all other .github/docs/ paths', () => {
    withRepo(root => {
      const allowed = runGateStdin(root, ['.github/docs/locked-surfaces-360.md'])
      assert.equal(allowed.exitCode, 0, 'locked-surfaces-360.md must be allowed')

      const blocked = runGateStdin(root, ['.github/docs/other-doc.md'])
      assert.equal(blocked.exitCode, 1, 'any other .github/docs/ path must be blocked')
    })
  })

  test('does not block a .interface-design/ path that is not under the frontend/ prefix', () => {
    withRepo(root => {
      const result = runGateStdin(root, ['.interface-design/system.md', 'docs/.interface-design/system.md'])
      assert.equal(result.exitCode, 0, result.stderr)
    })
  })

  test('blocks .claude/ paths at the repo root but not .claude/ directories nested under other packages', () => {
    withRepo(root => {
      const rootBlocked = runGateStdin(root, ['.claude/session-notes.md'])
      assert.equal(rootBlocked.exitCode, 1)

      const nestedAllowed = runGateStdin(root, ['backend/.claude/session-notes.md'])
      assert.equal(nestedAllowed.exitCode, 0, result => result.stderr)
    })
  })
})

describe('--from-stdin mode — input edge cases', () => {
  test('blank lines between paths in stdin input are silently ignored', () => {
    withRepo(root => {
      const paths = ['', 'backend/src/feature.js', '', '.github/workflows/ci.yml', '']
      const result = runGateStdin(root, paths)
      assert.equal(result.exitCode, 0, result.stderr)
    })
  })

  test('a single blank-line-only stdin produces exit 0', () => {
    withRepo(root => {
      const result = runGateStdin(root, [''])
      assert.equal(result.exitCode, 0, result.stderr)
    })
  })
})
