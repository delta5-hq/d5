import {resolveCustomLLMSettings} from './customLLMSettings'
import {CustomLLMApiType} from '../../../../../constants'

describe('resolveCustomLLMSettings', () => {
  it('requires Custom LLM API root URL', () => {
    expect(() => resolveCustomLLMSettings({})).toThrow('Custom LLM API root URL not configured')
    expect(() => resolveCustomLLMSettings({custom_llm: {apiRootUrl: '   '}})).toThrow(
      'Custom LLM API root URL not configured',
    )
  })

  it.each(['localhost:8000', 'ftp://localhost:8000', '://broken'])('rejects non-http root URL %s', apiRootUrl => {
    expect(() => resolveCustomLLMSettings({custom_llm: {apiRootUrl}})).toThrow(/Custom LLM API root URL/)
  })

  it.each([
    ['https URL', ' https://custom.example/v1/ ', 'https://custom.example/v1'],
    ['http URL', 'http://localhost:8080///', 'http://localhost:8080'],
  ])('normalizes %s and defaults apiType', (_label, apiRootUrl, expectedRootUrl) => {
    expect(
      resolveCustomLLMSettings({
        custom_llm: {
          apiRootUrl,
          apiKey: ' token ',
        },
      }),
    ).toEqual({
      apiRootUrl: expectedRootUrl,
      apiType: CustomLLMApiType.OpenAI_Compatible,
      apiKey: 'token',
    })
  })

  it('does not require apiKey when apiRootUrl is present', () => {
    expect(
      resolveCustomLLMSettings({
        custom_llm: {
          apiRootUrl: 'https://custom.example',
        },
      }),
    ).toMatchObject({
      apiRootUrl: 'https://custom.example',
      apiKey: '',
    })
  })

  it('preserves endpoint configuration fields that callers pass through', () => {
    expect(
      resolveCustomLLMSettings({
        custom_llm: {
          apiRootUrl: 'https://custom.example',
          apiType: 'openai-compatible-chain-of-thought',
          apiKey: '',
          maxTokens: 1234,
        },
      }),
    ).toEqual({
      apiRootUrl: 'https://custom.example',
      apiType: 'openai-compatible-chain-of-thought',
      apiKey: '',
      maxTokens: 1234,
    })
  })
})
