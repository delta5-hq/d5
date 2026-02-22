import {
  escapeForSingleQuotedContext,
  escapeForDoubleQuotedContext,
  escapeForUnquotedContext,
  escapeForJson,
} from './shellEscaping'

const detectContextAndEscape = (match, charBefore, charAfter, prompt) => {
  if (charBefore === '"' && charAfter === '"') {
    return charBefore + escapeForDoubleQuotedContext(prompt) + charAfter
  }

  if (charBefore === "'" && charAfter === "'") {
    return charBefore + escapeForSingleQuotedContext(prompt) + charAfter
  }

  return charBefore + escapeForUnquotedContext(prompt) + charAfter
}

const interpolateShellTemplate = (template, prompt) => {
  return template.replace(/(.?)\{\{prompt\}\}(.?)/g, (match, charBefore, charAfter) =>
    detectContextAndEscape(match, charBefore, charAfter, prompt),
  )
}

export const interpolateTemplate = (template, prompt, {escapeMode = 'shell'} = {}) => {
  if (!template) return ''

  if (escapeMode === 'json') {
    return template.replace(/\{\{prompt\}\}/g, escapeForJson(prompt))
  }

  return interpolateShellTemplate(template, prompt)
}
