import {getOpenaiModelSettings, getYandexModelSettings, GPT_4o_MAX_TOKENS} from './getModelSettings'
import {OPENAI_MODELS, YANDEX_MODELS, YANDEX_DEFAULT_MODEL} from '../../../../../constants'

describe('getOpenaiModelSettings', () => {
  describe('known models', () => {
    it.each(Object.entries(OPENAI_MODELS))('returns %s unchanged', (_key, modelId) => {
      expect(getOpenaiModelSettings(modelId).model).toBe(modelId)
    })

    it.each(Object.entries(OPENAI_MODELS))('returns a positive chunkSize for %s', (_key, modelId) => {
      expect(getOpenaiModelSettings(modelId).chunkSize).toBeGreaterThan(0)
    })
  })

  describe('default fallback', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['an unrecognized model name', 'completely-unknown-model-xyz'],
    ])('falls back to gpt-4o when model name is %s', (_label, input) => {
      expect(getOpenaiModelSettings(input).model).toBe(OPENAI_MODELS.GPT_4o)
    })

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['an unrecognized model name', 'completely-unknown-model-xyz'],
    ])('returns a positive chunkSize when model name is %s', (_label, input) => {
      expect(getOpenaiModelSettings(input).chunkSize).toBeGreaterThan(0)
    })

    it('default chunkSize matches the gpt-4o token limit', () => {
      expect(getOpenaiModelSettings(undefined).chunkSize).toBe(GPT_4o_MAX_TOKENS)
    })
  })
})

describe('getYandexModelSettings', () => {
  describe('known models', () => {
    it.each(Object.entries(YANDEX_MODELS))('returns %s unchanged', (_key, modelId) => {
      expect(getYandexModelSettings(modelId).model).toBe(modelId)
    })

    it.each(Object.entries(YANDEX_MODELS))('returns a positive chunkSize for %s', (_key, modelId) => {
      expect(getYandexModelSettings(modelId).chunkSize).toBeGreaterThan(0)
    })
  })

  describe('default fallback', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['an unrecognized model name', 'completely-unknown-yandex-model-xyz'],
    ])('falls back to the default Yandex model when model name is %s', (_label, input) => {
      expect(getYandexModelSettings(input).model).toBe(YANDEX_DEFAULT_MODEL)
    })

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['empty string', ''],
      ['an unrecognized model name', 'completely-unknown-yandex-model-xyz'],
    ])('returns a positive chunkSize when model name is %s', (_label, input) => {
      expect(getYandexModelSettings(input).chunkSize).toBeGreaterThan(0)
    })
  })
})
