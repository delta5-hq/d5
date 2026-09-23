import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { awaitExecutionStarted, awaitExecutionCompleted } from './execution-waits'
import { LLM_TIMEOUT, TIMEOUTS } from '../config/test-timeouts'

type Gate = 'resolves' | 'rejects'

function mockAbortButtonPage(onVisible: Gate, onHidden: Gate = 'resolves'): Page {
  return {
    getByTestId: () => ({
      waitFor: async ({ state }: { state: string }) => {
        if (state === 'visible' && onVisible === 'rejects') throw new Error('abort button did not become visible')
        if (state === 'hidden' && onHidden === 'rejects') throw new Error('abort button did not become hidden')
      },
    }),
  } as unknown as Page
}

function abortButtonPageWithErrors(visibleError: Error | null, hiddenError: Error | null): Page {
  return {
    getByTestId: () => ({
      waitFor: async ({ state }: { state: string }) => {
        if (state === 'visible' && visibleError) throw visibleError
        if (state === 'hidden' && hiddenError) throw hiddenError
      },
    }),
  } as unknown as Page
}

// ─── awaitExecutionStarted ────────────────────────────────────────────────────

const STARTED_GATE_CASES: [label: string, onVisible: Gate, shouldResolve: boolean][] = [
  ['resolves when the in-progress indicator appears',       'resolves', true],
  ['rejects when the in-progress indicator never appears',  'rejects',  false],
]

test.describe('awaitExecutionStarted — strict onset-detection gate', () => {
  for (const [label, onVisible, shouldResolve] of STARTED_GATE_CASES) {
    test(label, async () => {
      const page = mockAbortButtonPage(onVisible)
      const assertion = expect(awaitExecutionStarted(page))
      await (shouldResolve ? assertion.resolves.toBeUndefined() : assertion.rejects.toThrow())
    })
  }

  test('propagates the underlying error object without wrapping or modifying it', async () => {
    const cause = new Error('onset-indicator-timeout')
    const page = abortButtonPageWithErrors(cause, null)
    const rejection = await awaitExecutionStarted(page).catch((e: unknown) => e)
    expect(rejection).toBe(cause)
  })
})

// ─── awaitExecutionCompleted ──────────────────────────────────────────────────

const COMPLETION_GATE_CASES: [label: string, onVisible: Gate, onHidden: Gate, shouldResolve: boolean][] = [
  ['normal lifecycle: execution becomes visible then completes',   'resolves', 'resolves', true],
  ['fast-execution: completes before the visible-poll fires',      'rejects',  'resolves', true],
  ['execution starts but never finishes within LLM_TIMEOUT',      'resolves', 'rejects',  false],
  ['fast-execution: both gates miss — hidden never clears either', 'rejects',  'rejects',  false],
]

test.describe('awaitExecutionCompleted — tolerant onset, strict completion gate', () => {
  for (const [label, onVisible, onHidden, shouldResolve] of COMPLETION_GATE_CASES) {
    test(label, async () => {
      const page = mockAbortButtonPage(onVisible, onHidden)
      const assertion = expect(awaitExecutionCompleted(page))
      await (shouldResolve ? assertion.resolves.toBeUndefined() : assertion.rejects.toThrow())
    })
  }

  test('hidden-gate rejection propagates as the original error object, not a wrapped copy', async () => {
    const cause = new Error('completion-timeout')
    const page = abortButtonPageWithErrors(null, cause)
    const rejection = await awaitExecutionCompleted(page).catch((e: unknown) => e)
    expect(rejection).toBe(cause)
  })

  test('visible-gate rejection is discarded and never reaches the caller — even when hidden also rejects', async () => {
    const visibleCause = new Error('visible-gate-timeout')
    const hiddenCause = new Error('hidden-gate-timeout')
    const page = abortButtonPageWithErrors(visibleCause, hiddenCause)
    const rejection = await awaitExecutionCompleted(page).catch((e: unknown) => e)
    expect(rejection).toBe(hiddenCause)
    expect(rejection).not.toBe(visibleCause)
  })
})

// ─── timeout budget ───────────────────────────────────────────────────────────

const TIMEOUT_CONSTANTS: [name: string, value: number][] = [
  ['BACKEND_SYNC', TIMEOUTS.BACKEND_SYNC],
  ['LLM_TIMEOUT', LLM_TIMEOUT],
]

test.describe('timeout budget — gate window allocation', () => {
  for (const [name, value] of TIMEOUT_CONSTANTS) {
    test(`${name} is a positive duration`, () => {
      expect(value).toBeGreaterThan(0)
    })
  }

  test('LLM_TIMEOUT exceeds BACKEND_SYNC — completion budget outscales the detection window', () => {
    expect(LLM_TIMEOUT).toBeGreaterThan(TIMEOUTS.BACKEND_SYNC)
  })

  test('LLM_TIMEOUT is at least ten times BACKEND_SYNC — accounts for multi-fork model latency', () => {
    expect(LLM_TIMEOUT).toBeGreaterThanOrEqual(TIMEOUTS.BACKEND_SYNC * 10)
  })
})
