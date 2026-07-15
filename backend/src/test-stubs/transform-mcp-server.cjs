/* QA test stub — MCP stdio TRANSFORMER (D5 #326 pipeline fan-out).
 * Receives one delimited object (id=..;name=..;qty=..) and transforms it:
 * uppercases name, doubles qty, tags transformed. Proves MCP input->output transformation.
 * Sandbox-safe: logs proof over the network to the RPC /log sink. Simulates work with a delay. */
const {McpServer} = require('@modelcontextprotocol/sdk/server/mcp.js')
const {StdioServerTransport} = require('@modelcontextprotocol/sdk/server/stdio.js')
const {z} = require('zod')
const http = require('http')

const LOG_SINK_PORT = parseInt(process.env.LOG_SINK_PORT || '8901', 10)
const stamp = () => new Date().toISOString()
const sleep = ms => new Promise(r => setTimeout(r, ms))

function postLog(line) {
  return new Promise(resolve => {
    const data = Buffer.from(line + '\n')
    const req = http.request(
      {host: '127.0.0.1', port: LOG_SINK_PORT, path: '/log', method: 'POST', headers: {'Content-Length': data.length}},
      res => {
        res.on('data', () => {})
        res.on('end', resolve)
      },
    )
    req.on('error', () => resolve())
    req.write(data)
    req.end()
  })
}

function parseObj(input) {
  const obj = {}
  String(input || '')
    .trim()
    .split(/\s+/)
    .forEach(p => {
      const i = p.indexOf('=')
      if (i > 0) obj[p.slice(0, i).trim()] = p.slice(i + 1).trim()
    })
  return obj
}
const encodeObj = o =>
  Object.entries(o)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ')

const server = new McpServer({name: 'transformer-mcp-stub', version: '1.0.0'}, {capabilities: {tools: {}}})

server.tool(
  'transform',
  'Transforms one delimited object: uppercases name, doubles qty, tags transformed',
  {text: z.string().optional().describe('one delimited object to transform')},
  async ({text}) => {
    const delay = 350
    await sleep(delay)
    const obj = parseObj(text)
    const out = {
      ...obj,
      name: obj.name ? obj.name.toUpperCase() : obj.name,
      qty: obj.qty !== undefined ? Number(obj.qty) * 2 : obj.qty,
      transformed: 'true',
      by: 'mcp:transform',
    }
    const outStr = encodeObj(out)
    await postLog(
      `[${stamp()}] [MCP TRANSFORMER] tool=transform delay=${delay}ms\n    INPUT : ${
        text || ''
      }\n    OUTPUT: ${outStr}`,
    )
    return {content: [{type: 'text', text: outStr}]}
  },
)

const transport = new StdioServerTransport()
server.connect(transport).catch(e => {
  process.stderr.write(`transformer MCP failed: ${e.message}\n`)
  process.exit(1)
})
