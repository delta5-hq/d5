import Store from '../../commands/utils/Store'
import {EXECUTION_NODE_STATUS} from '../../commands/utils/executionNodeStatus'
import {mergeCommodityForkOutputs} from './commodityForkMerge'

const ROOT_ID = 'root'
const rootNode = {id: ROOT_ID, parent: ROOT_ID, command: '/chat :n=3 Task', children: []}

const buildStore = nodes => new Store({userId: 'user1', nodes})
const buildRootStore = () => buildStore({[ROOT_ID]: {...rootNode}})

const promptNode = (id, title, extra = {}) => ({id, parent: ROOT_ID, title, children: [], ...extra})
const successPrompt = id => promptNode(id, `Successful answer ${id}`)
const taggedErrorPrompt = id =>
  promptNode(id, 'Error: provider failure', {executionStatus: EXECUTION_NODE_STATUS.ERROR})
const refusalPrompt = id => promptNode(id, "I'm sorry, I cannot help with that.")
const emptyPrompt = id => promptNode(id, '   ')
const childTitles = (store, parentId = ROOT_ID) =>
  (store.getNode(parentId)?.children ?? []).map(id => store.getNode(id)?.title)
const promptTitles = (store, parentId = ROOT_ID) =>
  (store.getNode(parentId)?.prompts ?? []).map(id => store.getNode(id)?.title)
const nodeTitles = store => Object.values(store._nodes).map(node => node.title)

const buildForkStore = promptNodes => {
  const prompts = promptNodes.map(node => node.id)
  return buildStore({
    [ROOT_ID]: {...rootNode, prompts, children: prompts},
    ...Object.fromEntries(promptNodes.map(node => [node.id, node])),
  })
}

const mergeScenario = forkPromptGroups => {
  const store = buildRootStore()
  const forkStores = forkPromptGroups.map(buildForkStore)
  const result = mergeCommodityForkOutputs({store, forkStores, cellId: ROOT_ID, total: forkStores.length})
  const root = store.getNode(ROOT_ID)

  return {result, rootTitle: root.title, copiedTitles: childTitles(store)}
}

const buildStoreWithExistingOutputs = ({
  promptRoots = [],
  promptDescendants = [],
  userChildren = [],
  userDescendants = [],
  promptIds = null,
}) => {
  const children = [...promptRoots.map(node => node.id), ...userChildren.map(node => node.id)]
  const prompts = promptIds ?? promptRoots.map(node => node.id)
  const nodes = {
    [ROOT_ID]: {...rootNode, children, prompts},
    ...Object.fromEntries(promptRoots.map(node => [node.id, node])),
    ...Object.fromEntries(promptDescendants.map(node => [node.id, node])),
    ...Object.fromEntries(userChildren.map(node => [node.id, node])),
    ...Object.fromEntries(userDescendants.map(node => [node.id, node])),
  }

  return buildStore(nodes)
}

describe('mergeCommodityForkOutputs', () => {
  it.each([
    {
      name: 'all forks succeed',
      forks: [[successPrompt('a')], [successPrompt('b')], [successPrompt('c')]],
      result: {successCount: 3, total: 3},
      suffix: /\[✓ 3\/3\]$/,
      copiedTitles: ['Successful answer a', 'Successful answer b', 'Successful answer c'],
    },
    {
      name: 'mixed successful, machine-error, refusal, and empty forks',
      forks: [[successPrompt('a')], [taggedErrorPrompt('b')], [refusalPrompt('c')], [emptyPrompt('d')]],
      result: {successCount: 1, total: 4},
      suffix: /\[✓ 1\/4\]$/,
      copiedTitles: ['Successful answer a'],
    },
    {
      name: 'all forks fail structurally or by execution status',
      forks: [[], [taggedErrorPrompt('b')], [refusalPrompt('c')], [emptyPrompt('d')]],
      result: {successCount: 0, total: 4},
      suffix: /\[✗ 0\/4\]$/,
      copiedTitles: [],
    },
    {
      name: 'fork success count is per fork, while successful prompt children are all copied',
      forks: [[successPrompt('a'), successPrompt('b')], [successPrompt('c')]],
      result: {successCount: 2, total: 2},
      suffix: /\[✓ 2\/2\]$/,
      copiedTitles: ['Successful answer a', 'Successful answer b', 'Successful answer c'],
    },
  ])('$name', ({forks, result, suffix, copiedTitles}) => {
    const actual = mergeScenario(forks)

    expect(actual.result).toEqual(result)
    expect(actual.rootTitle).toMatch(suffix)
    expect(actual.copiedTitles).toEqual(copiedTitles)
  })

  it('does not create orphan output when the target cell is absent from the root store', () => {
    const store = buildStore({})
    const forkStores = [buildForkStore([successPrompt('a')])]

    const result = mergeCommodityForkOutputs({store, forkStores, cellId: ROOT_ID, total: 1})

    expect(result).toEqual({successCount: 0, total: 1})
    expect(Object.values(store._nodes)).toEqual([])
  })

  it.each([
    {
      name: 'new successes replace previous prompt subtrees and become current prompt ownership',
      forkGroups: [[successPrompt('new-generated')]],
      result: {successCount: 1, total: 1},
      suffix: /\[✓ 1\/1\]$/,
      children: ['/validate Must remain', 'Successful answer new-generated'],
      prompts: ['Successful answer new-generated'],
    },
    {
      name: 'all failed forks clear previous prompt subtrees without copying failed outputs',
      forkGroups: [[taggedErrorPrompt('err')], [refusalPrompt('refusal')]],
      result: {successCount: 0, total: 2},
      suffix: /\[✗ 0\/2\]$/,
      children: ['/validate Must remain'],
      prompts: [],
    },
  ])('$name', ({forkGroups, result, suffix, children, prompts}) => {
    const generatedRoot = promptNode('old-generated', 'Old generated answer')
    const generatedChild = promptNode('old-generated-child', 'Old generated detail')
    const userChild = promptNode('user-child', '/validate Must remain')
    const store = buildStoreWithExistingOutputs({
      promptRoots: [{...generatedRoot, children: [generatedChild.id]}],
      promptDescendants: [generatedChild],
      userChildren: [userChild],
    })
    const forkStores = forkGroups.map(buildForkStore)

    const actual = mergeCommodityForkOutputs({store, forkStores, cellId: ROOT_ID, total: forkStores.length})

    expect(actual).toEqual(result)
    expect(store.getNode(ROOT_ID).title).toMatch(suffix)
    expect(store.getNode(generatedRoot.id)).toBeUndefined()
    expect(store.getNode(generatedChild.id)).toBeUndefined()
    expect(store.getNode(userChild.id)).toBe(userChild)
    expect(childTitles(store)).toEqual(children)
    expect(promptTitles(store)).toEqual(prompts)
  })

  it('repeated merges are idempotent over generated prompt ownership and never stack suffixes', () => {
    const store = buildRootStore()

    const firstResult = mergeCommodityForkOutputs({
      store,
      forkStores: [buildForkStore([successPrompt('first-a')]), buildForkStore([successPrompt('first-b')])],
      cellId: ROOT_ID,
      total: 2,
    })
    const secondResult = mergeCommodityForkOutputs({
      store,
      forkStores: [buildForkStore([successPrompt('second-a')]), buildForkStore([taggedErrorPrompt('second-b')])],
      cellId: ROOT_ID,
      total: 2,
    })

    expect(firstResult).toEqual({successCount: 2, total: 2})
    expect(secondResult).toEqual({successCount: 1, total: 2})
    expect(store.getNode(ROOT_ID).title).toMatch(/^\[✓ 1\/2\]$/)
    expect(childTitles(store)).toEqual(['Successful answer second-a'])
    expect(promptTitles(store)).toEqual(['Successful answer second-a'])
    expect(nodeTitles(store)).not.toEqual(
      expect.arrayContaining(['Successful answer first-a', 'Successful answer first-b']),
    )
  })

  it('removes every descendant of previous generated prompt roots while preserving user-authored command subtrees', () => {
    const generatedRoot = promptNode('old-generated', 'Old generated answer', {children: ['old-generated-child']})
    const generatedChild = promptNode('old-generated-child', 'Old generated detail', {
      children: ['old-generated-grandchild'],
    })
    const generatedGrandchild = promptNode('old-generated-grandchild', 'Old generated nested detail')
    const userCommand = promptNode('user-command', '/validate Must remain', {children: ['user-command-child']})
    const userCommandChild = promptNode('user-command-child', 'User-authored criterion detail', {
      parent: 'user-command',
    })
    const store = buildStoreWithExistingOutputs({
      promptRoots: [generatedRoot],
      promptDescendants: [generatedChild, generatedGrandchild],
      userChildren: [userCommand],
      userDescendants: [userCommandChild],
    })
    const forkStores = [buildForkStore([successPrompt('new-generated')])]

    mergeCommodityForkOutputs({store, forkStores, cellId: ROOT_ID, total: 1})

    expect(store.getNode(generatedRoot.id)).toBeUndefined()
    expect(store.getNode(generatedChild.id)).toBeUndefined()
    expect(store.getNode(generatedGrandchild.id)).toBeUndefined()
    expect(store.getNode(userCommand.id)).toBe(userCommand)
    expect(store.getNode(userCommandChild.id)).toBe(userCommandChild)
    expect(childTitles(store)).toEqual(['/validate Must remain', 'Successful answer new-generated'])
    expect(childTitles(store, userCommand.id)).toEqual(['User-authored criterion detail'])
    expect(promptTitles(store)).toEqual(['Successful answer new-generated'])
  })

  it('ignores missing prompt ids and preserves non-prompt legacy children because ownership is not provable', () => {
    const legacyGeneratedChild = promptNode('legacy-generated-child', 'Legacy unowned generated answer')
    const store = buildStoreWithExistingOutputs({
      userChildren: [legacyGeneratedChild],
      promptIds: ['missing-prompt-id'],
    })
    const forkStores = [buildForkStore([successPrompt('new-generated')])]

    const result = mergeCommodityForkOutputs({store, forkStores, cellId: ROOT_ID, total: 1})

    expect(result).toEqual({successCount: 1, total: 1})
    expect(childTitles(store)).toEqual(['Legacy unowned generated answer', 'Successful answer new-generated'])
    expect(promptTitles(store)).toEqual(['Successful answer new-generated'])
  })
})
