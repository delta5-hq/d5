import Store from '../../commands/utils/Store'
import {copyParentPromptOutputToElect} from './electWinnerOutput'

const buildStore = nodes => new Store({userId: 'user1', nodes})

const titlesById = (store, ids) => ids.map(id => store.getNode(id)?.title)

describe('copyParentPromptOutputToElect', () => {
  it('copies every selected parent prompt as elect-owned prompt output without retaining fork node ids', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['elect', 'winnerA', 'winnerB'],
        prompts: ['winnerA', 'winnerB'],
      },
      elect: {id: 'elect', parent: 'parent', children: []},
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

    const copiedIds = copyParentPromptOutputToElect({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      electNodeId: 'elect',
    })

    expect(copiedIds).toHaveLength(2)
    expect(copiedIds).not.toEqual(expect.arrayContaining(['winnerA', 'winnerB']))
    expect(target.getNode('elect').prompts).toEqual(copiedIds)
    expect(target.getNode('elect').children).toEqual(copiedIds)
    expect(titlesById(target, copiedIds)).toEqual(['winner A', 'winner B'])
    copiedIds.forEach(id => expect(target.getNode(id).parent).toBe('elect'))
  })

  it('replaces stale elect prompt subtrees before installing the new winner output', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['elect']},
      elect: {
        id: 'elect',
        parent: 'parent',
        children: ['validate', 'oldPrompt'],
        prompts: ['oldPrompt'],
      },
      validate: {
        id: 'validate',
        parent: 'elect',
        command: '/validate must pass',
        children: [],
      },
      oldPrompt: {
        id: 'oldPrompt',
        parent: 'elect',
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
        children: ['elect', 'winner'],
        prompts: ['winner'],
      },
      elect: {id: 'elect', parent: 'parent', children: []},
      winner: {
        id: 'winner',
        parent: 'parent',
        title: 'new output',
        children: [],
      },
    })

    const [copiedId] = copyParentPromptOutputToElect({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      electNodeId: 'elect',
    })

    expect(target.getNode('oldPrompt')).toBeUndefined()
    expect(target.getNode('oldChild')).toBeUndefined()
    expect(target.getNode('validate')).toBeDefined()
    expect(target.getNode('elect').children).toEqual(['validate', copiedId])
    expect(target.getNode(copiedId).title).toBe('new output')
  })

  it('preserves nested children and nested prompt membership without duplicating prompt nodes as plain children', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['elect', 'winner'],
        prompts: ['winner'],
      },
      elect: {id: 'elect', parent: 'parent', children: []},
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

    const [winnerCopyId] = copyParentPromptOutputToElect({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      electNodeId: 'elect',
    })
    const winnerCopy = target.getNode(winnerCopyId)
    const copiedPromptIds = winnerCopy.prompts

    expect(copiedPromptIds).toHaveLength(1)
    expect(titlesById(target, winnerCopy.children)).toEqual(['plain child', 'prompt child'])
    expect(titlesById(target, copiedPromptIds)).toEqual(['prompt child'])
    expect(winnerCopy.children.filter(id => copiedPromptIds.includes(id))).toHaveLength(1)
  })

  it("preserves file and image reference properties on copied nodes; file-content transfer is StoreFork.applyCandidate's responsibility", () => {
    // copyParentPromptOutputToElect copies node structure (including file/image ID references).
    // In production, StoreFork.applyCandidate runs first and copies _files content so those IDs resolve.
    const target = buildStore({
      parent: {id: 'parent', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', children: [], prompts: []},
    })
    target.createFile('winner-file', 'target-owned file')
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['elect', 'winner'],
        prompts: ['winner'],
      },
      elect: {id: 'elect', parent: 'parent', children: []},
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

    const [winnerCopyId] = copyParentPromptOutputToElect({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      electNodeId: 'elect',
    })
    const winnerCopy = target.getNode(winnerCopyId)
    const [childCopyId] = winnerCopy.children

    // node properties carry the file/image ID references correctly
    expect(winnerCopy.file).toBe('winner-file')
    expect(winnerCopy.image).toBe('winner-image')
    expect(target.getNode(childCopyId).file).toBe('child-file')
    // target-owned files are not overwritten (still guarded by applyCandidate upstream)
    expect(target.getFile('winner-file')).toBe('target-owned file')
    // file content itself lives in sourceStore; transfer to target is applyCandidate's contract
    expect(target.getFile('winner-image')).toBeUndefined()
    expect(target.getFile('child-file')).toBeUndefined()
  })

  it('does not mutate the fork store elect node when copying winner output (shared-reference guard)', () => {
    // applyCandidate assigns fork nodes by reference — the fix must break that link before mutating
    const forkStore = buildStore({
      parent: {
        id: 'parent',
        children: ['elect', 'winner'],
        prompts: ['winner'],
      },
      elect: {id: 'elect', parent: 'parent', children: [], prompts: []},
      winner: {
        id: 'winner',
        parent: 'parent',
        title: 'winner output',
        children: [],
      },
    })

    const outerStore = buildStore({
      parent: {id: 'parent', children: ['elect']},
    })
    outerStore._nodes['elect'] = forkStore._nodes['elect']
    expect(outerStore._nodes['elect']).toBe(forkStore._nodes['elect'])

    copyParentPromptOutputToElect({
      sourceStore: forkStore,
      targetStore: outerStore,
      parentNodeId: 'parent',
      electNodeId: 'elect',
    })

    expect(outerStore._nodes['elect']).not.toBe(forkStore._nodes['elect'])
    expect(forkStore._nodes['elect'].prompts).toEqual([])
    expect(outerStore.getNode('elect').prompts).toHaveLength(1)
    expect(outerStore.getNode(outerStore.getNode('elect').prompts[0]).title).toBe('winner output')
  })

  it('returns an empty copy set and leaves target unchanged when either boundary node is missing', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {id: 'parent', children: [], prompts: []},
    })

    expect(
      copyParentPromptOutputToElect({
        sourceStore: source,
        targetStore: target,
        parentNodeId: 'missing-parent',
        electNodeId: 'elect',
      }),
    ).toEqual([])
    expect(
      copyParentPromptOutputToElect({
        sourceStore: source,
        targetStore: target,
        parentNodeId: 'parent',
        electNodeId: 'missing-elect',
      }),
    ).toEqual([])
    expect(target.getNode('elect').children).toEqual([])
    expect(target.getNode('elect').prompts).toEqual([])
  })

  it('does not copy a file to the target when the source store has no content for that file id', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {
        id: 'parent',
        children: ['elect', 'winner'],
        prompts: ['winner'],
      },
      elect: {id: 'elect', parent: 'parent', children: []},
      winner: {
        id: 'winner',
        parent: 'parent',
        title: 'winner',
        file: 'unregistered-file',
        children: [],
      },
    })

    const [winnerCopyId] = copyParentPromptOutputToElect({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      electNodeId: 'elect',
    })

    expect(target.getNode(winnerCopyId).file).toBe('unregistered-file')
    expect(target.getFile('unregistered-file')).toBeUndefined()
  })

  it('returns an empty copy set when source parent has no prompts, and leaves target elect with no prompts', () => {
    const target = buildStore({
      parent: {id: 'parent', children: ['elect']},
      elect: {id: 'elect', parent: 'parent', children: [], prompts: []},
    })
    const source = buildStore({
      parent: {id: 'parent', children: [], prompts: []},
      elect: {id: 'elect', parent: 'parent', children: []},
    })

    const result = copyParentPromptOutputToElect({
      sourceStore: source,
      targetStore: target,
      parentNodeId: 'parent',
      electNodeId: 'elect',
    })

    expect(result).toEqual([])
    expect(target.getNode('elect').prompts).toEqual([])
  })
})
