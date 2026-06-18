import {isCommodityForkSuccess} from './commodityForkSuccess'
import {EXECUTION_NODE_STATUS} from '../../commands/utils/executionNodeStatus'

jest.mock('debug', () => {
  const fn = jest.fn(() => fn)
  fn.extend = jest.fn(() => fn)
  return fn
})

const SUBSTANTIVE = 'Competitive analysis with three key findings and supporting market data.'

const taggedNode = title => ({
  title,
  executionStatus: EXECUTION_NODE_STATUS.ERROR,
})
const untaggedNode = title => ({title})

describe('isCommodityForkSuccess', () => {
  describe('machine-tag gate (Leg A) — tagged error nodes are rejected regardless of title content', () => {
    it.each([
      ['substantive title', SUBSTANTIVE],
      ['empty title', ''],
      ['whitespace-only title', '   '],
      ['null title', null],
      ['undefined title', undefined],
    ])('rejects a tagged node with %s', (_, title) => {
      expect(isCommodityForkSuccess(taggedNode(title))).toBe(false)
    })

    it.each(['ok', 'pending', null, undefined, ''])(
      'executionStatus %p is not a machine error tag — structural gate applies instead',
      status => {
        expect(
          isCommodityForkSuccess({
            title: SUBSTANTIVE,
            executionStatus: status,
          }),
        ).toBe(true)
      },
    )
  })

  describe('structural gate (Leg B) — consulted only when Leg A passes', () => {
    it('passes when Leg A clears and the title is substantive', () => {
      expect(isCommodityForkSuccess(untaggedNode(SUBSTANTIVE))).toBe(true)
    })

    it('accepts a single-character response — commodity tier has no truncation floor', () => {
      expect(isCommodityForkSuccess(untaggedNode('A'))).toBe(true)
    })

    it('accepts well-formed error-shaped prose — soft HTTP-200 errors are structurally indistinguishable from valid output', () => {
      expect(isCommodityForkSuccess(untaggedNode('Error: upstream timeout'))).toBe(true)
    })

    it('rejects when Leg B fails — empty title', () => {
      expect(isCommodityForkSuccess(untaggedNode(''))).toBe(false)
    })

    it.each([
      "I'm sorry, I cannot help with that.",
      'I cannot assist with generating that content.',
      'As an AI, I cannot generate harmful content.',
      "Unfortunately, I can't help with this.",
    ])('rejects EN refusal title (Leg B) — "%s"', title => {
      expect(isCommodityForkSuccess(untaggedNode(title))).toBe(false)
    })

    it.each([
      'Извините, я не могу помочь с этим.',
      'Я не могу создать такой контент.',
      'К сожалению, я не могу выполнить это.',
      'Как языковая модель, я не могу создавать вредоносный контент.',
    ])('rejects RU refusal title (Leg B) — "%s"', title => {
      expect(isCommodityForkSuccess(untaggedNode(title))).toBe(false)
    })
  })

  describe('composition — machine tag short-circuits before structural gate', () => {
    it('rejects a tagged node even when its title would pass the structural gate', () => {
      expect(isCommodityForkSuccess(taggedNode(SUBSTANTIVE))).toBe(false)
    })

    it('accepts an untagged node with the same substantive title — tag is the sole difference', () => {
      expect(isCommodityForkSuccess(untaggedNode(SUBSTANTIVE))).toBe(true)
    })
  })

  describe('null / undefined / incomplete node safety', () => {
    it.each([null, undefined])('returns false for %s node', node => {
      expect(isCommodityForkSuccess(node)).toBe(false)
    })

    it('returns false for a node with no title property', () => {
      expect(isCommodityForkSuccess({})).toBe(false)
    })

    it('returns false for a tagged node with no title property', () => {
      expect(isCommodityForkSuccess({executionStatus: EXECUTION_NODE_STATUS.ERROR})).toBe(false)
    })
  })

  describe('forkIndex — observability parameter that does not alter verdict', () => {
    it.each([0, 1, 99, null, undefined])('passing node remains passing with forkIndex=%s', forkIndex => {
      expect(isCommodityForkSuccess(untaggedNode(SUBSTANTIVE), forkIndex)).toBe(true)
    })

    it.each([0, 1, 99, null, undefined])('tagged node remains rejected with forkIndex=%s', forkIndex => {
      expect(isCommodityForkSuccess(taggedNode(SUBSTANTIVE), forkIndex)).toBe(false)
    })

    it.each([0, 1, 99, null, undefined])('untagged empty-title node remains rejected with forkIndex=%s', forkIndex => {
      expect(isCommodityForkSuccess(untaggedNode(''), forkIndex)).toBe(false)
    })
  })

  describe('observability — machine-tag short-circuit suppresses structural-gate log', () => {
    let log

    beforeEach(() => {
      log = jest.requireMock('debug')
      log.mockClear()
    })

    const rejectionLogs = () => log.mock.calls.filter(([fmt]) => fmt === '%s rejected: %s')

    it('tagged node rejection does not emit a structural-gate log entry', () => {
      isCommodityForkSuccess(taggedNode(SUBSTANTIVE))
      expect(rejectionLogs()).toHaveLength(0)
    })
  })
})
