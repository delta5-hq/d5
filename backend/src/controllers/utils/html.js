import cheerio from 'cheerio'

export function stripTags(html) {
  const $ = cheerio.load(html)

  const bodyElement = $('body')[0]
  $(bodyElement).find('iframe').remove()
  $(bodyElement).find('script').remove()

  return extractTextFromNode(bodyElement)
}

export function extractTextFromNode(node, textContent = '') {
  if (!node || typeof node !== 'object') return textContent

  const nodeType = node.nodeType
  if (nodeType === 3 || nodeType === 4) {
    textContent += node.data.trim() ? node.data.trim().replace(/\s{2,}/, ' ') + ' ' : ''
  } else if (
    nodeType === 1 &&
    node.childNodes &&
    node.name !== 'script' &&
    node.name !== 'style' &&
    node.name !== 'iframe'
  ) {
    for (const childNode of node.childNodes) {
      textContent = extractTextFromNode(childNode, textContent)
    }
  }

  return textContent
}
