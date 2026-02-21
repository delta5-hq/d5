const shellEscapePrompt = prompt => {
  return prompt.replace(/'/g, "'\\''")
}

const jsonEscapePrompt = prompt => {
  return prompt.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r')
}

export const interpolateTemplate = (template, prompt, {escapeMode = 'shell'} = {}) => {
  if (!template) return ''

  const escapedPrompt = escapeMode === 'json' ? jsonEscapePrompt(prompt) : shellEscapePrompt(prompt)

  return template.replace(/\{\{prompt\}\}/g, escapedPrompt)
}
