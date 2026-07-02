import {ToolInvoker} from '../ToolInvoker'
import path from 'path'

// The scraper fetches real URLs; set NETWORK_TESTS=true in environments with outbound HTTP access.
const itWithNetwork = process.env.NETWORK_TESTS === 'true' ? it : it.skip

describe('CLI integration', () => {
  const scraperServerPath = path.resolve(__dirname, '../../scraper/server.js')

  itWithNetwork(
    'invokes scraper server scrape_web_pages tool via stdio',
    async () => {
      const invoker = new ToolInvoker(30000)

      const result = await invoker.invoke({
        serverPath: scraperServerPath,
        toolName: 'scrape_web_pages',
        toolArguments: {
          urls: ['https://example.com'],
          maxSize: '1mb',
        },
        env: process.env,
      })

      expect(result.isError).toBe(false)
      expect(result.content).toContain('File:')
      expect(result.content).toContain('example.com')
    },
    35000,
  )

  it('handles tool execution errors gracefully', async () => {
    const invoker = new ToolInvoker(5000)

    const result = await invoker.invoke({
      serverPath: scraperServerPath,
      toolName: 'scrape_web_pages',
      toolArguments: {
        urls: ['invalid-url'],
      },
      env: process.env,
    })

    expect(result.content).toBeTruthy()
  }, 10000)
})
