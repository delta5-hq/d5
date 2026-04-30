import {ToolArgsParser} from './ToolArgsParser'
import {TimeoutExtractor} from './TimeoutExtractor'

export class ArgvParser {
  constructor(toolArgsParser = new ToolArgsParser(), timeoutExtractor = new TimeoutExtractor()) {
    this.toolArgsParser = toolArgsParser
    this.timeoutExtractor = timeoutExtractor
  }

  parse(argv) {
    if (argv.length < 2) {
      return {
        isValid: false,
        error: 'Missing required arguments: <server-path> <tool-name>',
      }
    }

    const [serverPath, toolName, ...rest] = argv

    const timeoutResult = this.timeoutExtractor.extract(rest)

    if (timeoutResult.error) {
      return {
        isValid: false,
        error: timeoutResult.error,
      }
    }

    const toolArguments = this.toolArgsParser.parse(timeoutResult.remainingArgs)

    return {
      isValid: true,
      serverPath,
      toolName,
      toolArguments,
      timeoutMs: timeoutResult.timeoutMs,
    }
  }
}
