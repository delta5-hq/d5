# MCP Servers Architecture

This directory contains Model Context Protocol (MCP) servers that expose d5 functionality to external MCP clients.

## Structure

```
mcp-servers/
├── shared/                    # Shared infrastructure
│   ├── bootstrap/
│   │   ├── EnvironmentValidator.js    # Environment variable validation
│   │   ├── DatabaseConnector.js       # MongoDB connection lifecycle
│   │   └── ServerLifecycle.js         # Startup/shutdown orchestration
│   └── context/
│       └── UserContextProvider.js     # User context and integration settings
│
├── research-rag/              # Research & RAG server
│   ├── context/
│   │   ├── CommandContextAdapter.js   # MCP args → command params
│   │   └── CommandStringBuilder.js    # Synthetic node for LLM routing
│   ├── tools/
│   │   ├── WebSearchQATool.js         # /web command delegation
│   │   ├── ScholarSearchQATool.js     # /scholar command delegation
│   │   ├── KnowledgeBaseQueryTool.js  # /ext command delegation
│   │   ├── MemorizeContentTool.js     # /memorize command delegation
│   │   └── ToolRegistry.js
│   └── server.js
│
├── scraper/                   # Web scraper server
│   ├── context/
│   │   ├── UrlExtractor.js            # URL extraction from text
│   │   └── ScrapeParamsAdapter.js     # MCP args → scrape params
│   ├── tools/
│   │   ├── ScrapeTool.js              # scrapeFiles delegation
│   │   └── ToolRegistry.js
│   └── server.js
│
└── outliner/                  # Outline generator server
    ├── context/
    │   ├── OutlineParamsAdapter.js         # MCP args → outline params
    │   └── OutlineCommandStringBuilder.js  # Synthetic node for LLM routing
    ├── tools/
    │   ├── OutlineTool.js             # OutlineCommand.createResponseOutline delegation
    │   └── ToolRegistry.js
    └── server.js
```

## Design Principles

### Separation of Concerns

Each MCP server is organized into layers:

1. **Bootstrap**: Environment validation, DB connection, lifecycle management
2. **Context**: Parameter adaptation, user context provisioning
3. **Tools**: MCP tool implementations that delegate to existing commands
4. **Registry**: Tool registration with MCP server

### Delegation Pattern

All MCP tools delegate to existing pure computation layers:

- `WebSearchQATool` → `WebCommand.createResponseWeb()`
- `ScrapeTool` → `scrapeFiles()`
- `OutlineTool` → `OutlineCommand.createResponseOutline()`

This ensures:
- No business logic duplication
- Single source of truth for computation
- MCP servers are thin protocol adapters

### Shared Infrastructure

Common bootstrap and context classes are extracted to `shared/`:

- `EnvironmentValidator`: Validates required env vars
- `DatabaseConnector`: MongoDB connection lifecycle
- `ServerLifecycle`: Startup/shutdown orchestration with signal handling
- `UserContextProvider`: User context and integration settings access

This eliminates code duplication across servers.

## Running Servers

### Research & RAG

```bash
D5_USER_ID=<user-id> babel-node --presets @babel/preset-env src/mcp-servers/research-rag/server.js
```

Tools:
- `web_search_qa`: Web search + Q&A
- `scholar_search_qa`: Academic search + Q&A
- `kb_query`: Knowledge base Q&A
- `memorize_content`: Store content in knowledge base

### Scraper

```bash
babel-node --presets @babel/preset-env src/mcp-servers/scraper/server.js
```

Tools:
- `scrape_web_pages`: Scrape text from URLs or freeform text

### Outliner

```bash
D5_USER_ID=<user-id> babel-node --presets @babel/preset-env src/mcp-servers/outliner/server.js
```

Tools:
- `generate_outline`: Generate structured outline from web/scholar/knowledge base

## Testing

All servers have comprehensive test coverage:

```bash
npm test -- src/mcp-servers/shared/__tests__
npm test -- src/mcp-servers/research-rag/__tests__
npm test -- src/mcp-servers/scraper/__tests__
npm test -- src/mcp-servers/outliner/__tests__
```

Test organization:
- `bootstrap/`: Environment validation, DB connection, lifecycle
- `context/`: Parameter adapters, command string builders
- `tools/`: Tool schema, execution, delegation

## Frontend Integration

All MCP servers have presets in `frontend/src/pages/user-settings/ui/integration/dialogs/presets/mcp-presets.ts`:

- `research-rag-mcp`: Research & RAG preset
- `scraper-mcp`: Web Scraper preset
- `outliner-mcp`: Outliner preset

Users can add integrations via the UI using these presets.
