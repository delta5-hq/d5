# Guide: building cache-efficient D5 business workflows

Practical guidance for workflow designers who want their dashboards
to render fast, cost little, and reuse verified outputs across renders.

## Cache hit probability — typical D5 business workflows

```
  Workflow archetypes with realistic cell mix
  ────────────────────────────────────────────

  Archetype 1: Pure analysis dashboard
    Composition       /chat /summarize /memorize /outline only
    Cacheable share   100%
    Per-render hit    70–95%  (cell inputs rarely change)
    Examples          earnings-call summary, document Q&A, content
                      generation, KPI commentary

  Archetype 2: CRM-aware triage
    Composition       /mcp(Salesforce) /mcp(HubSpot) + /chat ranking
    Cacheable share   30–40%  (LLM ranking siblings only)
    Per-render hit    20–40%
    Examples          lead scoring, ticket triage, account review

  Archetype 3: Live-research dashboard
    Composition       /web /scholar /chat /summarize
    Cacheable share   20–40%  (the post-processing layer)
    Per-render hit    10–30%
    Examples          competitor watch, news brief, market research

  Archetype 4: Multi-system orchestration
    Composition       /mcp(Linear) /mcp(Slack) /mcp(Jira) /chat decisions
    Cacheable share   10–20%
    Per-render hit    5–15%
    Examples          incident triage, customer-360, cross-tool workflows

  Archetype 5: Pure agent
    Composition       /mcp auto with composite alias
    Cacheable share   0%
    Per-render hit    0%
    Examples          deep investigation, novel-task agent leaf
```

```
  D5's 326 integrations — cacheability split
  ──────────────────────────────────────────
  RPC / MCP integrations                          non-cacheable
    (Slack, Salesforce, HubSpot, Linear, Jira,
     Zendesk, GitHub, ClickUp, Asana, GSheets,
     Airtable, Notion, etc.)                      ~250+ entries
  Live-external commands                          non-cacheable
    (/web, /scholar, /download)                   3 commands
  Agent-mode commands                             non-cacheable
    (/mcp auto, /ext, composite alias)            3 categories
  Pure-LLM commands                               cacheable
    (/chat, /claude, /qwen, /deepseek,
     /perplexity, /yandex, /custom)               7 commands
  Post-processors over deterministic input        cacheable
    (/summarize, /memorize, /outline, /refine)    4 commands
  Static control flow                             passthrough
    (/steps, /foreach, /switch, /case, /validate) 5 commands

  → at the integration level, ~75–80% of available
    integrations produce non-cacheable cells.
```

## The dominant determinant

```
  Parent-non-cacheability rule:
    one uncached descendant → all ancestors uncached

  Implication:
    a workflow's cacheable share is NOT the average of its cells'
    cacheability — it's bounded by the position of its
    deepest uncached subtree.

  Worked example, 50-cell dashboard:
    if 1 leaf calls /mcp(Salesforce), the ancestor chain to root
       is uncached
    if that ancestor chain has 6 cells, those 6 cells lose cache
       even though they themselves are LLM-only
    if the workflow has 4 such tool leaves, expected uncached cells
       ≈ 4 × 6 = 24 (with overlap reducing this)
    cacheable cells ≈ 26 of 50  (52%)
    per-render hit rate on cacheable cells ≈ 70–90%
    overall hit rate ≈ 36–47%
```

## Re-render dynamics shift the realistic numbers up

```
  First execution               full LLM cost on every cell
                                hit rate = 0% by definition
                                (cold cache)

  Subsequent renders            cell inputs typically change for
                                ONE input parameter (the user
                                tweaks one filter, one prompt,
                                one date range)

                                → invalidation cascade is bounded
                                  to the dependents of that input

                                → cells whose inputs did not change
                                  hit cache regardless of whether
                                  their siblings include MCP cells

  Realistic re-render hit rate (for archetypes 2-4):
    ~50–70% even with significant tool-cell content,
    PROVIDED the dashboard's filter changes affect a small
    subtree and not the whole DAG
```

## Honest expected hit rates by adoption pattern

```
  Adoption pattern                                       Expected
                                                         hit rate
  ──────────────────                                     ────────
  Researcher / analyst dashboards (mostly LLM)            70–85%
  Content-production pipelines (LLM-heavy)                60–80%
  Document-grounded workflows (cached docs in /memorize)  60–75%
  Ops-tool dashboards (CRM + LLM ranking)                 30–50%
  Live-research dashboards (web/scholar gated)            20–40%
  Multi-system orchestration                              10–25%
  Pure agentic investigations                              0–5%

  Weighted by D5's likely market shape:
    no-code automation use cases lean ops-tool +
    multi-system + live-research; analyst dashboards
    are a smaller slice

  Weighted realistic average                              25–45%
```

## Cost implications

```
  LLM cost saved per render scales with hit rate.
  Cache infra overhead is fixed.
  Breakeven at hit rate ≈ 5%.
  Net positive in every realistic adoption pattern except pure
  agentic investigation.

  Sample (10k users, ~10 renders/user/day):
    no cache                       ~$150,000 / mo LLM cost
    35% hit rate (realistic avg)    ~$97,500 / mo  + ~$1,000 cache infra
    70% hit rate (best workloads)   ~$45,000 / mo  + ~$1,000 cache infra
```

## Where the cache pays off the most

```
  The cache's largest practical win is NOT "we serve cells from cache
  on first execution," it is:

  1. The dashboard re-render scenario:
       user changes one input → cascade invalidates 1–5 cells out of
       50; remaining 45 cells hit cache
       practical hit rate per render: 80–95% even when overall
       workflow cacheability is only 50%

  2. The shared template scenario:
       100 users running the same public template against the same
       cached substrate → hit rate approaches 100% from user 2 onward
       for the cacheable subset

  3. The "quick fix" scenario:
       user edits one prompt, re-runs workflow to verify → only the
       edited cell and its descendants miss; rest is hit

  In all three, raw integration mix matters less than the change
  size at the boundary.
```

## Recommended best practices for workflow designers (cacheability)

```
  Isolate uncacheable cells deep in the tree
       Place /mcp, /rpc, /web, /scholar, /ext leaves as far from
       the root as possible.  Every ancestor inherits non-cacheability;
       a leaf 3 levels deep poisons 3 cells, a leaf at root poisons
       the whole subtree.

  Branch out before fetching live data
       Split the DAG into a "fetch" branch (uncacheable) and an
       "analyse / present" branch (cacheable) joined by /summarize
       or /memorize.  The cacheable branch survives across renders.

  Cache the fetch result via /memorize
       Wrap volatile fetches in /memorize cells when staleness is
       acceptable.  Downstream cells then read the memoized snapshot
       (cacheable) instead of the live fetch (non-cacheable).

  Parameterise via @@-refs at the lowest possible level
       The cell that consumes a changing parameter is the only
       invalidation root.  Routing the parameter through the root
       cascades invalidation through everything below.

  Stable references over inline literals
       Inline literals in commands change cacheKey on any edit.
       @@-refs to a stable named context preserve cacheKey across
       cosmetic edits to source values.

  Separate composition from generation
       Use /steps + /foreach + /switch for control flow over LLM
       cells; do not embed control conditions in the prompt text.
       Control-flow cells are passthrough for cache; prompt edits
       always invalidate.

  Avoid unnecessary `:n=` increases on stable cells
       The composite cacheKey includes :n=N.  Bumping N from 2 to 3
       creates a new cache entry rather than reusing the prior one.
       Set :n= once based on cell sensitivity, leave it.

  Pin generator family explicitly when reuse matters
       Composite cacheKey includes generatorFamily.  A user-level
       provider switch invalidates the entire cache.  For
       templates intended to share via /cache/share, pin the
       generator at the cell level.

  Use /validate child for criteria, not in prompt body
       /validate criteria changes affect judge selection but not
       generation.  Embedding criteria in the prompt body re-keys
       the generation entry; embedding via /validate re-keys only
       the judge axis.

  Mark agent-leaf siblings explicitly
       /mcp auto and /ext are non-cacheable.  Place them in a clearly
       isolated branch so the rest of the tree is visually
       distinguishable as cacheable.  Aids both auditing and
       cost-preview comprehension.

  Prefer composite alias over orchestrating multiple /mcp cells
       One composite-alias agent leaf with multi-server tools is
       a single non-cacheable cell.  N separate /mcp cells joined
       by /steps are N non-cacheable cells, each poisoning its
       ancestor chain.

  Re-execute single cells from widget actions, not whole workflow
       The per-cell execute trigger (#266) lets users re-run the
       cell whose input they changed.  Whole-workflow re-execute
       defeats cache by walking from root.

  Keep public-template workflows source-of-truth-free
       Templates intended for `POST /cache/share` must contain no
       user-specific @@-refs.  Parameterise such refs out of the
       template; the cache promotes the deterministic core.
```

## Verdict

```
  Adoption-weighted average hit rate           25–45%
  Re-render hit rate (small change at root)    80–95%
  Re-render hit rate (large change at root)    20–40%
  First-execute hit rate                       0–shared%

  Cost-positive at any hit rate above ~5%, so the cache pays for
  itself in every realistic adoption pattern except pure agentic
  investigation.

  Workflow design choices have a larger effect on actual hit rate
  than the underlying integration mix.  Apply the best-practices
  section above; expect 80–95% hit rate on the dashboard re-render
  scenario where dashboards spend most of their actual time.
```
