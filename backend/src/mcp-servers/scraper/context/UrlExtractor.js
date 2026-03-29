export class UrlExtractor {
  extractUniqueUrls(input) {
    const parsedUrls = input.match(/\bhttps?:\/\/[^\s)]+/g) || []

    const urls = new Set(
      parsedUrls
        .map(url => url.replace(/[.,!?;:]+$/, ''))
        .map(url => {
          try {
            const normalizedUrl = new URL(url)
            return normalizedUrl.href.replace(/\/$/, '')
          } catch {
            return null
          }
        })
        .filter(url => !!url),
    )

    return Array.from(urls)
  }
}
