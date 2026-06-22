import { describe, it, expect } from 'vitest'
import { computePreExecuteWarnings, getConfiguredFamilyCount } from '../judge-quality-warnings'
import type { IntegrationSettings } from '@shared/base-types'
import type { NodeData, NodeId } from '@shared/base-types'

const noSettings: IntegrationSettings = {}
const openaiOnly: IntegrationSettings = { openai: { apiKey: 'sk-test', model: 'gpt-4o' } }
const customLLMOnly: IntegrationSettings = { custom_llm: { apiRootUrl: 'https://custom.example.com', model: 'custom' } }
const yandexOnly: IntegrationSettings = { yandex: { apiKey: 'ya-key', folder_id: 'f1', model: 'yandexgpt' } }
const yandexAndCustom: IntegrationSettings = {
  yandex: { apiKey: 'ya-key', folder_id: 'f1', model: 'yandexgpt' },
  custom_llm: { apiRootUrl: 'https://custom.example.com', model: 'custom' },
}
const openaiAndYandex: IntegrationSettings = {
  openai: { apiKey: 'sk-test', model: 'gpt-4o' },
  yandex: { apiKey: 'ya-key', folder_id: 'f1', model: 'yandexgpt' },
}
const twoFamilies: IntegrationSettings = {
  openai: { apiKey: 'sk-test', model: 'gpt-4o' },
  claude: { apiKey: 'sk-ant-test', model: 'claude-3' },
}
const threeFamilies: IntegrationSettings = {
  openai: { apiKey: 'sk-test', model: 'gpt-4o' },
  claude: { apiKey: 'sk-ant-test', model: 'claude-3' },
  deepseek: { apiKey: 'sk-ds', model: 'deepseek-chat' },
}
const claudeOnly: IntegrationSettings = { claude: { apiKey: 'sk-ant-test', model: 'claude-3' } }
const deepseekOnly: IntegrationSettings = { deepseek: { apiKey: 'sk-ds', model: 'deepseek-chat' } }
const deepseekAndQwen: IntegrationSettings = {
  deepseek: { apiKey: 'sk-ds', model: 'deepseek-chat' },
  qwen: { apiKey: 'sk-q', model: 'qwen-max' },
}
const allSixFamilies: IntegrationSettings = {
  openai: { apiKey: 'sk-1', model: 'gpt-4o' },
  claude: { apiKey: 'sk-2', model: 'claude-3' },
  deepseek: { apiKey: 'sk-3', model: 'deepseek-chat' },
  qwen: { apiKey: 'sk-4', model: 'qwen-max' },
  yandex: { apiKey: 'ya-1', folder_id: 'f1', model: 'yandexgpt' },
  custom_llm: { apiRootUrl: 'https://custom.example.com', model: 'custom' },
}

function makeNodes(
  nodeId: NodeId,
  parentId: NodeId,
  siblings: Array<{ id: NodeId; command: string }> = [],
): Record<NodeId, NodeData> {
  const parentChildren = [nodeId, ...siblings.map(s => s.id)]
  const nodes: Record<NodeId, NodeData> = {
    [parentId]: { id: parentId, title: 'parent', children: parentChildren } as NodeData,
    [nodeId]: { id: nodeId, title: 'refine', command: '', parent: parentId, children: [] } as NodeData,
  }
  for (const sib of siblings) {
    nodes[sib.id] = { id: sib.id, title: sib.command, command: sib.command, parent: parentId, children: [] } as NodeData
  }
  return nodes
}

describe('getConfiguredFamilyCount', () => {
  describe('absent or empty settings', () => {
    it('returns 0 for undefined', () => expect(getConfiguredFamilyCount(undefined)).toBe(0))
    it('returns 0 for empty settings object', () => expect(getConfiguredFamilyCount(noSettings)).toBe(0))
  })

  describe('higher-tier families counted via apiKey', () => {
    it('returns 1 for a single higher-tier provider', () => expect(getConfiguredFamilyCount(openaiOnly)).toBe(1))
    it('returns 2 for two higher-tier providers', () => expect(getConfiguredFamilyCount(twoFamilies)).toBe(2))
    it('returns 3 for three higher-tier providers', () => expect(getConfiguredFamilyCount(threeFamilies)).toBe(3))
  })

  describe('lower-tier families counted via their primary credential key', () => {
    it('counts yandex via apiKey', () => expect(getConfiguredFamilyCount(yandexOnly)).toBe(1))
    it('counts custom_llm via apiRootUrl', () => expect(getConfiguredFamilyCount(customLLMOnly)).toBe(1))
    it('counts both lower-tier providers independently', () =>
      expect(getConfiguredFamilyCount(yandexAndCustom)).toBe(2))
  })

  describe('full provider set', () => {
    it('returns 6 when all six families are configured', () => expect(getConfiguredFamilyCount(allSixFamilies)).toBe(6))
  })

  describe('empty or whitespace credential values are not counted', () => {
    it('ignores openai with empty apiKey', () =>
      expect(getConfiguredFamilyCount({ openai: { apiKey: '', model: 'gpt-4o' } })).toBe(0))
    it('ignores openai with whitespace-only apiKey', () =>
      expect(getConfiguredFamilyCount({ openai: { apiKey: '  ', model: 'gpt-4o' } })).toBe(0))
    it('ignores custom_llm with empty apiRootUrl', () =>
      expect(getConfiguredFamilyCount({ custom_llm: { apiRootUrl: '', model: 'custom' } })).toBe(0))
  })
})

describe('computePreExecuteWarnings', () => {
  const nodeId = 'refine-1'
  const parentId = 'parent-1'

  describe('guard conditions — commands that produce no warnings', () => {
    it('returns empty for undefined command', () =>
      expect(computePreExecuteWarnings(undefined, nodeId, {}, openaiOnly)).toEqual([]))
    it('returns empty for an empty string command', () =>
      expect(computePreExecuteWarnings('', nodeId, {}, openaiOnly)).toEqual([]))
    it('returns empty for a non-refine/non-validate command', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/chat :n=3 query', nodeId, nodes, openaiOnly)).toEqual([])
    })
    it('returns empty for /refine with no valid :n= parameter', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/refine without-n-param', nodeId, nodes, openaiOnly)).toEqual([])
    })
  })

  describe('/refine :n=N — singleProvider warning', () => {
    it('emits when no providers are configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/refine :n=3', nodeId, nodes, noSettings)).toContainEqual({
        condition: 'singleProvider',
        severity: 'high',
      })
    })
    it('emits when exactly one family is configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/refine :n=3', nodeId, nodes, openaiOnly)).toContainEqual({
        condition: 'singleProvider',
        severity: 'high',
      })
    })
    it('does not emit when two or more families are configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, twoFamilies)
      expect(warnings.every(w => w.condition !== 'singleProvider')).toBe(true)
    })
  })

  describe('/refine :n=N — lowestTierOnly warning', () => {
    it('emits when all configured families are lower-tier and there are two or more', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/refine :n=3', nodeId, nodes, yandexAndCustom)).toContainEqual({
        condition: 'lowestTierOnly',
        severity: 'medium',
      })
    })
    it('emits singleProvider instead of lowestTierOnly when there is exactly one lower-tier family', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, yandexOnly)
      expect(warnings).toContainEqual({ condition: 'singleProvider', severity: 'high' })
      expect(warnings.every(w => w.condition !== 'lowestTierOnly')).toBe(true)
    })
    it('does not emit when at least one higher-tier family is present alongside lower-tier', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, openaiAndYandex)
      expect(warnings.every(w => w.condition !== 'lowestTierOnly')).toBe(true)
    })
    it('does not emit when only higher-tier families are configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, twoFamilies)
      expect(warnings.every(w => w.condition !== 'lowestTierOnly')).toBe(true)
    })
  })

  describe('/refine :n=N — noReasoningMode warning', () => {
    it('emits when only higher-tier non-reasoning families are configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/refine :n=3', nodeId, nodes, deepseekAndQwen)).toContainEqual({
        condition: 'noReasoningMode',
        severity: 'medium',
      })
    })

    it('emits alongside singleProvider when exactly one non-reasoning family is configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, deepseekOnly)
      expect(warnings).toContainEqual({ condition: 'singleProvider', severity: 'high' })
      expect(warnings).toContainEqual({ condition: 'noReasoningMode', severity: 'medium' })
    })

    it('emits alongside lowestTierOnly when all configured families are lowest-tier', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, yandexAndCustom)
      expect(warnings).toContainEqual({ condition: 'lowestTierOnly', severity: 'medium' })
      expect(warnings).toContainEqual({ condition: 'noReasoningMode', severity: 'medium' })
    })

    it('does not emit when OpenAI is configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'noReasoningMode')).toBe(true)
    })

    it('does not emit when Claude is configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, claudeOnly)
      expect(warnings.every(w => w.condition !== 'noReasoningMode')).toBe(true)
    })

    it('does not emit when OpenAI is present alongside lower-tier families', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, openaiAndYandex)
      expect(warnings.every(w => w.condition !== 'noReasoningMode')).toBe(true)
    })

    it('does not emit when no providers are configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, noSettings)
      expect(warnings.every(w => w.condition !== 'noReasoningMode')).toBe(true)
    })
  })

  describe('/refine :n=N — fallbackWithWeakJudge warning', () => {
    it('emits when :fallback is set and only one family is configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/refine :n=3 :fallback', nodeId, nodes, openaiOnly)).toContainEqual({
        condition: 'fallbackWithWeakJudge',
        severity: 'high',
      })
    })
    it('emits when :fallback is set and all configured families are lower-tier', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/refine :n=3 :fallback', nodeId, nodes, yandexAndCustom)).toContainEqual({
        condition: 'fallbackWithWeakJudge',
        severity: 'high',
      })
    })
    it('does not emit when :fallback is absent', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'fallbackWithWeakJudge')).toBe(true)
    })
    it('does not emit when :fallback is set and two or more strong families are configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3 :fallback', nodeId, nodes, twoFamilies)
      expect(warnings.every(w => w.condition !== 'fallbackWithWeakJudge')).toBe(true)
    })
    it('does not emit when :fallback is set and a higher-tier family is present alongside lower-tier', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/refine :n=3 :fallback', nodeId, nodes, openaiAndYandex)
      expect(warnings.every(w => w.condition !== 'fallbackWithWeakJudge')).toBe(true)
    })
  })

  describe('/refine :n=N — juryDuplicates from sibling /validate :n=Nx', () => {
    it('emits when a sibling jury size exceeds the configured family count', () => {
      const nodes = makeNodes(nodeId, parentId, [{ id: 'v1', command: '/validate :n=5 criterion' }])
      expect(computePreExecuteWarnings('/refine :n=2', nodeId, nodes, threeFamilies)).toContainEqual({
        condition: 'juryDuplicates',
        severity: 'medium',
      })
    })
    it('does not emit when sibling jury size equals the configured family count', () => {
      const nodes = makeNodes(nodeId, parentId, [{ id: 'v1', command: '/validate :n=3 criterion' }])
      const warnings = computePreExecuteWarnings('/refine :n=2', nodeId, nodes, threeFamilies)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
    it('does not emit when sibling /validate has no :n= parameter', () => {
      const nodes = makeNodes(nodeId, parentId, [{ id: 'v1', command: '/validate must mention competitors' }])
      const warnings = computePreExecuteWarnings('/refine :n=2', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
    it('emits juryDuplicates exactly once when multiple sibling validates each exceed the family count', () => {
      const nodes = makeNodes(nodeId, parentId, [
        { id: 'v1', command: '/validate :n=5 first criterion' },
        { id: 'v2', command: '/validate :n=5 second criterion' },
      ])
      const warnings = computePreExecuteWarnings('/refine :n=2', nodeId, nodes, threeFamilies)
      expect(warnings.filter(w => w.condition === 'juryDuplicates')).toHaveLength(1)
    })
    it('skips sibling check when the node has no parent field', () => {
      const nodes = { [nodeId]: { id: nodeId, command: '', children: [] } as NodeData }
      const warnings = computePreExecuteWarnings('/refine :n=2', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
    it('skips sibling check when the parent id is not present in the nodes map', () => {
      const nodes = { [nodeId]: { id: nodeId, command: '', parent: 'ghost', children: [] } as NodeData }
      const warnings = computePreExecuteWarnings('/refine :n=2', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
  })

  describe('/validate :n=Nx — juryDuplicates warning', () => {
    it('emits when the jury size exceeds the configured family count', () => {
      const nodes = makeNodes(nodeId, parentId)
      expect(computePreExecuteWarnings('/validate :n=5 criterion', nodeId, nodes, threeFamilies)).toContainEqual({
        condition: 'juryDuplicates',
        severity: 'medium',
      })
    })
    it('does not emit when the jury size equals the configured family count', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate :n=3 criterion', nodeId, nodes, threeFamilies)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
    it('does not emit when the jury size is below the configured family count', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate :n=2 criterion', nodeId, nodes, threeFamilies)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
    it('does not emit when no families are configured', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate :n=5 criterion', nodeId, nodes, noSettings)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
    it('does not emit when /validate has no :n= parameter', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate must mention competitors', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'juryDuplicates')).toBe(true)
    })
  })

  describe('/validate — judge-selection warnings do not apply', () => {
    it('does not emit singleProvider for /validate regardless of provider count', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate :n=2 criterion', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'singleProvider')).toBe(true)
    })
    it('does not emit lowestTierOnly for /validate regardless of provider tier', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate :n=2 criterion', nodeId, nodes, yandexAndCustom)
      expect(warnings.every(w => w.condition !== 'lowestTierOnly')).toBe(true)
    })
    it('does not emit fallbackWithWeakJudge for /validate (that flag is only meaningful on /refine)', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate :n=2 criterion', nodeId, nodes, openaiOnly)
      expect(warnings.every(w => w.condition !== 'fallbackWithWeakJudge')).toBe(true)
    })
    it('does not emit noReasoningMode for /validate regardless of provider configuration', () => {
      const nodes = makeNodes(nodeId, parentId)
      const warnings = computePreExecuteWarnings('/validate :n=2 criterion', nodeId, nodes, deepseekAndQwen)
      expect(warnings.every(w => w.condition !== 'noReasoningMode')).toBe(true)
    })
  })
})
