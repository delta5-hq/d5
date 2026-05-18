export class UnknownQueryTypeError extends Error {
  constructor(queryType) {
    super(`Unknown queryType: ${queryType}`)
    this.name = 'UnknownQueryTypeError'
    this.queryType = queryType
  }
}
