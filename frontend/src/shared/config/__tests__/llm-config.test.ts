import { describe, expect, it } from 'vitest'
import customLLMApiTypes from '@contracts/custom-llm-api-types.json'

import { CustomLLMApiType } from '../llm.config'

const customLLMApiTypeValues = Object.values(CustomLLMApiType)

describe('llm config contracts', () => {
  it('exports exactly the shared Custom LLM API type contract', () => {
    expect([...customLLMApiTypeValues].sort()).toEqual(Object.values(customLLMApiTypes).sort())
  })

  it('keeps Custom LLM API type values non-empty and unique', () => {
    customLLMApiTypeValues.forEach(apiType => expect(apiType.trim()).toBe(apiType))
    customLLMApiTypeValues.forEach(apiType => expect(apiType.length).toBeGreaterThan(0))
    expect(new Set(customLLMApiTypeValues).size).toBe(customLLMApiTypeValues.length)
  })
})
