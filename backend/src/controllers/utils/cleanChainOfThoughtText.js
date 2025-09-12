export function cleanChainOfThoughtText(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
}
