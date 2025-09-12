import fetch from 'node-fetch'
import {SCRAPE_V2_TIMEOUT_MS, SCRAPER_API_KEY, SCRAPER_API_SITES, SCRAPER_API_TIMEOUT_MS} from '../../constants'

export async function fetchWithProxySupport(url, options = {}) {
  let {timeout = SCRAPE_V2_TIMEOUT_MS} = options

  const needsProxy = SCRAPER_API_SITES.some(site => url.includes(site))
  if (needsProxy && SCRAPER_API_KEY) {
    if (SCRAPER_API_TIMEOUT_MS) {
      timeout = SCRAPER_API_TIMEOUT_MS
    }
    url = `https://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(url)}`
  }

  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  const response = await fetch(url, {
    ...options,
    timeout,
    signal: controller.signal,
  })

  clearTimeout(id)
  return response
}
