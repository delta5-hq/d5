import {ToolInvoker} from '../ToolInvoker'
import path from 'path'

describe('CLI integration', () => {
  const scraperServerPath = path.resolve(__dirname, '../../scraper/server.js')

  it('invokes scraper server scrape_web_pages tool via stdio', async () => {
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
  }, 35000)

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
