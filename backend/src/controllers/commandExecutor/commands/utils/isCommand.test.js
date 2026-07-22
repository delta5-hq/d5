import {getNodeCommand, isSteps, isForeach, isSummarize} from './isCommand'

describe('getNodeCommand', () => {
  describe('field precedence', () => {
    it('returns command when command field exists', () => {
      const node = {command: '/chatgpt test', title: 'different text'}
      expect(getNodeCommand(node)).toBe('/chatgpt test')
    })

    it('returns title when command field is missing', () => {
      const node = {title: '/chatgpt from title'}
      expect(getNodeCommand(node)).toBe('/chatgpt from title')
    })

    it('prefers command over title when both present', () => {
      const node = {command: '/chatgpt priority', title: '/summarize fallback'}
      expect(getNodeCommand(node)).toBe('/chatgpt priority')
    })

    it('returns title when command is empty string', () => {
      const node = {command: '', title: '/chatgpt valid'}
      expect(getNodeCommand(node)).toBe('/chatgpt valid')
    })

    it('returns title when command is null', () => {
      const node = {command: null, title: '/chatgpt valid'}
      expect(getNodeCommand(node)).toBe('/chatgpt valid')
    })

    it('returns title when command is undefined', () => {
      const node = {command: undefined, title: '/chatgpt valid'}
      expect(getNodeCommand(node)).toBe('/chatgpt valid')
    })
  })

  describe('empty/missing values', () => {
    it.each([
      [{}, 'empty object'],
      [{command: '', title: ''}, 'both empty strings'],
      [{command: null, title: null}, 'both null'],
      [{command: undefined, title: undefined}, 'both undefined'],
      [null, 'null node'],
      [undefined, 'undefined node'],
    ])('returns empty string for %s', node => {
      expect(getNodeCommand(node)).toBe('')
    })
  })

  describe('command parameter preservation', () => {
    it.each([
      '/chatgpt :lang=ru translate this',
      '/claude :n=3 write poem',
      '/web :timeout=5000 search',
      '/chatgpt :model=gpt4 :temp=0.7 analyze',
      '/summarize :size=medium',
    ])('preserves params in command: %s', commandText => {
      expect(getNodeCommand({command: commandText})).toBe(commandText)
    })

    it.each(['/chatgpt :lang=ru from title', '/claude :n=5 task'])(
      'preserves params in title fallback: %s',
      titleText => {
        expect(getNodeCommand({title: titleText})).toBe(titleText)
      },
    )
  })

  describe('real-world node structures', () => {
    it('handles UI-created node with command field', () => {
      const uiNode = {
        id: 'node-123',
        command: '/chatgpt summarize',
        title: 'Summarization Task',
        children: [],
        parent: 'root',
      }
      expect(getNodeCommand(uiNode)).toBe('/chatgpt summarize')
    })

    it('handles title-only post-process child node', () => {
      const postProcessNode = {
        id: 'child-456',
        title: '/refine improve clarity',
        parent: 'parent-node',
        children: [],
      }
      expect(getNodeCommand(postProcessNode)).toBe('/refine improve clarity')
    })

    it('handles foreach-generated node with command set', () => {
      const foreachChild = {
        id: 'foreach-gen-789',
        command: '/web search item',
        title: 'Search: item',
        parent: 'foreach-parent',
      }
      expect(getNodeCommand(foreachChild)).toBe('/web search item')
    })
  })
})

describe('isSteps', () => {
  describe('positive detection', () => {
    it.each([
      [{command: '/steps do something'}, 'in command'],
      [{title: '/steps do something'}, 'in title'],
      [{command: '/steps'}, 'bare command'],
      [{title: '/steps'}, 'bare title'],
      [{command: '/steps task1\ntask2'}, 'multiline'],
    ])('detects /steps: %s', node => {
      expect(isSteps(node)).toBe(true)
    })

    it('detects /steps when both fields present (command wins)', () => {
      expect(isSteps({command: '/steps task', title: '/chatgpt other'})).toBe(true)
    })

    it('detects /steps in title when command is non-steps', () => {
      expect(isSteps({command: '', title: '/steps task'})).toBe(true)
    })
  })

  describe('negative detection', () => {
    it.each([
      [{command: '/chatgpt test'}, 'different command'],
      [{title: '/foreach loop'}, 'different title'],
      [{command: 'steps without slash'}, 'missing slash'],
      [{title: 'text with /steps inside'}, 'not prefix'],
      [{command: ''}, 'empty command'],
      [{title: ''}, 'empty title'],
      [null, 'null node'],
      [undefined, 'undefined node'],
      [{}, 'empty object'],
    ])('returns false for: %s', node => {
      expect(isSteps(node)).toBe(false)
    })
  })
})

describe('isForeach', () => {
  describe('positive detection', () => {
    it.each([
      [{command: '/foreach iterate'}, 'in command'],
      [{title: '/foreach iterate'}, 'in title'],
      [{command: '/foreach'}, 'bare command'],
      [{title: '/foreach item in @list'}, 'with params'],
    ])('detects /foreach: %s', node => {
      expect(isForeach(node)).toBe(true)
    })

    it('detects /foreach when both fields present (command wins)', () => {
      expect(isForeach({command: '/foreach item', title: '/chatgpt other'})).toBe(true)
    })

    it('detects /foreach in title when command is empty', () => {
      expect(isForeach({command: null, title: '/foreach loop'})).toBe(true)
    })
  })

  describe('negative detection', () => {
    it.each([
      [{command: '/steps test'}, 'different command'],
      [{title: '/summarize text'}, 'different title'],
      [{command: 'foreach without slash'}, 'missing slash'],
      [{title: 'mention /foreach inside'}, 'not prefix'],
      [null, 'null node'],
      [undefined, 'undefined node'],
      [{}, 'empty object'],
    ])('returns false for: %s', node => {
      expect(isForeach(node)).toBe(false)
    })
  })
})

describe('isSummarize', () => {
  describe('positive detection', () => {
    it.each([
      [{command: '/summarize text'}, 'in command'],
      [{title: '/summarize text'}, 'in title'],
      [{command: '/summarize'}, 'bare command'],
      [{title: '/summarize :size=medium content'}, 'with params'],
    ])('detects /summarize: %s', node => {
      expect(isSummarize(node)).toBe(true)
    })

    it('detects /summarize when both fields present (command wins)', () => {
      expect(isSummarize({command: '/summarize doc', title: '/web search'})).toBe(true)
    })

    it('detects /summarize in title when command is non-summarize', () => {
      expect(isSummarize({command: '', title: '/summarize long text'})).toBe(true)
    })
  })

  describe('negative detection', () => {
    it.each([
      [{command: '/chatgpt summarize'}, 'different command'],
      [{title: '/outline --summarize'}, 'different title'],
      [{command: 'summarize without slash'}, 'missing slash'],
      [{title: 'text mentions /summarize'}, 'not prefix'],
      [null, 'null node'],
      [undefined, 'undefined node'],
      [{}, 'empty object'],
    ])('returns false for: %s', node => {
      expect(isSummarize(node)).toBe(false)
    })
  })
})

describe('integration: command resolution across predicates', () => {
  it('correctly resolves different commands from same node structure', () => {
    const nodeTemplate = cmd => ({command: cmd, title: 'Task', children: []})

    expect(getNodeCommand(nodeTemplate('/steps task'))).toBe('/steps task')
    expect(isSteps(nodeTemplate('/steps task'))).toBe(true)
    expect(isForeach(nodeTemplate('/steps task'))).toBe(false)
    expect(isSummarize(nodeTemplate('/steps task'))).toBe(false)
  })

  it('all predicates use same field precedence (command over title)', () => {
    const node = {command: '/steps work', title: '/foreach loop'}

    expect(getNodeCommand(node)).toBe('/steps work')
    expect(isSteps(node)).toBe(true)
    expect(isForeach(node)).toBe(false)
  })

  it('all predicates handle null nodes identically', () => {
    expect(getNodeCommand(null)).toBe('')
    expect(isSteps(null)).toBe(false)
    expect(isForeach(null)).toBe(false)
    expect(isSummarize(null)).toBe(false)
  })
})
