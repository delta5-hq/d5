import ProgressReporter from './ProgressReporter'

jest.mock('../../shared/utils/generateId', () => 'mockedId')

describe('ProgressReporter', () => {
  let logSpy

  beforeEach(() => {
    jest.useFakeTimers()
    logSpy = jest.fn()
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('should create root reporter and sets interval', () => {
    const reporter = new ProgressReporter({title: 'root', log: logSpy})
    expect(reporter.title).toBe('root')
    expect(typeof reporter.interval).toBe('object')
    reporter.dispose()
  })

  it('should call logFn on output if there is content', async () => {
    const reporter = new ProgressReporter({title: 'root', log: logSpy})
    await reporter.add('task')
    reporter.output()
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('task'))
    reporter.dispose()
  })

  it('should register child reporter', () => {
    const parent = new ProgressReporter({title: 'parent'})
    const child = new ProgressReporter({title: 'child'}, parent)

    const key = 'child:mockedId'
    expect(parent.children.has(key)).toBe(true)
    expect(parent.children.get(key)).toBe(child)

    parent.dispose()
  })

  it('should add increments label count', async () => {
    const reporter = new ProgressReporter({title: 'test'})
    await reporter.add('task')
    await reporter.add('task')
    expect(reporter.counts.get('task')).toBe(2)
    reporter.dispose()
  })

  it('should remove decrements label count and deletes when zero', async () => {
    const reporter = new ProgressReporter({title: 'test'})
    await reporter.add('task')
    await reporter.add('task')
    reporter.remove('task')
    expect(reporter.counts.get('task')).toBe(1)
    reporter.remove('task')
    expect(reporter.counts.has('task')).toBe(false)
    reporter.dispose()
  })

  it('should render outputs proper structure with nesting', async () => {
    const root = new ProgressReporter({title: 'root'})
    const child = new ProgressReporter({title: 'child'}, root)
    await root.add('ChatCommand.run')
    await child.add('ForeachCommand.run')

    const output = root.render()
    expect(output).toContain("'root' reporter:")
    expect(output).toContain('ChatCommand.run')
    expect(output).toContain("'child' reporter:")
    expect(output).toContain('ForeachCommand.run')

    root.dispose()
  })

  it('should dispose clears interval', () => {
    const reporter = new ProgressReporter({title: 'test'})
    const clearSpy = jest.spyOn(global, 'clearInterval')
    reporter.dispose()
    expect(clearSpy).toHaveBeenCalledWith(reporter.interval)
  })

  it('should aggregate repeated labels correctly within a single reporter', async () => {
    const root = new ProgressReporter({title: 'root'})
    const child = new ProgressReporter({title: 'child'}, root)
    await child.add('ChatCommand.run')
    await child.add('ChatCommand.run')
    await child.add('ChatCommand.run')

    const output = root.render()

    expect(output).toContain("'root' reporter:")
    expect(output).toContain("'child' reporter:")
    expect(output).toContain('ChatCommand.run (3)')

    root.dispose()
  })

  it('should aggregate repeated labels correctly under concurrent usage', async () => {
    const root = new ProgressReporter({title: 'root'})
    const child = new ProgressReporter({title: 'child'}, root)

    const promises = [child.add('ChatCommand.run'), child.add('ChatCommand.run'), child.add('ChatCommand.run')]
    await Promise.all(promises)

    const output = root.render()

    expect(output).toContain("'root' reporter:")
    expect(output).toContain("'child' reporter:")
    expect(output).toContain('ChatCommand.run (3)')

    root.dispose()
  })
})
