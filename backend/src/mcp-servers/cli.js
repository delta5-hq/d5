import {ArgvParser} from './cli/ArgvParser'
import {EnvironmentForwarder} from './cli/EnvironmentForwarder'
import {ToolInvoker} from './cli/ToolInvoker'
import {ExitHandler} from './cli/ExitHandler'

const main = async () => {
  const argv = process.argv.slice(2)
  const argvParser = new ArgvParser()
  const parseResult = argvParser.parse(argv)

  if (!parseResult.isValid) {
    const exitHandler = new ExitHandler()
    exitHandler.printError(parseResult.error)
    exitHandler.printUsage()
    exitHandler.exit(1)
    return
  }

  const {serverPath, toolName, toolArguments, timeoutMs} = parseResult
  const environmentForwarder = new EnvironmentForwarder()
  const env = environmentForwarder.getEnvironment()

  const toolInvoker = new ToolInvoker(timeoutMs)
  const exitHandler = new ExitHandler()

  try {
    const result = await toolInvoker.invoke({serverPath, toolName, toolArguments, env})

    exitHandler.printResult(result.content)
    exitHandler.exit(result.isError ? 1 : 0)
  } catch (error) {
    exitHandler.printError(error.message)
    exitHandler.exit(1)
  }
}

main()
