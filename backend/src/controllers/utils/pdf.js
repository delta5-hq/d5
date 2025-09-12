import pdf from 'pdf-parse'

export const CONTENT_TYPES_APPLICATION_PDF = ['application/pdf', 'application/x-pdf']

const render_page = options => {
  let pageCount = 1
  return async pageData => {
    let render_options = {
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    }

    let result = ''
    if (!options.from || pageCount >= options.from) {
      result = await pageData.getTextContent(render_options).then(function (textContent) {
        let lastY,
          text = ''
        for (let item of textContent.items) {
          if (lastY == item.transform[5] || !lastY) {
            text += item.str
          } else {
            text += '\n' + item.str
          }
          lastY = item.transform[5]

          if (options.shouldContinue) {
            const overflowBytes = options.shouldContinue(item.str)
            if (overflowBytes) return text.slice(0, text.length - overflowBytes)
          }
        }
        return text
      })
    }
    pageCount += 1
    return result
  }
}

export const extractTextFromPdf = async (content, parseOptions, options) => {
  try {
    const pdfData = new Uint8Array(content)
    const pdfText = (await pdf(pdfData, {pagerender: render_page(parseOptions), max: options.max})).text

    return pdfText.replace(/\s{2,}|\.{2,}/g, ' ')
  } catch (e) {
    console.error('Error when try to extract text from pdf: ', e)
  }
}
