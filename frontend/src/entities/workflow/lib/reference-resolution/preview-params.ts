import type { IndentedTextParams } from './indented-text'

export function buildPreviewParams(overrides?: IndentedTextParams): IndentedTextParams {
  return {
    useCommand: false,
    nonPromptNode: false,
    saveFirst: true,
    ignorePostProccessCommand: true,
    ...overrides,
  }
}
