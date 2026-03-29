export class ExitHandler {
  printUsage() {
    console.error('Usage: babel-node cli.js <server-path> <tool-name> [--timeout=N] [--arg=value ...]')
    console.error('')
    console.error('Options:')
    console.error('  --timeout=N    Timeout in milliseconds (default: 120000)')
    console.error('')
    console.error('Examples:')
    console.error('  babel-node cli.js ./outliner/server.js generate_outline --query="AI safety" --web=m')
    console.error(
      '  babel-node cli.js ./scraper/server.js scrape_web_pages --urls=["http://example.com"] --timeout=300000',
    )
  }

  printError(message) {
    console.error(`Error: ${message}`)
  }

  printResult(content) {
    console.log(content)
  }

  exit(code) {
    process.exit(code)
  }
}
