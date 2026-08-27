import assert from 'node:assert/strict'
import {execFileSync} from 'node:child_process'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {describe, test} from 'node:test'
import {fileURLToPath} from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GATE_SCRIPT = path.join(__dirname, '..', 'determinism-gate-backend-v2.sh')

function withGate(options, fn) {
  const {sequence = ['pass']} = options
  const dir = mkdtempSync(path.join(tmpdir(), 'determinism-gate-'))

  try {
    const seqFile   = path.join(dir, 'sequence.txt')
    const countFile = path.join(dir, 'npm-run-count.txt')
    const eventLog  = path.join(dir, 'event.log')
    const auditLog  = path.join(dir, 'audit.log')

    writeFileSync(seqFile,   sequence.join('\n') + '\n')
    writeFileSync(countFile, '0')
    writeFileSync(eventLog,  '')

    // Plain string concatenation: bash ${n} / ${result:-pass} must appear literally
    // in the script — JS template literals would interpolate those tokens.
    const fakeBin = path.join(dir, 'bin')
    mkdirSync(fakeBin, {recursive: true})
    const fakeNpm = path.join(fakeBin, 'npm')
    const fakeNpmScript = [
      '#!/usr/bin/env bash',
      'n=$(cat "' + countFile + '")',
      'n=$((n + 1))',
      'echo "$n" > "' + countFile + '"',
      'echo "T" >> "' + eventLog + '"',
      'result=$(sed -n "${n}p" "' + seqFile + '")',
      '[ "${result:-pass}" = "pass" ] || exit 1',
      '',
    ].join('\n')
    writeFileSync(fakeNpm, fakeNpmScript, {mode: 0o755})

    fn({dir, seqFile, countFile, eventLog, auditLog, fakeBin})
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
}

function runGate({dir, auditLog, fakeBin}, {runs = 3, resetCmd = ''} = {}) {
  const env = {
    PATH: fakeBin + ':' + process.env.PATH,
    E2E_DIR: path.join(dir, 'e2e-stub'),
    E2E_SERVER_URL: 'http://localhost:9999',
    E2E_API_BASE_PATH: '/api/v2',
    E2E_MONGO_URI: 'mongodb://localhost:27017/test',
    DETERMINISM_LOG: auditLog,
    ...(resetCmd ? {DETERMINISM_RESET_CMD: resetCmd} : {}),
  }

  // e2e-stub must exist so npm --prefix resolves correctly (the fake npm ignores it)
  mkdirSync(path.join(dir, 'e2e-stub'), {recursive: true})
  writeFileSync(path.join(dir, 'e2e-stub', 'package.json'), '{"scripts":{"test":"true"}}')

  try {
    const stdout = execFileSync('bash', [GATE_SCRIPT, String(runs)], {
      env, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'],
    })
    const auditContent = existsSync(auditLog) ? readFileSync(auditLog, 'utf8') : ''
    return {exitCode: 0, stdout, auditContent}
  } catch (err) {
    const auditContent = existsSync(auditLog) ? readFileSync(auditLog, 'utf8') : ''
    return {exitCode: err.status ?? 1, stdout: err.stdout ?? '', auditContent}
  }
}

describe('audit log format', () => {
  test('header records the run count', () => {
    withGate({sequence: ['pass', 'pass', 'pass']}, env => {
      const {auditContent} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      assert.match(auditContent, /determinism-gate: backend-v2 e2e — 3 consecutive runs/)
    })
  })

  test('header records server URL and e2e dir', () => {
    withGate({sequence: ['pass']}, env => {
      const {auditContent} = runGate(env, {runs: 1})
      assert.match(auditContent, /server url:/)
      assert.match(auditContent, /e2e dir:/)
    })
  })

  test('header reports no-isolation label when DETERMINISM_RESET_CMD is unset', () => {
    withGate({sequence: ['pass']}, env => {
      const {auditContent} = runGate(env, {runs: 1})
      assert.match(auditContent, /db reset:.*none/)
    })
  })

  test('header records the reset command string when DETERMINISM_RESET_CMD is set', () => {
    withGate({sequence: ['pass']}, env => {
      const {auditContent} = runGate(env, {runs: 1, resetCmd: 'echo seeded'})
      assert.match(auditContent, /db reset:.*echo seeded/)
    })
  })

  test('each run produces a timestamped entry with run index and PASS or FAIL', () => {
    withGate({sequence: ['pass', 'fail', 'pass']}, env => {
      const {auditContent} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      assert.match(auditContent, /\[\d{4}-\d{2}-\d{2}T.*\] run 1\/3: PASS/)
      assert.match(auditContent, /\[\d{4}-\d{2}-\d{2}T.*\] run 2\/3: FAIL/)
      assert.match(auditContent, /\[\d{4}-\d{2}-\d{2}T.*\] run 3\/3: PASS/)
    })
  })

  test('per-run entries carry cumulative pass and fail counts', () => {
    withGate({sequence: ['pass', 'fail', 'pass']}, env => {
      const {auditContent} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      assert.match(auditContent, /run 1\/3: PASS.*1 passed, 0 failed/)
      assert.match(auditContent, /run 2\/3: FAIL.*1 passed, 1 failed/)
      assert.match(auditContent, /run 3\/3: PASS.*2 passed, 1 failed/)
    })
  })

  test('footer records the final result summary and finished timestamp', () => {
    withGate({sequence: ['pass', 'pass']}, env => {
      const {auditContent} = runGate(env, {runs: 2, resetCmd: 'echo reset'})
      assert.match(auditContent, /result: 2\/2 passed/)
      assert.match(auditContent, /finished:/)
    })
  })

  test('BLOCKED line is appended to the audit log when any run fails', () => {
    withGate({sequence: ['pass', 'fail']}, env => {
      const {auditContent} = runGate(env, {runs: 2, resetCmd: 'echo reset'})
      assert.match(auditContent, /BLOCKED/)
    })
  })

  test('no BLOCKED line appears in the audit log when all runs pass', () => {
    withGate({sequence: ['pass', 'pass']}, env => {
      const {auditContent} = runGate(env, {runs: 2, resetCmd: 'echo reset'})
      assert.doesNotMatch(auditContent, /BLOCKED/)
    })
  })
})

describe('run count control', () => {
  test('executes exactly N runs when all pass', () => {
    withGate({sequence: ['pass', 'pass', 'pass']}, env => {
      runGate(env, {runs: 3, resetCmd: 'echo reset'})
      const count = parseInt(readFileSync(env.countFile, 'utf8').trim(), 10)
      assert.equal(count, 3)
    })
  })

  test('executes exactly N runs even when some fail — no early exit on failure', () => {
    withGate({sequence: ['fail', 'pass', 'fail']}, env => {
      runGate(env, {runs: 3, resetCmd: 'echo reset'})
      const count = parseInt(readFileSync(env.countFile, 'utf8').trim(), 10)
      assert.equal(count, 3)
    })
  })

  test('runs=1 executes exactly one test run', () => {
    withGate({sequence: ['pass']}, env => {
      runGate(env, {runs: 1})
      const count = parseInt(readFileSync(env.countFile, 'utf8').trim(), 10)
      assert.equal(count, 1)
    })
  })
})

describe('verdict logic', () => {
  test('exits 0 and emits PASS message when all runs succeed', () => {
    withGate({sequence: ['pass', 'pass', 'pass']}, env => {
      const {exitCode, stdout} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      assert.equal(exitCode, 0)
      assert.match(stdout, /determinism-gate PASS/)
    })
  })

  test('exits 1 (BLOCKED) when the first run fails', () => {
    withGate({sequence: ['fail', 'pass', 'pass']}, env => {
      const {exitCode, auditContent} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      assert.equal(exitCode, 1)
      assert.match(auditContent, /BLOCKED/)
    })
  })

  test('exits 1 (BLOCKED) when the last run fails', () => {
    withGate({sequence: ['pass', 'pass', 'fail']}, env => {
      const {exitCode} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      assert.equal(exitCode, 1)
    })
  })

  test('BLOCKED message lists every failed run index', () => {
    withGate({sequence: ['fail', 'pass', 'fail']}, env => {
      const {auditContent} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      const blockedLine = auditContent.split('\n').find(l => l.includes('BLOCKED'))
      assert.ok(blockedLine, 'BLOCKED line must be present')
      assert.ok(blockedLine.includes('1') && blockedLine.includes('3'), blockedLine)
    })
  })

  test('exits 1 (BLOCKED) and reports correct counts when all runs fail', () => {
    withGate({sequence: ['fail', 'fail', 'fail']}, env => {
      const {exitCode, auditContent} = runGate(env, {runs: 3, resetCmd: 'echo reset'})
      assert.equal(exitCode, 1)
      assert.match(auditContent, /3 of 3/)
    })
  })
})

describe('per-run DB isolation', () => {
  test('single run without DETERMINISM_RESET_CMD succeeds — no reset marker in audit log', () => {
    withGate({sequence: ['pass']}, env => {
      const {exitCode, auditContent} = runGate(env, {runs: 1})
      assert.equal(exitCode, 0)
      assert.doesNotMatch(auditContent, /reset\[/)
    })
  })

  test('multi-run without DETERMINISM_RESET_CMD is refused with exit 1 — BLOCKED in audit log', () => {
    withGate({sequence: ['pass', 'pass']}, env => {
      const {exitCode, auditContent} = runGate(env, {runs: 2})
      assert.equal(exitCode, 1)
      assert.match(auditContent, /BLOCKED.*DETERMINISM_RESET_CMD/)
    })
  })

  test('multi-run with a no-op DETERMINISM_RESET_CMD (true) is refused — a hollow reset cannot prove isolation', () => {
    withGate({sequence: ['pass', 'pass']}, env => {
      const {exitCode, auditContent} = runGate(env, {runs: 2, resetCmd: 'true'})
      assert.equal(exitCode, 1)
      assert.match(auditContent, /BLOCKED.*no-op DETERMINISM_RESET_CMD/)
    })
  })

  test('with DETERMINISM_RESET_CMD the reset is logged exactly once per run', () => {
    withGate({sequence: ['pass', 'pass', 'pass']}, env => {
      const {auditContent} = runGate(env, {runs: 3, resetCmd: 'echo seeded'})
      const resetLines = auditContent.split('\n').filter(l => l.includes('reset['))
      assert.equal(resetLines.length, 3)
    })
  })

  test('reset is invoked before each test run — event log shows alternating R then T for every run', () => {
    withGate({sequence: ['pass', 'pass', 'pass']}, env => {
      const resetCmd = 'echo R >> "' + env.eventLog + '"'
      runGate(env, {runs: 3, resetCmd})
      const events = readFileSync(env.eventLog, 'utf8').trim().split('\n')
      assert.deepEqual(events, ['R', 'T', 'R', 'T', 'R', 'T'])
    })
  })

  test('reset failure exits 2 — distinct exit code from test failure exit code 1', () => {
    withGate({sequence: ['pass', 'pass']}, env => {
      const {exitCode} = runGate(env, {runs: 2, resetCmd: 'exit 1'})
      assert.equal(exitCode, 2)
    })
  })

  test('when reset fails before the first run no test runs are executed', () => {
    withGate({sequence: ['pass', 'pass']}, env => {
      runGate(env, {runs: 2, resetCmd: 'exit 1'})
      const count = parseInt(readFileSync(env.countFile, 'utf8').trim(), 10)
      assert.equal(count, 0)
    })
  })

  test('reset failure is recorded in the audit log with a FATAL prefix', () => {
    withGate({sequence: ['pass']}, env => {
      const {auditContent} = runGate(env, {runs: 1, resetCmd: 'exit 1'})
      assert.match(auditContent, /FATAL.*reset failed/)
    })
  })
})

describe('audit log path', () => {
  test('audit log is created at the path specified by DETERMINISM_LOG after a PASS verdict', () => {
    withGate({sequence: ['pass']}, env => {
      runGate(env, {runs: 1})
      assert.ok(existsSync(env.auditLog), 'audit log file must exist after gate completes')
    })
  })

  test('audit log is created at the path specified by DETERMINISM_LOG after a BLOCKED verdict', () => {
    withGate({sequence: ['fail']}, env => {
      runGate(env, {runs: 1})
      assert.ok(existsSync(env.auditLog))
    })
  })
})
