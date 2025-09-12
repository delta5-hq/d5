export const getPdfParseOptions = href => {
  const options = {
    from: 0,
  }
  const hash = new URL(href).hash
  const pageParamsMatch = hash.match(/#page=(\d+)/)

  if (pageParamsMatch && pageParamsMatch[1]) {
    // Return the extracted page number
    options.from = parseInt(pageParamsMatch[1], 10)
  }

  return options
}
