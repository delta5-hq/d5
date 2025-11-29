TODO

- [x] 1. reveal any undiscovered functional issues at: sharing, public workflows, categories, sign up

   - [x] 1.1. by running `frontend/e2e` tests
   - [x] 1.2. by manual testing

- [ ] 2. Address [quality assessment](https://gitlab.solid-branch-software.com/solidbranch/xcells/xcells/-/issues/299#note_8282) which revealed critical architectural issues, especially these:

   - [x] 2.1. **Priority fix:** Lack of error response abstraction (206 unified calls, 0 inline errors, 277/277 E2E passing)
   - [ ] 2.2. ~~**Tech debt:** Tight coupling to Fiber framework **Impact:** Framework-agnostic business logic~~ Moved to #314
   - [ ] 2.3. ~~**Tech debt:** Cannot mock services for unit testing **Impact:** Enables unit tests without MongoDB~~ Moved to #315

- [ ] 3. ~~Lack of code review from concurrent request handling perspective~~ Move to #317 

- [ ] 4. ~~Add Go Hot Reload via Air~~ Moved to #316

- [x] 5. `integration` API issues at go `backend-v2` and node.js `backend`

   - [x] 5.1. Yandex/Claude/Perplexity validation fails with "API key not configured" error
   - [x] 5.2. Root cause: dev mode runs `MOCK_EXTERNAL_SERVICES=false`, ProdService requires real API keys, keys filled in by user but not passed correctly to the node.js `backend`

- [x] 6. Implement Node.js `CustomLLM` proxy controller (CORS bypass) - ref: `/home/coder/proj/xcells/xcells/backend/src/controllers/integrations/CustomLLMController.js`

   - [x] 6.1. Add `/integration/custom_llm/chat/completions` proxy endpoint
   - [x] 6.2. Add `/integration/custom_llm/embeddings` proxy endpoint
   - [x] 6.3. Update frontend custom-llm-dialog.tsx to use proxy
   - [x] 6.4. Fix `CustomLLMChatCommand` to pass apiKey to `CustomLLMChat`

Next steps would be: #308 cited below

[d5] Cut Node.js backend in favor of Go backend

## Goal

Provide long-term foundation for scalability and maintainability by ensuring separation of concerns including separation of responsibilities between Node.js backend and Go backend,

1. leaving **Node.js backend** orchestrating communications with external APIs, including AI and scraping

2. while **Go backend** will be responsible for internal business logic of user's data storage and synchronization, providing performant foundation for next generation CRDT implementation


## Task

Numbering continued from previous #299 

Settle Node.js backend at `/api/v2` side-by-side with Go backend.

- [x] 7. leave Node.js backend handling only the limited set of routes: 

   - [x] 7.1. `execute` API remounted at `/api/v2/...`
   - [x] 7.2. `scrape` API remounted at `/api/v2/...`
   - [x] 7.3. various `completion` and `embedding` API proxied for each LLM provider to the Node.js backend
   - [x] 7.4. ensuring Go backend serves the rest being default handler of `/api/v2/*`

- [x] 8. remove the rest of `/api/v1/*` routes from Node.js backend, ensuring all clients including the `frontend` and `chat-popup` from now on configured to connect `/api/v2/*` root URL as the only API available to them

   - [x] 8.1. run ci-full with frontend e2e tests, ensuring 100% passrate of `frontend/e2e`


- [ ] 9. Addressing tech debt and legacy Node.js backend term coupling of the API of Go backend v2:
   - [ ] rename `auth` endpoint into `login`
   - [ ] rename `external_auth` -> `login_jwt`
   - [ ] rename `me` -> `current`
   - [ ] Remove leftovers of node.js backend: for "WPUser" every mention and reference replaced with generic "user"
  

Next: #316, #317, then see backlog on gitlab issue board, and roadmap at Delta5