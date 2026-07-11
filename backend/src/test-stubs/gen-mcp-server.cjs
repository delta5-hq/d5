/* QA test stub — MCP stdio GENERATOR (D5 #326 pipeline).
 * Transforms a seed prompt into 2-3 structured JSON objects (proves MCP input transformation).
 * Runs inside the D5 bwrap sandbox: filesystem is read-only + /tmp is tmpfs, so proof logging
 * is sent over the network (allowNetwork:true) to the RPC log sink. Simulates work with a delay. */
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

const server = new McpServer({name: 'generator-mcp-stub', version: '1.0.0'}, {capabilities: {tools: {}}})

server.tool(
  'generate',
  'Transforms a seed prompt into a list of 2-3 structured JSON objects',
  {text: z.string().optional().describe('seed/domain for object generation')},
  async ({text}) => {
    const seed = ((text || 'item').trim() || 'item').replace(/\s+/g, '-')
    const delay = 500
    await sleep(delay)
    const suffixes = ['alpha', 'beta', 'gamma']
    const objs = suffixes.map((s, i) => ({id: i + 1, name: `${seed}-${s}`, qty: (i + 1) * 10, source: 'mcp:generate'}))
    // quote-free space-delimited object (no ';' — that is a command separator that breaks /foreach)
    const encode = o => `id=${o.id} name=${o.name} qty=${o.qty} source=${o.source}`
    const out = objs.map(encode).join('\n\n') // multi-paragraph -> one node per object
    const lines = [
      `[${stamp()}] [MCP GENERATOR] tool=generate delay=${delay}ms`,
      `    INPUT : ${JSON.stringify(text || '')}`,
    ]
    objs.forEach((o, i) => lines.push(`    OUTPUT[${i}] (object) : ${encode(o)}`))
    await postLog(lines.join('\n'))
    return {content: [{type: 'text', text: out}]}
  },
)

const transport = new StdioServerTransport()
server.connect(transport).catch(e => {
  process.stderr.write(`generator MCP failed: ${e.message}\n`)
  process.exit(1)
})
