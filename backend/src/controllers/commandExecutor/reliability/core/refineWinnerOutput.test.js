import Store from '../../commands/utils/Store'
import {copyParentPromptOutputToRefine} from './refineWinnerOutput'

const buildStore = nodes => new Store({userId: 'user1', nodes})

const titlesById = (store, ids) => ids.map(id => store.getNode(id)?.title)

describe('copyParentPromptOutputToRefine', () => {
  it('copies every selected parent prompt as refine-owned prompt output without retaining fork node ids', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['refine', 'winnerA', 'winnerB'],
        prompts: ['winnerA', 'winnerB'],
      },
      refine: {id: 'refine', parent: 'parent', children: []},
      winnerA: {
        id: 'winnerA',
        parent: 'parent',
        title: 'winner A',
        children: [],
      },
      winnerB: {
        id: 'winnerB',
        parent: 'parent',
        title: 'winner B',
        children: [],
      },
    })

    const copiedIds = copyParentPromptOutputToRefine({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      refineNodeId: 'refine',
    })

    expect(copiedIds).toHaveLength(2)
    expect(copiedIds).not.toEqual(expect.arrayContaining(['winnerA', 'winnerB']))
    expect(target.getNode('refine').prompts).toEqual(copiedIds)
    expect(target.getNode('refine').children).toEqual(copiedIds)
    expect(titlesById(target, copiedIds)).toEqual(['winner A', 'winner B'])
    copiedIds.forEach(id => expect(target.getNode(id).parent).toBe('refine'))
  })

  it('replaces stale refine prompt subtrees before installing the new winner output', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['refine']},
      refine: {
        id: 'refine',
        parent: 'parent',
        children: ['validate', 'oldPrompt'],
        prompts: ['oldPrompt'],
      },
      validate: {
        id: 'validate',
        parent: 'refine',
        command: '/validate must pass',
        children: [],
      },
      oldPrompt: {
        id: 'oldPrompt',
        parent: 'refine',
        title: 'old output',
        children: ['oldChild'],
      },
      oldChild: {
        id: 'oldChild',
        parent: 'oldPrompt',
        title: 'old child',
        children: [],
      },
    })
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['refine', 'winner'],
        prompts: ['winner'],
      },
      refine: {id: 'refine', parent: 'parent', children: []},
      winner: {
        id: 'winner',
        parent: 'parent',
        title: 'new output',
        children: [],
      },
    })

    const [copiedId] = copyParentPromptOutputToRefine({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      refineNodeId: 'refine',
    })

    expect(target.getNode('oldPrompt')).toBeUndefined()
    expect(target.getNode('oldChild')).toBeUndefined()
    expect(target.getNode('validate')).toBeDefined()
    expect(target.getNode('refine').children).toEqual(['validate', copiedId])
    expect(target.getNode(copiedId).title).toBe('new output')
  })

  it('preserves nested children and nested prompt membership without duplicating prompt nodes as plain children', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['refine', 'winner'],
        prompts: ['winner'],
      },
      refine: {id: 'refine', parent: 'parent', children: []},
      winner: {
        id: 'winner',
        parent: 'parent',
        title: 'winner',
        children: ['plainChild', 'promptChild'],
        prompts: ['promptChild'],
      },
      plainChild: {
        id: 'plainChild',
        parent: 'winner',
        title: 'plain child',
        children: [],
      },
      promptChild: {
        id: 'promptChild',
        parent: 'winner',
        title: 'prompt child',
        children: [],
      },
    })

    const [winnerCopyId] = copyParentPromptOutputToRefine({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      refineNodeId: 'refine',
    })
    const winnerCopy = target.getNode(winnerCopyId)
    const copiedPromptIds = winnerCopy.prompts

    expect(copiedPromptIds).toHaveLength(1)
    expect(titlesById(target, winnerCopy.children)).toEqual(['plain child', 'prompt child'])
    expect(titlesById(target, copiedPromptIds)).toEqual(['prompt child'])
    expect(winnerCopy.children.filter(id => copiedPromptIds.includes(id))).toHaveLength(1)
  })

  it('copies file and image content referenced by the winner output without overwriting target-owned files', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', children: [], prompts: []},
    })
    target.createFile('winner-file', 'target-owned file')
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['refine', 'winner'],
        prompts: ['winner'],
      },
      refine: {id: 'refine', parent: 'parent', children: []},
      winner: {
        id: 'winner',
        parent: 'parent',
        title: 'winner',
        file: 'winner-file',
        image: 'winner-image',
        children: ['child'],
      },
      child: {
        id: 'child',
        parent: 'winner',
        title: 'child',
        file: 'child-file',
        children: [],
      },
    })
    source.createFile('winner-file', 'source winner file')
    source.createFile('winner-image', 'source winner image')
    source.createFile('child-file', 'source child file')

    const [winnerCopyId] = copyParentPromptOutputToRefine({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      refineNodeId: 'refine',
    })
    const winnerCopy = target.getNode(winnerCopyId)
    const [childCopyId] = winnerCopy.children

    expect(winnerCopy.file).toBe('winner-file')
    expect(winnerCopy.image).toBe('winner-image')
    expect(target.getNode(childCopyId).file).toBe('child-file')
    expect(target.getFile('winner-file')).toBe('target-owned file')
    expect(target.getFile('winner-image')).toBe('source winner image')
    expect(target.getFile('child-file')).toBe('source child file')
  })

  it('does not mutate the fork store refine node when copying winner output (shared-reference guard)', () => {
    // applyCandidate assigns fork nodes by reference — the fix must break that link before mutating
    const forkStore = buildStore({
      parent: {
        id: 'parent',
        children: ['refine', 'winner'],
        prompts: ['winner'],
      },
      refine: {id: 'refine', parent: 'parent', children: [], prompts: []},
      winner: {id: 'winner', parent: 'parent', title: 'winner output', children: []},
    })

    const outerStore = buildStore({
      parent: {id: 'parent', children: ['refine']},
    })
    outerStore._nodes['refine'] = forkStore._nodes['refine']
    expect(outerStore._nodes['refine']).toBe(forkStore._nodes['refine'])

    copyParentPromptOutputToRefine({
      sourceStore: forkStore,
      targetStore: outerStore,
      parentNodeId: 'parent',
      refineNodeId: 'refine',
    })

    expect(outerStore._nodes['refine']).not.toBe(forkStore._nodes['refine'])
    expect(forkStore._nodes['refine'].prompts).toEqual([])
    expect(outerStore.getNode('refine').prompts).toHaveLength(1)
    expect(outerStore.getNode(outerStore.getNode('refine').prompts[0]).title).toBe('winner output')
  })

  it('returns an empty copy set and leaves target unchanged when either boundary node is missing', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {id: 'parent', children: [], prompts: []},
    })

    expect(
      copyParentPromptOutputToRefine({
        sourceStore: source,
        targetStore: target,
        parentNodeId: 'missing-parent',
        refineNodeId: 'refine',
      }),
    ).toEqual([])
    expect(
      copyParentPromptOutputToRefine({
        sourceStore: source,
        targetStore: target,
        parentNodeId: 'parent',
        refineNodeId: 'missing-refine',
      }),
    ).toEqual([])
    expect(target.getNode('refine').children).toEqual([])
    expect(target.getNode('refine').prompts).toEqual([])
  })

  it('does not copy a file to the target when the source store has no content for that file id', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {id: 'parent', children: ['refine', 'winner'], prompts: ['winner']},
      refine: {id: 'refine', parent: 'parent', children: []},
      winner: {id: 'winner', parent: 'parent', title: 'winner', file: 'unregistered-file', children: []},
    })

    const [winnerCopyId] = copyParentPromptOutputToRefine({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      refineNodeId: 'refine',
    })

    expect(target.getNode(winnerCopyId).file).toBe('unregistered-file')
    expect(target.getFile('unregistered-file')).toBeUndefined()
  })

  it('returns an empty copy set when source parent has no prompts, and leaves target refine with no prompts', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['refine']},
      refine: {id: 'refine', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {id: 'parent', children: [], prompts: []},
      refine: {id: 'refine', parent: 'parent', children: []},
    })

    const result = copyParentPromptOutputToRefine({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      refineNodeId: 'refine',
    })

    expect(result).toEqual([])
    expect(target.getNode('refine').prompts).toEqual([])
  })
})
