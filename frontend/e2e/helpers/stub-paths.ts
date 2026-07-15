import path from 'node:path'

const BACKEND_TEST_STUBS = path.resolve(process.cwd(), '..', 'backend', 'src', 'test-stubs')

export const ECHO_MCP_SERVER_PATH = path.join(BACKEND_TEST_STUBS, 'echo-mcp-server.cjs')
export const ECHO_ACP_SERVER_PATH = path.join(BACKEND_TEST_STUBS, 'echo-acp-server.cjs')
