import YandexService, {extractCompletionText} from './YandexService'
import {container} from '../../../services/container'

jest.mock('../../../services/container', () => {
  const svc = {completion: jest.fn(), embeddings: jest.fn()}
  return {container: {get: jest.fn(() => svc)}}
})

describe('extractCompletionText', () => {
  it('extracts text from well-formed Yandex API response', () => {
    const response = {result: {alternatives: [{message: {text: 'hello'}}]}}
    expect(extractCompletionText(response)).toBe('hello')
  })

  it('returns undefined for null response', () => {
    expect(extractCompletionText(null)).toBeUndefined()
  })

  it('returns undefined for undefined response', () => {
    expect(extractCompletionText(undefined)).toBeUndefined()
  })

  it('returns undefined when result is missing', () => {
    expect(extractCompletionText({})).toBeUndefined()
  })

  it('returns undefined when alternatives array is empty', () => {
    expect(extractCompletionText({result: {alternatives: []}})).toBeUndefined()
  })

  it('returns undefined when message is missing from first alternative', () => {
    expect(extractCompletionText({result: {alternatives: [{}]}})).toBeUndefined()
  })

  it('picks the first alternative when multiple exist', () => {
    const response = {
      result: {
        alternatives: [{message: {text: 'first'}}, {message: {text: 'second'}}],
      },
    }
    expect(extractCompletionText(response)).toBe('first')
  })

  it('returns empty string when text is an empty string', () => {
    const response = {result: {alternatives: [{message: {text: ''}}]}}
    expect(extractCompletionText(response)).toBe('')
  })
})

describe('YandexService.completions', () => {
  let mockSvc

  beforeEach(() => {
    jest.clearAllMocks()
    mockSvc = container.get('yandexService')
    mockSvc.completion.mockResolvedValue({result: {alternatives: [{message: {text: 'ok'}}]}})
  })

  it('builds correct Yandex API body shape with completionOptions wrapper', async () => {
    await YandexService.completions({
      modelUri: 'gpt://folder/yandexgpt',
      messages: [{role: 'user', text: 'hi'}],
      completionOptions: {temperature: 0.6, maxTokens: 500},
      apiKey: 'key',
      folderId: 'folder',
    })

    expect(mockSvc.completion).toHaveBeenCalledWith(
      expect.objectContaining({
        modelUri: 'gpt://folder/yandexgpt',
        messages: [{role: 'user', text: 'hi'}],
        completionOptions: {stream: false, temperature: 0.6, maxTokens: 500},
      }),
    )
  })

  it('always sets completionOptions.stream to false regardless of input', async () => {
    await YandexService.completions({
      modelUri: 'gpt://folder/yandexgpt',
      messages: [],
      completionOptions: {stream: true},
    })

    const called = mockSvc.completion.mock.calls[0][0]
    expect(called.completionOptions.stream).toBe(false)
  })

  it('accepts partial completionOptions with undefined temperature and maxTokens', async () => {
    await YandexService.completions({
      modelUri: 'gpt://folder/yandexgpt',
      messages: [],
      completionOptions: {},
    })

    const called = mockSvc.completion.mock.calls[0][0]
    expect(called.completionOptions).toEqual({stream: false, temperature: undefined, maxTokens: undefined})
  })

  it('accepts absent completionOptions and produces stream-false body', async () => {
    await YandexService.completions({
      modelUri: 'gpt://folder/yandexgpt',
      messages: [],
    })

    const called = mockSvc.completion.mock.calls[0][0]
    expect(called.completionOptions).toEqual({stream: false, temperature: undefined, maxTokens: undefined})
  })

  it('forwards apiKey and folderId to container service', async () => {
    await YandexService.completions({
      modelUri: 'gpt://folder/yandexgpt',
      messages: [],
      apiKey: 'user-api-key',
      folderId: 'user-folder',
    })

    expect(mockSvc.completion).toHaveBeenCalledWith(
      expect.objectContaining({apiKey: 'user-api-key', folderId: 'user-folder'}),
    )
  })

  it('wraps response in operation envelope with done=true', async () => {
    const result = await YandexService.completions({modelUri: 'gpt://f/m', messages: []})
    expect(result).toMatchObject({id: 'operation-id', done: true})
    expect(result.response).toBeDefined()
  })
})
