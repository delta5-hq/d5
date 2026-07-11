import customLLMApiTypes from '../../shared-contracts/custom-llm-api-types.json'

import {CustomLLMApiType, OPENAI_COMPATIBLE_API_TYPES} from './constants'

const customLLMApiTypeValues = Object.values(CustomLLMApiType)

describe('shared constants contracts', () => {
  it('exports exactly the shared Custom LLM API type contract', () => {
    expect([...customLLMApiTypeValues].sort()).toEqual(Object.values(customLLMApiTypes).sort())
  })

  it('keeps every Custom LLM API type in the OpenAI-compatible execution family', () => {
    customLLMApiTypeValues.forEach(apiType => expect(OPENAI_COMPATIBLE_API_TYPES.has(apiType)).toBe(true))
  })

  it('keeps Custom LLM API type values non-empty and unique', () => {
    customLLMApiTypeValues.forEach(apiType => expect(apiType.trim()).toBe(apiType))
    customLLMApiTypeValues.forEach(apiType => expect(apiType.length).toBeGreaterThan(0))
    expect(new Set(customLLMApiTypeValues).size).toBe(customLLMApiTypeValues.length)
  })
})
