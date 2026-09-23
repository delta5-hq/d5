/**
 * The external-dispatch fan-out refusal in resolveRefineCell is one decision — `termIsExternal` —
 * fed by two independent operands: the inline term's own `/mcp:`/`/rpc:` shape, and
 * `parentIsExternalDispatch` for the postfix form whose term is inherited from the parent scope.
 *
 * runCommandRefine.test.js pins the inline-shape operand through the post-processing seam. This
 * suite pins the parent operand and the `:n>1` boundary both operands share, so the refusal cannot
 * regress on the postfix path while only the inline path is exercised. Message wording and metadata
 * shape are owned by externalDispatchRefusal.test.js and are not re-asserted here; these tests turn
 * on the refuse/allow decision and the failure cause it records.
 */
import {resolveRefineCell, REFINE_OUTCOME} from './resolveRefineCell'
import Store from '../../commands/utils/Store'

const EXTERNAL_DISPATCH_REFUSED = 'external-dispatch-refused'

const buildStore = nodeMap => {
  const store = new Store({userId: 'u1', nodes: nodeMap})
  store._aliases = {mcp: [], rpc: []}
  return store
}

const postfixRefine = (command, children = []) => ({
  refine: {id: 'refine', parent: 'p', command, children},
})
const validateChild = {val: {id: 'val', parent: 'refine', command: '/validate x listed', children: []}}

const refineDeps = overrides => ({
  context: '',
  parentCell: null,
  parentQueryType: 'mcp',
  parentPrompt: '',
  parentIsExternalDispatch: false,
  signal: null,
  executeTerm: jest.fn(),
  postProcessTerm: jest.fn(),
  ...overrides,
})

const resolve = (store, deps) => {
  jest.spyOn(store.importer, 'createErrorNode').mockImplementation(() => {})
  return resolveRefineCell(store.getNode('refine'), store, deps)
}

afterEach(() => jest.restoreAllMocks())

describe('resolveRefineCell — external-dispatch refusal via the parent operand', () => {
  it('refuses a postfix /refine :n>1 under an external-dispatch parent, before generating', async () => {
    const store = buildStore({...postfixRefine('/refine :n=2', ['val']), ...validateChild})
    const deps = refineDeps({parentIsExternalDispatch: true})

    const outcome = await resolve(store, deps)

    expect(outcome).toBe(REFINE_OUTCOME.INVALID)
    expect(store.getNode('refine').reliabilityMetadata.failureCause).toBe(EXTERNAL_DISPATCH_REFUSED)
    expect(deps.executeTerm).not.toHaveBeenCalled()
    expect(deps.postProcessTerm).not.toHaveBeenCalled()
  })

  it('refuses the external-dispatch parent even when the cell carries no /validate child', async () => {
    const store = buildStore(postfixRefine('/refine :n=2'))
    const deps = refineDeps({parentIsExternalDispatch: true})

    const outcome = await resolve(store, deps)

    expect(outcome).toBe(REFINE_OUTCOME.INVALID)
    expect(store.getNode('refine').reliabilityMetadata.failureCause).toBe(EXTERNAL_DISPATCH_REFUSED)
  })

  it('does NOT refuse at the :n=1 boundary even under an external-dispatch parent', async () => {
    const store = buildStore(postfixRefine('/refine :n=1'))
    const deps = refineDeps({parentIsExternalDispatch: true})

    const outcome = await resolve(store, deps)

    expect(outcome).toBe(REFINE_OUTCOME.INVALID)
    expect(store.getNode('refine').reliabilityMetadata?.failureCause).not.toBe(EXTERNAL_DISPATCH_REFUSED)
    expect(deps.executeTerm).not.toHaveBeenCalled()
  })

  it('does NOT refuse a postfix /refine :n>1 when the parent is not an external dispatch', async () => {
    const store = buildStore(postfixRefine('/refine :n=2'))
    const deps = refineDeps({parentIsExternalDispatch: false})

    const outcome = await resolve(store, deps)

    expect(outcome).toBe(REFINE_OUTCOME.INVALID)
    expect(store.getNode('refine').reliabilityMetadata?.failureCause).not.toBe(EXTERNAL_DISPATCH_REFUSED)
  })
})

describe('resolveRefineCell — P0.7 single-command term admits only /validate and output post-processors', () => {
  it('refuses a disallowed #N child before generating, naming the child and /refine :n=N /steps', async () => {
    const store = buildStore({
      refine: {id: 'refine', parent: 'p', command: '/refine :n=2 /chat draft', children: ['bad']},
      bad: {id: 'bad', parent: 'refine', command: '#10 /chat sub-step', children: []},
    })
    const deps = refineDeps()

    const outcome = await resolve(store, deps)

    expect(outcome).toBe(REFINE_OUTCOME.INVALID)
    const [msg] = store.importer.createErrorNode.mock.calls[0]
    expect(msg).toContain('#10 /chat sub-step')
    expect(msg).toContain('/refine :n=N /steps')
    expect(deps.executeTerm).not.toHaveBeenCalled()
  })

  it('admits a /validate child and proceeds to generate the term', async () => {
    const store = buildStore({
      refine: {id: 'refine', parent: 'p', command: '/refine :n=2 /chat draft', children: ['val']},
      val: {id: 'val', parent: 'refine', command: '/validate at least 400 words', children: []},
    })
    const deps = refineDeps()

    await resolve(store, deps).catch(() => {})

    expect(deps.executeTerm).toHaveBeenCalled()
    const admissionRefusals = store.importer.createErrorNode.mock.calls.filter(([msg]) =>
      msg.includes('/refine :n=N /steps'),
    )
    expect(admissionRefusals).toHaveLength(0)
  })
})
