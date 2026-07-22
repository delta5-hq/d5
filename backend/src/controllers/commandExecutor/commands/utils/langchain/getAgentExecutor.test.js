import {assertToolCallingCapability, createMCPAgentExecutor} from './getAgentExecutor'
import {AgentExecutor, createToolCallingAgent} from '@langchain/classic/agents'

jest.mock('@langchain/classic/agents', () => ({
  AgentExecutor: jest.fn().mockImplementation(function (opts) {
    Object.assign(this, opts)
  }),
  createToolCallingAgent: jest.fn().mockReturnValue('mock-agent'),
}))

jest.mock('@langchain/classic/chains', () => ({}))

jest.mock('@langchain/core/prompts', () => ({
  ChatPromptTemplate: {fromMessages: jest.fn().mockReturnValue('mock-prompt')},
}))

jest.mock('./JSOutliningAgent', () => ({
  JSOutliningAgent: {fromLLMAndTools: jest.fn()},
}))

jest.mock('../../../constants/localizedPrompts/SimpleAgentConstants', () => ({}))
jest.mock('../../../constants/localizedPrompts/JSOutliningAgentContants', () => ({}))

const tools = [{name: 'scrape'}]
const capableLLM = {bindTools: jest.fn()}

describe('createMCPAgentExecutor', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('tool-calling–capable LLM', () => {
    it('returns an AgentExecutor', () => {
      expect(createMCPAgentExecutor(capableLLM, tools)).toBeInstanceOf(AgentExecutor)
    })

    it('sets maxIterations to 5', () => {
      expect(createMCPAgentExecutor(capableLLM, tools).maxIterations).toBe(5)
    })

    it('passes the tools array to AgentExecutor', () => {
      expect(createMCPAgentExecutor(capableLLM, tools).tools).toBe(tools)
    })

    it('builds the agent via createToolCallingAgent with the provided llm and tools', () => {
      createMCPAgentExecutor(capableLLM, tools)
      expect(createToolCallingAgent).toHaveBeenCalledWith(expect.objectContaining({llm: capableLLM, tools}))
    })
  })

  describe('accepts any llm without validating capability', () => {
    it('constructs executor for an incapable LLM (validation is caller responsibility)', () => {
      expect(() => createMCPAgentExecutor({}, tools)).not.toThrow()
    })
  })
})

describe('assertToolCallingCapability', () => {
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['empty object', {}],
    ['bindTools is a string', {bindTools: 'yes'}],
    ['bindTools is a number', {bindTools: 1}],
    ['bindTools is a boolean', {bindTools: true}],
    ['bindTools is null', {bindTools: null}],
    ['bindTools is a plain object', {bindTools: {}}],
  ])('throws for incapable LLM — %s', (_label, incapableLLM) => {
    expect(() => assertToolCallingCapability(incapableLLM)).toThrow(
      'Agent mode requires an LLM with tool-calling support',
    )
  })

  it('error message names the supported providers', () => {
    expect(() => assertToolCallingCapability({})).toThrow(/OpenAI.*Claude.*Qwen.*Deepseek/)
  })

  it('does not throw for an LLM with bindTools as a function', () => {
    expect(() => assertToolCallingCapability({bindTools: jest.fn()})).not.toThrow()
  })

  it('does not throw when bindTools is an arrow function', () => {
    expect(() => assertToolCallingCapability({bindTools: () => []})).not.toThrow()
  })

  it('does not throw when LLM has additional properties alongside a valid bindTools', () => {
    const llm = {bindTools: jest.fn(), model: 'gpt-4', temperature: 0.7}
    expect(() => assertToolCallingCapability(llm)).not.toThrow()
  })

  it('error is an instance of Error', () => {
    expect(() => assertToolCallingCapability({})).toThrowError(Error)
  })
})
