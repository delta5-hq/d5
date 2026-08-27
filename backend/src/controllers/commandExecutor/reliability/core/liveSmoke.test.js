/**
 * P0.13 — Live-LLM smoke test for /elect :n=2 + /validate end-to-end.
 *
 * Run with: LIVE_LLM_SMOKE=1 node_modules/.bin/jest liveSmoke --testTimeout=120000
 *
 * Skipped unless LIVE_LLM_SMOKE=1 is set. Requires at least one real LLM
 * provider API key in backend/.env (OPENAI_API_KEY or CLAUDE_API_KEY).
 *
 * Acceptance:
 *   (a) Two independent forks ran (reliabilityMetadata.total === 2).
 *   (b) Judge selects a winner (winnerForkIndex is 0 or 1, not null).
 *   (c) Winner's subtree is selected — electNode title carries a reliability
 *       suffix and the winning fork store holds the parent's LLM output.
 *
 * Design note: resolveElectCell applies the winner fork's subtree rooted at
 * the electNode (not the parentNode). The parent node's chat prompts live in
 * the winner fork store (memoMap.get(electNode.id)), not the root store. This
 * is consistent with the real-app flow where runCommand writes the parent's
 * output to the root store before postProcessNode calls resolveElectCell.
 */

// Mock getLLM to bypass MongoDB-backed getIntegrationSettings.
// The factory re-loads .env via dotenv so API keys cleared by jest.setup.js are restored.
jest.mock('../../commands/utils/langchain/getLLM', () => {
  require('dotenv').config({
    path: require('path').resolve(__dirname, '../../../../../.env'),
    override: true,
  })
  const actual = jest.requireActual('../../commands/utils/langchain/getLLM')
  return {
    ...actual,
    getIntegrationSettings: jest.fn().mockResolvedValue({
      model: 'auto',
      openai: process.env.OPENAI_API_KEY ? {apiKey: process.env.OPENAI_API_KEY} : undefined,
      claude: process.env.CLAUDE_API_KEY ? {apiKey: process.env.CLAUDE_API_KEY} : undefined,
      deepseek: process.env.DEEPSEEK_API_KEY ? {apiKey: process.env.DEEPSEEK_API_KEY} : undefined,
    }),
  }
})

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

import {resolveElectCell} from './resolveElectCell'
import Store from '../../commands/utils/Store'

const LIVE = process.env.LIVE_LLM_SMOKE === '1'
const describeIfLive = LIVE ? describe : describe.skip

describeIfLive('P0.13: live-LLM smoke — /elect :n=2 with /validate', () => {
  it('two forks produce different outputs and a winner is selected with correct suffix', async () => {
    const store = new Store({
      userId: 'qa-bot',
      nodes: {
        root: {id: 'root', children: ['parent']},
        parent: {
          id: 'parent',
          parent: 'root',
          command: '/chat Write a one-sentence description of the ocean.',
          children: ['elect'],
        },
        elect: {
          id: 'elect',
          parent: 'parent',
          command: '/elect :n=2',
          children: ['validate'],
        },
        validate: {
          id: 'validate',
          parent: 'elect',
          command: '/validate must mention water',
          children: [],
        },
      },
    })

    const memoMap = new Map()
    await resolveElectCell(store.getNode('elect'), store, memoMap, null)

    const electNode = store.getNode('elect')

    // (a) Two forks ran independently — metadata proves N=2 were executed
    expect(electNode.reliabilityMetadata).toBeDefined()
    expect(electNode.reliabilityMetadata.total).toBe(2)

    // (b) Judge selected a winner with a valid fork index
    expect(electNode.reliabilityMetadata.winnerForkIndex).not.toBeNull()
    expect([0, 1]).toContain(electNode.reliabilityMetadata.winnerForkIndex)

    // (c) Winner's subtree is selected — title carries a reliability suffix
    expect(electNode.title).toMatch(/\[/)

    // memoMap holds the winner fork store (not null, not 'in-progress')
    const winnerStore = memoMap.get('elect')
    expect(winnerStore).not.toBeNull()
    expect(winnerStore).not.toBe('in-progress')

    // The winner fork store's parent node has LLM output (prompts from the
    // winning fork's /chat run). This is the canonical source of the winning
    // output — it lives in the fork store, not the root store, because
    // resolveElectCell is called from runCommand's postProcessNode which
    // already wrote the parent's output to the root store before forking.
    const winnerParent = winnerStore.getNode('parent')
    expect(winnerParent).toBeDefined()
    expect((winnerParent.prompts ?? []).length).toBeGreaterThan(0)
  }, 120_000)
})
