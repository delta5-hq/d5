import debug from 'debug'
import {withMultipleClientsTolerant} from './mcp/MCPClientManager'
import {MCPToolAdapter} from './mcp/MCPToolAdapter'
import {determineLLMType, getIntegrationSettings, getLLM} from './utils/langchain/getLLM'
import {assertToolCallingCapability, createMCPAgentExecutor} from './utils/langchain/getAgentExecutor'
import {isInternalMcpServer, buildInternalServerEnv, resolveInternalServerScript} from './mcp/internalServerEnv'
import {runWithErrorNode} from './shared/runWithErrorNode'
import {MCPFusionReport} from './mcp/MCPFusionReport'
import {MCP_FUSION_QUERY} from '../constants/mcpFusion'
// eslint-disable-next-line no-unused-vars
import Store from './utils/Store'

const log = debug('delta5:app:Command:MCPFusion')

const slugify = alias => alias.replace(/^\//, '').replace(/[^a-zA-Z0-9]/g, '_')

export class MCPFusionCommand {
  constructor(userId, workflowId, store) {
    this.userId = userId
    this.workflowId = workflowId
    this.store = store
    this.log = log.extend(userId, '/')
    if (this.workflowId) {
      this.log = this.log.extend(workflowId, '#')
    }
    this.logError = this.log.extend('ERROR*', '::')
  }

  buildTransportConfig(aliasConfig, settings) {
    const {transport, serverUrl, headers, command, args, env} = aliasConfig
    const internal = isInternalMcpServer(command, args)

    let mergedEnv = env
    let resolvedArgs = args

    if (internal && settings) {
      const extraEnv = buildInternalServerEnv(this.userId, this.workflowId, settings)
      mergedEnv = env ? {...env, ...extraEnv} : extraEnv
      if (args?.[0]) {
        resolvedArgs = [resolveInternalServerScript(args[0]), ...args.slice(1)]
      }
    }

    return {transport, serverUrl, headers, command, args: resolvedArgs, env: mergedEnv}
  }

  extractPrompt(node, originalPrompt) {
    const raw = originalPrompt ?? node?.command ?? node?.title ?? ''
    const trimmed = raw.trimStart()
    if (trimmed.startsWith(MCP_FUSION_QUERY)) {
      return trimmed.slice(MCP_FUSION_QUERY.length).trimStart()
    }
    return trimmed
  }

  async run(node, context, originalPrompt, options = {}) {
    await runWithErrorNode(this.store, node, this.logError.bind(this), async () => {
      const {signal} = options
      const prompt = this.extractPrompt(node, originalPrompt)
      const fullPrompt = context ? context + prompt : prompt

      const settings = await getIntegrationSettings(this.userId, this.workflowId, this.store)
      const llmType = determineLLMType(settings)
      const {llm} = getLLM({settings, type: llmType})

      if (!llm) {
        throw new Error('No LLM provider configured. Set an API key in Settings \u2192 Integrations to use /mcp.')
      }

      assertToolCallingCapability(llm)

      const mcpAliases = this.store._aliases?.mcp || []

      if (mcpAliases.length === 0) {
        throw new Error(
          'No MCP integrations configured. Add at least one MCP integration in Settings \u2192 Integrations to use /mcp.',
        )
      }

      const configs = mcpAliases.map(a => this.buildTransportConfig(a, settings))
      const report = new MCPFusionReport()

      const text = await withMultipleClientsTolerant(configs, async (pairs, skipped = []) => {
        skipped.forEach(({index, error}) => {
          report.markUnavailable(mcpAliases[index].alias, 'connect', error)
        })
        if (signal) {
          signal.addEventListener('abort', () => {
            pairs.forEach(({client}) => client.close().catch(() => {}))
          })
        }

        const allTools = []

        for (const {client, index} of pairs) {
          const aliasConfig = mcpAliases[index]
          const prefix = slugify(aliasConfig.alias)

          let toolDescriptors
          try {
            ;({tools: toolDescriptors} = await client.listTools())
          } catch (e) {
            report.markUnavailable(aliasConfig.alias, 'listTools', e)
            this.log('Failed to list tools for %s: %s', aliasConfig.alias, e.message)
            continue
          }

          report.markAvailable(
            aliasConfig.alias,
            toolDescriptors.map(td => td.name),
          )

          for (const td of toolDescriptors) {
            allTools.push(
              new MCPToolAdapter({
                toolDescriptor: {
                  ...td,
                  name: `${prefix}__${td.name}`,
                  description: `[${aliasConfig.alias}] ${td.description || td.name}`,
                },
                client,
                callName: td.name,
                timeoutMs: aliasConfig.timeoutMs,
                signal,
                onCall: ({status, error}) => {
                  report.recordToolCall(aliasConfig.alias, `${prefix}__${td.name}`, td.name, status, error)
                },
              }),
            )
          }
        }

        if (allTools.length === 0) {
          throw new Error('No tools found in any configured MCP integration.')
        }

        const executor = createMCPAgentExecutor(llm, allTools)
        return (await executor.invoke({input: fullPrompt}, {signal})).output
      })

      const answerText = text || '(empty MCP response)'
      const createdNode = this.store.createNode({title: answerText, parent: node.id})
      this.store._nodes[createdNode.id] = {...createdNode, mcpFusionReport: report.toJSON()}
    })
  }
}
