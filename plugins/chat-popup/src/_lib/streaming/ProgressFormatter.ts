export interface ProgressMessage {
  type: "status" | "content"
  text: string
}

export interface ACPUpdateData {
  update?: {
    sessionUpdate?: string
    content?: {
      type?: string
      text?: string
    }
    name?: string
    title?: string
    status?: string
  }
}

export class ProgressFormatter {
  formatProgress(message: string): ProgressMessage {
    return {
      type: "status",
      text: this.humanizeLabel(message),
    }
  }

  formatUpdate(data: unknown): ProgressMessage | null {
    if (!data || typeof data !== "object") {
      return null
    }

    const acpData = data as ACPUpdateData

    if (!acpData.update?.sessionUpdate) {
      return null
    }

    switch (acpData.update.sessionUpdate) {
      case "agent_message_chunk":
        return this.formatAgentChunk(acpData)

      case "tool_call":
        return this.formatToolCall(acpData)

      case "tool_call_update":
        return null

      default:
        return null
    }
  }

  formatError(errorData: { message: string; stack?: string }): ProgressMessage {
    return {
      type: "status",
      text: `Error: ${errorData.message}`,
    }
  }

  private humanizeLabel(label: string): string {
    const startedMatch = label.match(/^Started: (.+)\.run$/)
    if (startedMatch) {
      return this.commandToHumanStart(startedMatch[1])
    }

    const completedMatch = label.match(/^Completed: (.+)\.run$/)
    if (completedMatch) {
      return this.commandToHumanComplete(completedMatch[1])
    }

    return label
      .replace(/^Started: /, "")
      .replace(/^Completed: /, "")
      .replace(/Command$/, "")
  }

  private commandToHumanStart(commandName: string): string {
    const map: Record<string, string> = {
      RPCCommand: "Running remote command...",
      ClaudeCommand: "Asking Claude...",
      ChatCommand: "Asking ChatGPT...",
      QwenCommand: "Asking Qwen...",
      DeepseekCommand: "Asking Deepseek...",
      PerplexityCommand: "Asking Perplexity...",
      YandexCommand: "Asking YandexGPT...",
      CustomLLMChatCommand: "Asking custom LLM...",
      WebCommand: "Searching web...",
      ScholarCommand: "Searching academic papers...",
      OutlineCommand: "Generating outline...",
      SummarizeCommand: "Summarizing...",
      ForeachCommand: "Processing items...",
      StepsCommand: "Executing steps...",
      SwitchCommand: "Evaluating conditions...",
      MCPCommand: "Running integration...",
      ExtCommand: "Querying knowledge base...",
      MemorizeCommand: "Storing in memory...",
      DownloadCommand: "Downloading content...",
      RefineCommand: "Refining output...",
      CompletionCommand: "Running completion...",
    }

    return map[commandName] || `Running ${commandName}...`
  }

  private commandToHumanComplete(commandName: string): string {
    const map: Record<string, string> = {
      RPCCommand: "Command completed",
      ClaudeCommand: "Claude responded",
      ChatCommand: "ChatGPT responded",
      QwenCommand: "Qwen responded",
      DeepseekCommand: "Deepseek responded",
      PerplexityCommand: "Perplexity responded",
      YandexCommand: "YandexGPT responded",
      CustomLLMChatCommand: "Custom LLM responded",
      WebCommand: "Web search completed",
      ScholarCommand: "Scholar search completed",
      OutlineCommand: "Outline generated",
      SummarizeCommand: "Summary completed",
      ForeachCommand: "Processing completed",
      StepsCommand: "Steps executed",
      SwitchCommand: "Evaluation completed",
      MCPCommand: "Integration completed",
      ExtCommand: "Query completed",
      MemorizeCommand: "Memorization completed",
      DownloadCommand: "Download completed",
      RefineCommand: "Refinement completed",
      CompletionCommand: "Completion done",
    }

    return map[commandName] || `${commandName} completed`
  }

  private formatAgentChunk(data: ACPUpdateData): ProgressMessage | null {
    const text = data.update?.content?.text

    if (!text || text.length === 0) {
      return null
    }

    return {
      type: "content",
      text,
    }
  }

  private formatToolCall(data: ACPUpdateData): ProgressMessage | null {
    const title = data.update?.title || data.update?.name

    if (!title) {
      return null
    }

    return {
      type: "status",
      text: `🔧 ${title}`,
    }
  }
}
