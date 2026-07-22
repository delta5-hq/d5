import { Macro, NodeData } from "../_interfaces"
import DeltaFiveApi from "./api"
import { StreamingExecutionCoordinator, ProgressCallback } from "./streaming"

type IExecute = Macro & {
  signal?: AbortSignal
}

interface IExecuteResponse {
  nodesChanged: NodeData[]
}

const outputRefRegex = /(^|\s)@output($|\s)/g

export class MacroExecutor {
  private api: DeltaFiveApi
  private coordinator = new StreamingExecutionCoordinator()

  constructor(api: DeltaFiveApi, public name?: string) {
    this.api = api
  }

  getMacro = async (): Promise<Macro> => {
    const cached = localStorage.getItem(`macro_${this.name}`)
    if (cached) {
      return JSON.parse(cached) as Macro
    }

    const macro = await this.api.createApiRequest<Macro>({
      method: "GET",
      route: `/macro/${this.name}/name`,
    })

    localStorage.setItem(`macro_${this.name}`, JSON.stringify(macro.data))
    return macro.data
  }

  addInputToMacro = async (input: string, macro: Macro): Promise<Macro> => {
    const childNode: NodeData = { id: "inputChild", title: input }
    const inputNode: NodeData = { id: "inputRef", title: "@input", children: [childNode.id] }

    return { ...macro, workflowNodes: { ...macro.workflowNodes, [childNode.id]: childNode, [inputNode.id]: inputNode } }
  }

  execute = async (params: IExecute, onProgress?: ProgressCallback, retry = 3): Promise<NodeData[]> => {
    const { signal, ...executeParams } = params
    let nodes: NodeData[] | undefined
    let retryCount = retry

    while (retryCount && !signal?.aborted) {
      try {
        nodes = await this.coordinator.execute(
          {
            apiVersion: this.api.apiVersion,
            authToken: this.api.authToken,
            payload: executeParams,
            executeRequest: async (payload) => {
              const response = await this.api.createApiRequest<IExecuteResponse>({
                method: "POST",
                route: "/execute",
                data: payload,
              })
              return response.data.nodesChanged
            },
          },
          onProgress,
        )
        break
      } catch (error) {
        retryCount -= 1
        if (retryCount === 0) {
          throw error
        }
      }
    }

    if (!nodes) {
      throw Error("Failed to fetch after retries")
    }

    return nodes
  }

  parseResponse = (nodes: NodeData[], macro: Macro): string => {
    let nodesToRender: NodeData[] = []
    const renderIds: Record<string, string> = {}

    const workflowNodes = Object.entries(macro.workflowNodes)

    for (let i = 0; i < workflowNodes.length; i += 1) {
      const [id, data] = workflowNodes[i]

      if (data.command?.match(outputRefRegex)) {
        const outputNodes = nodes.filter((n) => n.parent === id)
        if (outputNodes.length) {
          nodesToRender.push(
            ...outputNodes.map((n) => {
              renderIds[n.id] = n.id
              n.parent = macro.cell.id

              return n
            }),
          )
        }
      }
    }

    nodes.forEach((n) => {
      const { parent } = n
      if (parent && renderIds[parent]) {
        nodesToRender.push(n)
        renderIds[n.id] = n.id
      }
    })

    if (!nodesToRender.length) {
      nodesToRender = [...nodes]
    }

    return nodesToRender.reduce((acc, cur) => {
      if (cur.title) {
        acc += `\n${cur.title}`
      }
      return acc
    }, "")
  }

  run = async (input: string, onProgress?: ProgressCallback, macro?: Macro): Promise<string> => {
    const sourceMacro = macro || (await this.getMacro())

    const macroWithInput = await this.addInputToMacro(input, sourceMacro)

    const nodes = await this.execute(macroWithInput, onProgress)

    return this.parseResponse(nodes, sourceMacro)
  }
}