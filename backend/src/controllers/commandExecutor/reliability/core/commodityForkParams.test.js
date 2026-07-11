import {readCommodityN} from './commodityForkParams'
import {CONTROL_FLOW_COMMANDS, DELEGATING_COMMANDS, DETERMINISTIC_COMMANDS} from '../../constants'
import {CHAT_QUERY_TYPE} from '../../constants/chat'
import {CLAUDE_QUERY_TYPE} from '../../constants/claude'

const AN_ELIGIBLE_QUERY_TYPE = CLAUDE_QUERY_TYPE

describe('readCommodityN', () => {
  describe('ineligible queryType → null regardless of :n= in command', () => {
    it.each([...CONTROL_FLOW_COMMANDS])('control-flow %s', queryType => {
      expect(readCommodityN(queryType, '/cmd :n=3 prompt')).toBeNull()
    })

    it.each([...DETERMINISTIC_COMMANDS])('deterministic %s', queryType => {
      expect(readCommodityN(queryType, '/cmd :n=3 prompt')).toBeNull()
    })

    it.each([...DELEGATING_COMMANDS])('delegating %s', queryType => {
      expect(readCommodityN(queryType, '/cmd :n=3 prompt')).toBeNull()
    })

    it.each([undefined, null, ''])('absent/blank queryType %p', queryType => {
      expect(readCommodityN(queryType, '/cmd :n=3 prompt')).toBeNull()
    })
  })

  describe('eligible queryType — command yields no usable N → null', () => {
    it.each([null, undefined, ''])('falsy command %p', command => {
      expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, command)).toBeNull()
    })

    it('whitespace-only command has no :n= match', () => {
      expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '   ')).toBeNull()
    })

    it.each([
      [CLAUDE_QUERY_TYPE, '/claude summarize'],
      [CHAT_QUERY_TYPE, '/chatgpt hello'],
      ['mcp:tool', '/tool do work'],
      ['rpc:vm', '/vm exec'],
    ])('%s — command has no :n= token', (queryType, command) => {
      expect(readCommodityN(queryType, command)).toBeNull()
    })

    it.each([
      [AN_ELIGIBLE_QUERY_TYPE, 0],
      [AN_ELIGIBLE_QUERY_TYPE, 1],
      ['mcp:tool', 0],
      ['mcp:tool', 1],
      ['rpc:vm', 0],
      ['rpc:vm', 1],
    ])('%s :n=%i is below the minimum threshold of 2', (queryType, n) => {
      expect(readCommodityN(queryType, `/cmd :n=${n} prompt`)).toBeNull()
    })

    it('non-numeric :n= content (:n=abc) yields null', () => {
      expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '/cmd :n=abc prompt')).toBeNull()
    })
  })

  describe('eligible queryType — :n=N with N ≥ 2 → N', () => {
    it('N=2 is the minimum accepted value', () => {
      expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '/cmd :n=2 prompt')).toBe(2)
    })

    it.each([
      [CLAUDE_QUERY_TYPE, 3],
      [CLAUDE_QUERY_TYPE, 5],
      [CLAUDE_QUERY_TYPE, 10],
      [CLAUDE_QUERY_TYPE, 100],
      [CHAT_QUERY_TYPE, 2],
      ['mcp:coder1', 3],
      ['mcp:agent', 2],
      ['rpc:vm3', 2],
      ['rpc:worker', 5],
    ])('%s :n=%i', (queryType, n) => {
      expect(readCommodityN(queryType, `/cmd :n=${n} task`)).toBe(n)
    })

    describe(':n= position and coexistence with other params', () => {
      it(':n= precedes other params', () => {
        expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '/cmd :n=3 :fallback task')).toBe(3)
      })

      it(':n= follows other params', () => {
        expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '/cmd :limit=xs :n=5 task')).toBe(5)
      })

      it(':n= sits between other params', () => {
        expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '/cmd :flag :n=2 :other task')).toBe(2)
      })

      it('when :n= appears multiple times, the first occurrence wins', () => {
        expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '/cmd :n=2 :n=9 task')).toBe(2)
      })

      it('decimal :n=3.5 truncates to integer 3', () => {
        expect(readCommodityN(AN_ELIGIBLE_QUERY_TYPE, '/cmd :n=3.5 task')).toBe(3)
      })
    })
  })

  describe('eligibility is decided by queryType alone — command content is irrelevant', () => {
    const SHARED_COMMAND = '/cmd :n=7 same text'

    it('identical command returns null for all ineligible queryType categories', () => {
      expect(readCommodityN([...CONTROL_FLOW_COMMANDS][0], SHARED_COMMAND)).toBeNull()
      expect(readCommodityN([...DETERMINISTIC_COMMANDS][0], SHARED_COMMAND)).toBeNull()
      expect(readCommodityN([...DELEGATING_COMMANDS][0], SHARED_COMMAND)).toBeNull()
    })

    it('identical command returns N for all eligible queryType families', () => {
      expect(readCommodityN(CLAUDE_QUERY_TYPE, SHARED_COMMAND)).toBe(7)
      expect(readCommodityN(CHAT_QUERY_TYPE, SHARED_COMMAND)).toBe(7)
      expect(readCommodityN('mcp:tool', SHARED_COMMAND)).toBe(7)
      expect(readCommodityN('rpc:vm', SHARED_COMMAND)).toBe(7)
    })

    it('any unrecognised queryType string is eligible without requiring a code change', () => {
      expect(readCommodityN('future-provider', SHARED_COMMAND)).toBe(7)
    })

    it('empty string queryType is treated the same as absent — always ineligible', () => {
      expect(readCommodityN('', SHARED_COMMAND)).toBeNull()
    })
  })
})
