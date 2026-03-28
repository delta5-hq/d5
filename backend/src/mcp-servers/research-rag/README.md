# Research & RAG MCP Server

MCP server exposing d5's research and knowledge base capabilities as tools consumable by any MCP client.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  McpServer (stdio transport)                                │
│  ├─ web_search_qa         → WebCommand.createResponseWeb()  │
│  ├─ scholar_search_qa     → ScholarCommand.createResponseScholar() │
│  ├─ kb_query              → ExtCommand.createResponseExt()  │
│  └─ memorize_content      → MemorizeCommand methods         │
└─────────────────────────────────────────────────────────────┘
         │
         ├─ UserContextProvider (userId from D5_USER_ID env)
         ├─ CommandContextAdapter (MCP args → command params)
         ├─ CommandStringBuilder (params → synthetic node for determineLLMType)
         └─ DatabaseConnector (mongoose)
```

### Directory Structure

```
research-rag/
├── server.js                    Entry point, connects MCP stdio transport
├── bootstrap/
│   ├── EnvironmentValidator.js  Validates D5_USER_ID env var
│   ├── DatabaseConnector.js     Wraps mongoose connect/disconnect
│   └── ServerLifecycle.js       Orchestrates startup/shutdown/signals
├── context/
│   ├── UserContextProvider.js     Provides userId, integration settings
│   ├── CommandContextAdapter.js   Parses tool args → command params
│   └── CommandStringBuilder.js    Builds synthetic node for determineLLMType
└── tools/
    ├── ToolRegistry.js          Registers all tools with McpServer
    ├── WebSearchQATool.js       Web search + LLM Q&A
    ├── ScholarSearchQATool.js   Academic paper search + Q&A
    ├── KnowledgeBaseQueryTool.js Query user's vectorized documents
    └── MemorizeContentTool.js   Vectorize flat text (no node tree)
```

## Design Decisions

### 1. Delegate to `createResponse*()` not `run()`

Command classes have two layers:
- `run(node, prompt)` - d5-internal, depends on `Store` and node tree
- `createResponse*(params)` - pure computation, only needs userId + settings

MCP tools **delegate to the pure computation layer** to avoid Store/node dependencies and ensure bug fixes in original commands propagate automatically.

### 2. Language parameter routing

`determineLLMType(command, settings)` selects the LLM provider based on:
1. Explicit `settings.model` (highest priority)
2. User-level `settings.lang` (e.g., `"ru"` → YandexGPT)
3. Command-level `--lang=ru` flag parsed from command string

MCP tools use `CommandStringBuilder` to construct synthetic `node.command` strings (e.g., `"--lang=ru --citations"`) from MCP args, ensuring the same LLM routing logic applies. When a user calls `web_search_qa({query: "...", lang: "ru"})`, the tool builds `node.command = "--lang=ru"` and delegates to `WebCommand.createResponseWeb(node, ...)`, triggering YandexGPT selection.

### 3. MemorizeCommand adaptation

`MemorizeCommand.run()` traverses the node tree via `Store`. The MCP variant accepts flat text:

```js
// d5 internal: /memorize in a workflow (traverses children)
await MemorizeCommand.run(node)

// MCP: memorize_content tool (flat text)
await tool.execute({text: "content", context: "my-kb"})
```

### 4. User isolation via env var

Each stdio process spawns with `D5_USER_ID` env var set by `MCPClientManager` via `aliasConfig.env`. This ensures per-user MongoDB queries and encryption key access.

## Tools

### `web_search_qa`

Search the web and answer questions.

**Input:**
- `query` (required): Search query
- `lang` (optional): Output language (e.g., "ru", "en")
- `citations` (optional): Include sources
- `maxChunks` (optional): Size (xxs/xs/s/m/l/xl/xxl)

### `scholar_search_qa`

Search academic papers.

**Input:** Same as `web_search_qa` + `minYear` (optional)

### `kb_query`

Query user's knowledge base.

**Input:** Same as `web_search_qa` + `context` (optional KB name)

### `memorize_content`

Store text in knowledge base.

**Input:**
- `text` (required): Content to memorize
- `context` (optional): KB context name
- `keep` (optional): Keep existing vectors (default: true)
- `split` (optional): Delimiter to split text into chunks

## Usage

### From d5 Integration Dialog

1. Add MCP integration
2. Select "Research & RAG" preset
3. Set alias (e.g., `/research`)
4. Use: `/research search for X and summarize`

### From External MCP Client

```json
{
  "mcpServers": {
    "d5-research": {
      "command": "babel-node",
      "args": ["--presets", "@babel/preset-env", "path/to/server.js"],
      "env": {
        "D5_USER_ID": "user-id-here",
        "MONGO_URI": "mongodb://localhost:27017/delta5",
        "JWT_SECRET": "encryption-key-here"
      }
    }
  }
}
```

## Runtime Requirements

- Node.js with babel transpilation (uses `import/export`)
- MongoDB connection (reuses d5 backend pool config)
- All d5 backend dependencies (LangChain, embeddings, vector stores)
- Environment: `D5_USER_ID`, `MONGO_URI`, `JWT_SECRET`

## Testing

```bash
npm test -- src/mcp-servers/research-rag/__tests__
```

## Notes

- This is NOT a lightweight process - it loads the full backend dependency tree
- Each stdio spawn = new mongoose connection (consider connection pool limits)
- Agent mode (`toolName=auto`) recommended - let LLM choose the right tool
- Direct mode requires knowing exact tool names and argument schemas
