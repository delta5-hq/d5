import {IntegrationMerger} from './IntegrationMerger'

describe('IntegrationMerger', () => {
  let merger

  beforeEach(() => {
    merger = new IntegrationMerger()
  })

  describe('merge', () => {
    describe('null/undefined handling', () => {
      it('returns null when both inputs are null', () => {
        expect(merger.merge(null, null)).toBeNull()
      })

      it('returns null when both inputs are undefined', () => {
        expect(merger.merge(undefined, undefined)).toBeNull()
      })

      it('returns workflow doc when app-wide is null', () => {
        const workflow = {userId: 'u1', workflowId: 'w1', model: 'gpt-4'}
        expect(merger.merge(null, workflow)).toBe(workflow)
      })

      it('returns app-wide doc when workflow is null', () => {
        const appWide = {userId: 'u1', workflowId: null, model: 'gpt-3.5'}
        expect(merger.merge(appWide, null)).toBe(appWide)
      })
    })

    describe('scalar field merging', () => {
      it('takes workflow userId and workflowId as identity', () => {
        const appWide = {userId: 'u1', workflowId: null, model: 'gpt-3.5', lang: 'en'}
        const workflow = {userId: 'u1', workflowId: 'w1', model: 'gpt-4', lang: 'fr'}

        const result = merger.merge(appWide, workflow)

        expect(result.userId).toBe('u1')
        expect(result.workflowId).toBe('w1')
      })

      it('workflow model overrides app-wide model when non-null', () => {
        const appWide = {userId: 'u1', workflowId: null, model: 'gpt-3.5'}
        const workflow = {userId: 'u1', workflowId: 'w1', model: 'gpt-4'}

        const result = merger.merge(appWide, workflow)

        expect(result.model).toBe('gpt-4')
      })

      it('preserves app-wide model when workflow model is null', () => {
        const appWide = {userId: 'u1', workflowId: null, model: 'gpt-3.5'}
        const workflow = {userId: 'u1', workflowId: 'w1', model: null}

        const result = merger.merge(appWide, workflow)

        expect(result.model).toBe('gpt-3.5')
      })

      it('preserves app-wide model when workflow model is undefined', () => {
        const appWide = {userId: 'u1', workflowId: null, model: 'gpt-3.5'}
        const workflow = {userId: 'u1', workflowId: 'w1'}

        const result = merger.merge(appWide, workflow)

        expect(result.model).toBe('gpt-3.5')
      })

      it('workflow lang overrides app-wide lang when non-null', () => {
        const appWide = {userId: 'u1', workflowId: null, lang: 'en'}
        const workflow = {userId: 'u1', workflowId: 'w1', lang: 'fr'}

        const result = merger.merge(appWide, workflow)

        expect(result.lang).toBe('fr')
      })
    })

    describe('LLM provider field-level overlay', () => {
      it('workflow provider overrides app-wide provider when both exist', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'app-key', model: 'gpt-3.5'},
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          openai: {apiKey: 'wf-key', model: 'gpt-4'},
        }

        const result = merger.merge(appWide, workflow)

        expect(result.openai).toEqual({apiKey: 'wf-key', model: 'gpt-4'})
      })

      it('workflow provider fields override app-wide at field level', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          claude: {apiKey: 'app-key', model: 'claude-3-opus'},
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          claude: {model: 'claude-3-sonnet'},
        }

        const result = merger.merge(appWide, workflow)

        expect(result.claude).toEqual({apiKey: 'app-key', model: 'claude-3-sonnet'})
      })

      it('null workflow provider field does NOT override app-wide', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          yandex: {apiKey: 'app-key', folder_id: 'folder1'},
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          yandex: {apiKey: null, folder_id: 'folder2'},
        }

        const result = merger.merge(appWide, workflow)

        expect(result.yandex).toEqual({apiKey: 'app-key', folder_id: 'folder2'})
      })

      it('undefined workflow provider field preserves app-wide', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          qwen: {apiKey: 'app-key'},
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          qwen: {},
        }

        const result = merger.merge(appWide, workflow)

        expect(result.qwen).toEqual({apiKey: 'app-key'})
      })

      it('workflow-only provider appears in result', () => {
        const appWide = {userId: 'u1', workflowId: null}
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          deepseek: {apiKey: 'ds-key'},
        }

        const result = merger.merge(appWide, workflow)

        expect(result.deepseek).toEqual({apiKey: 'ds-key'})
      })

      it('app-wide-only provider appears in result when workflow lacks it', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          perplexity: {apiKey: 'px-key'},
        }
        const workflow = {userId: 'u1', workflowId: 'w1'}

        const result = merger.merge(appWide, workflow)

        expect(result.perplexity).toEqual({apiKey: 'px-key'})
      })

      it('merges multiple LLM providers independently', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'app-openai'},
          claude: {apiKey: 'app-claude'},
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          claude: {apiKey: 'wf-claude'},
          deepseek: {apiKey: 'wf-deepseek'},
        }

        const result = merger.merge(appWide, workflow)

        expect(result.openai).toEqual({apiKey: 'app-openai'})
        expect(result.claude).toEqual({apiKey: 'wf-claude'})
        expect(result.deepseek).toEqual({apiKey: 'wf-deepseek'})
      })
    })

    describe('MCP/RPC array union merge', () => {
      it('returns workflow array when app-wide array is undefined', () => {
        const appWide = {userId: 'u1', workflowId: null}
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: '/qa', transport: 'stdio'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toEqual([{alias: '/qa', transport: 'stdio'}])
      })

      it('returns app-wide array when workflow array is undefined', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/agent', transport: 'stdio'}],
        }
        const workflow = {userId: 'u1', workflowId: 'w1'}

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toEqual([{alias: '/agent', transport: 'stdio'}])
      })

      it('empty workflow array clears app-wide array (intentional override)', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          rpc: [{alias: '/vm1', protocol: 'ssh'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          rpc: [],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.rpc).toEqual([])
      })

      it('workflow alias wins on collision with app-wide alias', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [
            {alias: '/qa', transport: 'stdio', command: 'app-command'},
            {alias: '/agent', transport: 'stdio'},
          ],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: '/qa', transport: 'sse', serverUrl: 'http://localhost'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toHaveLength(2)
        expect(result.mcp.find(x => x.alias === '/qa')).toEqual({
          alias: '/qa',
          transport: 'sse',
          serverUrl: 'http://localhost',
        })
        expect(result.mcp.find(x => x.alias === '/agent')).toEqual({
          alias: '/agent',
          transport: 'stdio',
        })
      })

      it('union merges non-colliding aliases', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          rpc: [{alias: '/vm1', protocol: 'ssh'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          rpc: [{alias: '/vm2', protocol: 'http'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.rpc).toHaveLength(2)
        expect(result.rpc).toContainEqual({alias: '/vm1', protocol: 'ssh'})
        expect(result.rpc).toContainEqual({alias: '/vm2', protocol: 'http'})
      })

      it('workflow items appear first in merge result', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/app1'}, {alias: '/app2'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: '/wf1'}, {alias: '/wf2'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp[0].alias).toBe('/wf1')
        expect(result.mcp[1].alias).toBe('/wf2')
        expect(result.mcp[2].alias).toBe('/app1')
        expect(result.mcp[3].alias).toBe('/app2')
      })

      it('handles items without alias gracefully', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/app'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toHaveLength(2)
      })
    })

    describe('cross-type same alias scenario', () => {
      it('merges MCP and RPC independently even with same alias', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/qa', transport: 'stdio'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          rpc: [{alias: '/qa', protocol: 'ssh'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toEqual([{alias: '/qa', transport: 'stdio'}])
        expect(result.rpc).toEqual([{alias: '/qa', protocol: 'ssh'}])
      })
    })

    describe('comprehensive merge scenario', () => {
      it('merges all field types correctly in complex case', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          model: 'gpt-3.5',
          lang: 'en',
          openai: {apiKey: 'app-openai', model: 'gpt-3.5'},
          claude: {apiKey: 'app-claude'},
          mcp: [
            {alias: '/agent', transport: 'stdio'},
            {alias: '/qa', transport: 'stdio', command: 'app-qa'},
          ],
          rpc: [{alias: '/vm1', protocol: 'ssh'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          model: 'gpt-4',
          openai: {model: 'gpt-4'},
          deepseek: {apiKey: 'wf-deepseek'},
          mcp: [{alias: '/qa', transport: 'sse', serverUrl: 'http://localhost'}],
          rpc: [{alias: '/vm2', protocol: 'http'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.userId).toBe('u1')
        expect(result.workflowId).toBe('w1')
        expect(result.model).toBe('gpt-4')
        expect(result.lang).toBe('en')
        expect(result.openai).toEqual({apiKey: 'app-openai', model: 'gpt-4'})
        expect(result.claude).toEqual({apiKey: 'app-claude'})
        expect(result.deepseek).toEqual({apiKey: 'wf-deepseek'})
        expect(result.mcp).toHaveLength(2)
        expect(result.mcp.find(x => x.alias === '/qa').transport).toBe('sse')
        expect(result.mcp.find(x => x.alias === '/agent')).toBeDefined()
        expect(result.rpc).toHaveLength(2)
        expect(result.rpc).toContainEqual({alias: '/vm1', protocol: 'ssh'})
        expect(result.rpc).toContainEqual({alias: '/vm2', protocol: 'http'})
      })
    })

    describe('edge cases: malformed array items', () => {
      it('handles null alias gracefully without collision detection', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: null, data: 'app'}, {alias: '/valid'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: null, data: 'workflow'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toHaveLength(3)
        expect(result.mcp.filter(x => x.alias === null)).toHaveLength(2)
      })

      it('handles undefined alias without collision', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          rpc: [{protocol: 'ssh'}, {alias: '/vm1'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          rpc: [{protocol: 'http'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.rpc).toHaveLength(3)
      })

      it('handles empty string alias without collision detection (treated as falsy)', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '', data: 'app'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: '', data: 'workflow'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toHaveLength(2)
      })
    })

    describe('edge cases: array boundary conditions', () => {
      it('null app-wide array treated as empty', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: null,
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: '/qa'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toEqual([{alias: '/qa'}])
      })

      it('empty array vs undefined distinguishes intentional clear', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/app1'}, {alias: '/app2'}],
          rpc: [{alias: '/vm1'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toEqual([])
        expect(result.rpc).toEqual([{alias: '/vm1'}])
      })

      it('single item arrays merge correctly', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/single-app'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: '/single-wf'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toHaveLength(2)
      })

      it('large arrays merge efficiently', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: Array.from({length: 50}, (_, i) => ({alias: `/app${i}`})),
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: Array.from({length: 50}, (_, i) => ({alias: `/wf${i}`})),
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).toHaveLength(100)
        expect(result.mcp[0].alias).toBe('/wf0')
        expect(result.mcp[99].alias).toBe('/app49')
      })

      it('collision with large arrays preserves workflow items', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          rpc: Array.from({length: 20}, (_, i) => ({alias: `/shared${i % 10}`, source: 'app'})),
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          rpc: Array.from({length: 5}, (_, i) => ({alias: `/shared${i}`, source: 'workflow'})),
        }

        const result = merger.merge(appWide, workflow)

        expect(result.rpc.filter(x => x.alias === '/shared0')).toHaveLength(1)
        expect(result.rpc.find(x => x.alias === '/shared0').source).toBe('workflow')
      })
    })

    describe('edge cases: LLM provider combinations', () => {
      it('all 8 providers present in both docs merge correctly', () => {
        const allProviders = ['openai', 'claude', 'yandex', 'qwen', 'deepseek', 'perplexity', 'custom_llm', 'google']
        const appWide = {userId: 'u1', workflowId: null}
        const workflow = {userId: 'u1', workflowId: 'w1'}

        allProviders.forEach(p => {
          appWide[p] = {apiKey: `app-${p}`}
          workflow[p] = {apiKey: `wf-${p}`}
        })

        const result = merger.merge(appWide, workflow)

        allProviders.forEach(p => {
          expect(result[p].apiKey).toBe(`wf-${p}`)
        })
      })

      it('provider with many fields overlays correctly', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          custom_llm: {
            apiKey: 'app-key',
            baseUrl: 'http://app',
            model: 'model-app',
            temperature: 0.7,
            maxTokens: 1000,
            headers: {auth: 'app'},
          },
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          custom_llm: {
            baseUrl: 'http://workflow',
            temperature: 0.9,
          },
        }

        const result = merger.merge(appWide, workflow)

        expect(result.custom_llm).toEqual({
          apiKey: 'app-key',
          baseUrl: 'http://workflow',
          model: 'model-app',
          temperature: 0.9,
          maxTokens: 1000,
          headers: {auth: 'app'},
        })
      })

      it('empty provider object {} preserves all app-wide fields', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'key', model: 'gpt-4', temperature: 0.5},
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          openai: {},
        }

        const result = merger.merge(appWide, workflow)

        expect(result.openai).toEqual({apiKey: 'key', model: 'gpt-4', temperature: 0.5})
      })
    })

    describe('edge cases: mixed null/undefined/missing', () => {
      it('handles mix of null, undefined, and missing fields across all types', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          model: 'gpt-4',
          lang: null,
          openai: {apiKey: 'key', model: null},
          claude: null,
          mcp: null,
          rpc: [{alias: '/vm'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          model: null,
          openai: {model: 'gpt-4'},
          yandex: {apiKey: 'yandex'},
          mcp: [{alias: '/qa'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.model).toBe('gpt-4')
        expect(result.lang).toBeNull()
        expect(result.openai).toEqual({apiKey: 'key', model: 'gpt-4'})
        expect(result.claude).toBeUndefined()
        expect(result.yandex).toEqual({apiKey: 'yandex'})
        expect(result.mcp).toEqual([{alias: '/qa'}])
        expect(result.rpc).toEqual([{alias: '/vm'}])
      })
    })

    describe('algorithm invariants', () => {
      it('merge result always uses workflow identity fields', () => {
        const appWide = {userId: 'user-a', workflowId: 'wrong', model: 'gpt-4'}
        const workflow = {userId: 'user-b', workflowId: 'w1', model: 'gpt-3.5'}

        const result = merger.merge(appWide, workflow)

        expect(result.userId).toBe('user-b')
        expect(result.workflowId).toBe('w1')
      })

      it('array merge always returns new array (no mutation)', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/app'}],
        }
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          mcp: [{alias: '/wf'}],
        }

        const result = merger.merge(appWide, workflow)

        expect(result.mcp).not.toBe(appWide.mcp)
        expect(result.mcp).not.toBe(workflow.mcp)
        expect(appWide.mcp).toHaveLength(1)
        expect(workflow.mcp).toHaveLength(1)
      })

      it('merge is idempotent when workflow is empty', () => {
        const appWide = {
          userId: 'u1',
          workflowId: null,
          model: 'gpt-4',
          openai: {apiKey: 'key'},
          mcp: [{alias: '/qa'}],
        }
        const workflow = {userId: 'u1', workflowId: 'w1'}

        const result1 = merger.merge(appWide, workflow)
        const result2 = merger.merge(appWide, workflow)

        expect(result1).toEqual(result2)
      })

      it('workflow-only merge equals identity', () => {
        const workflow = {
          userId: 'u1',
          workflowId: 'w1',
          model: 'gpt-4',
          openai: {apiKey: 'key'},
          mcp: [{alias: '/qa'}],
        }

        const result = merger.merge(null, workflow)

        expect(result).toBe(workflow)
      })
    })
  })
})

import {mergeIntegrations} from './IntegrationMerger'

describe('IntegrationMerger', () => {
  describe('mergeIntegrations', () => {
    describe('null/undefined docs', () => {
      it('returns null when both docs are null', () => {
        expect(mergeIntegrations(null, null)).toBeNull()
      })

      it('returns null when both docs are undefined', () => {
        expect(mergeIntegrations(undefined, undefined)).toBeNull()
      })

      it('returns workflow doc when global is null', () => {
        const workflowDoc = {userId: 'u1', workflowId: 'wf1', openai: {apiKey: 'wk1'}}
        expect(mergeIntegrations(null, workflowDoc)).toEqual(workflowDoc)
      })

      it('returns global doc when workflow is null', () => {
        const globalDoc = {userId: 'u1', workflowId: null, openai: {apiKey: 'gk1'}}
        expect(mergeIntegrations(globalDoc, null)).toEqual(globalDoc)
      })

      it('returns workflow doc when global is undefined', () => {
        const workflowDoc = {userId: 'u1', workflowId: 'wf1', openai: {apiKey: 'wk1'}}
        expect(mergeIntegrations(undefined, workflowDoc)).toEqual(workflowDoc)
      })

      it('returns global doc when workflow is undefined', () => {
        const globalDoc = {userId: 'u1', workflowId: null, openai: {apiKey: 'gk1'}}
        expect(mergeIntegrations(globalDoc, undefined)).toEqual(globalDoc)
      })
    })

    describe('both docs exist - no overlap', () => {
      it('merges non-overlapping scalar fields', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'gk1'},
          lang: 'en',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          claude: {apiKey: 'wk1'},
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result).toEqual({
          userId: 'u1',
          workflowId: 'wf1',
          openai: {apiKey: 'gk1'},
          claude: {apiKey: 'wk1'},
          lang: 'en',
        })
      })

      it('merges non-overlapping array fields', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/global1'}],
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          mcp: [{alias: '/wf1'}],
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.mcp).toEqual([{alias: '/global1'}, {alias: '/wf1'}])
      })
    })

    describe('both docs exist - scalar field override', () => {
      it('workflow value overrides global for scalar fields', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'gk1', model: 'gpt-4'},
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          openai: {apiKey: 'wk1', model: 'gpt-3.5'},
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.openai).toEqual({apiKey: 'wk1', model: 'gpt-3.5'})
      })

      it('empty object in workflow overrides global', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'gk1'},
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          openai: {},
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.openai).toEqual({})
      })

      it('null in workflow does not override global', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'gk1'},
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          openai: null,
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.openai).toEqual({apiKey: 'gk1'})
      })

      it('undefined in workflow does not override global', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          openai: {apiKey: 'gk1'},
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.openai).toEqual({apiKey: 'gk1'})
      })
    })

    describe('both docs exist - array concat and dedup', () => {
      it('concatenates arrays without collision', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          mcp: [{alias: '/g1'}, {alias: '/g2'}],
          rpc: [{alias: '/rpc1'}],
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          mcp: [{alias: '/w1'}],
          rpc: [{alias: '/rpc2'}],
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.mcp).toEqual([{alias: '/g1'}, {alias: '/g2'}, {alias: '/w1'}])
        expect(result.rpc).toEqual([{alias: '/rpc1'}, {alias: '/rpc2'}])
      })

      it('workflow entry wins on alias collision', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          mcp: [
            {alias: '/code', config: 'global', order: 1},
            {alias: '/qa', config: 'global', order: 2},
          ],
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          mcp: [{alias: '/code', config: 'workflow', order: 99}],
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.mcp).toEqual([
          {alias: '/code', config: 'workflow', order: 99},
          {alias: '/qa', config: 'global', order: 2},
        ])
      })

      it('handles empty arrays', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          mcp: [],
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          mcp: [{alias: '/w1'}],
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.mcp).toEqual([{alias: '/w1'}])
      })

      it('handles undefined arrays as empty', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          mcp: [{alias: '/w1'}],
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.mcp).toEqual([{alias: '/w1'}])
      })

      it('handles null arrays as empty', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          mcp: null,
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          mcp: [{alias: '/w1'}],
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.mcp).toEqual([{alias: '/w1'}])
      })
    })

    describe('sentinel field handling', () => {
      it('uses global lang when workflow has sentinel "none"', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          lang: 'en',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          lang: 'none',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.lang).toBe('en')
      })

      it('uses workflow lang when not sentinel', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          lang: 'en',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          lang: 'es',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.lang).toBe('es')
      })

      it('uses global model when workflow has sentinel "auto"', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          model: 'gpt-4',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          model: 'auto',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.model).toBe('gpt-4')
      })

      it('uses workflow model when not sentinel', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          model: 'gpt-4',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          model: 'claude-3',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.model).toBe('claude-3')
      })

      it('handles sentinel in global, value in workflow', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          lang: 'none',
          model: 'auto',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          lang: 'fr',
          model: 'gpt-3.5',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.lang).toBe('fr')
        expect(result.model).toBe('gpt-3.5')
      })
    })

    describe('workflow-scoped integration with sparse fields', () => {
      it('merges workflow openai with global claude and mcp', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          claude: {apiKey: 'gk-claude'},
          mcp: [{alias: '/global-mcp'}],
          lang: 'en',
          model: 'gpt-4',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          openai: {apiKey: 'wk-openai'},
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result).toEqual({
          userId: 'u1',
          workflowId: 'wf1',
          openai: {apiKey: 'wk-openai'},
          claude: {apiKey: 'gk-claude'},
          lang: 'en',
          model: 'gpt-4',
          mcp: [{alias: '/global-mcp'}],
        })
      })
    })

    describe('metadata fields', () => {
      it('uses workflow userId and workflowId', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result.userId).toBe('u1')
        expect(result.workflowId).toBe('wf1')
      })

      it('does not include _id in merged result', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          _id: 'global-id',
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          _id: 'workflow-id',
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result._id).toBeUndefined()
      })
    })

    describe('complex real-world scenario', () => {
      it('merges all field types correctly', () => {
        const globalDoc = {
          userId: 'u1',
          workflowId: null,
          _id: 'global-id',
          openai: {apiKey: 'gk-openai'},
          claude: {apiKey: 'gk-claude'},
          yandex: {apiKey: 'gk-yandex'},
          lang: 'en',
          model: 'gpt-4',
          mcp: [
            {alias: '/code', transport: 'stdio'},
            {alias: '/research', transport: 'sse'},
          ],
          rpc: [{alias: '/vm1', protocol: 'ssh'}],
        }
        const workflowDoc = {
          userId: 'u1',
          workflowId: 'wf1',
          _id: 'workflow-id',
          openai: {apiKey: 'wk-openai-override'},
          deepseek: {apiKey: 'wk-deepseek'},
          lang: 'es',
          model: 'auto',
          mcp: [{alias: '/code', transport: 'sse'}],
          rpc: [{alias: '/vm2', protocol: 'http'}],
        }

        const result = mergeIntegrations(globalDoc, workflowDoc)

        expect(result).toEqual({
          userId: 'u1',
          workflowId: 'wf1',
          openai: {apiKey: 'wk-openai-override'},
          claude: {apiKey: 'gk-claude'},
          yandex: {apiKey: 'gk-yandex'},
          deepseek: {apiKey: 'wk-deepseek'},
          lang: 'es',
          model: 'gpt-4',
          mcp: [
            {alias: '/code', transport: 'sse'},
            {alias: '/research', transport: 'sse'},
          ],
          rpc: [
            {alias: '/vm1', protocol: 'ssh'},
            {alias: '/vm2', protocol: 'http'},
          ],
        })
        expect(result._id).toBeUndefined()
      })
    })
  })
})
