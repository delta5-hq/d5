export class ScrapeParamsAdapter {
  adaptParams(args = {}) {
    return {
      max_size: args?.maxSize ?? '5mb',
      max_pages: args?.maxPages ?? '100',
    }
  }
}
