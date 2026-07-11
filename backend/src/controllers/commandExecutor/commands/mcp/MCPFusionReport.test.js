import {MCPFusionReport} from './MCPFusionReport'

const buildReport = actions => {
  const report = new MCPFusionReport()
  actions.forEach(action => report[action.method](...action.args))
  return report
}

describe('MCPFusionReport', () => {
  describe('answer rendering', () => {
    it.each([
      ['plain answer', 'answer text', 'answer text'],
      ['empty string answer', '', '(empty MCP response)'],
      ['null answer', null, '(empty MCP response)'],
      ['undefined answer', undefined, '(empty MCP response)'],
    ])('renders %s', (_label, answer, expected) => {
      expect(new MCPFusionReport().render(answer)).toContain(expected)
    })
  })

  describe('availability rendering', () => {
    it('renders every available integration with its exposed tools', () => {
      const report = buildReport([
        {method: 'markAvailable', args: ['/scrape', ['scrape_web_pages']]},
        {method: 'markAvailable', args: ['/research', ['web_search_qa', 'scholar_search_qa']]},
      ])

      const output = report.render('done')

      expect(output).toContain('Available MCP integrations:')
      expect(output).toContain('- /scrape: scrape_web_pages')
      expect(output).toContain('- /research: web_search_qa, scholar_search_qa')
    })

    it('renders empty tool lists without making availability look unknown', () => {
      const report = buildReport([{method: 'markAvailable', args: ['/empty', []]}])

      expect(report.render('done')).toContain('- /empty: no tools')
    })

    it.each([
      ['connect failure', 'connect', new Error('ECONNREFUSED'), '- /broken: connect failed — ECONNREFUSED'],
      ['listTools failure', 'listTools', 'schema invalid', '- /broken: listTools failed — schema invalid'],
    ])('renders %s', (_label, phase, error, expected) => {
      const report = buildReport([{method: 'markUnavailable', args: ['/broken', phase, error]}])

      expect(report.render('done')).toContain(expected)
    })
  })

  describe('provenance rendering', () => {
    it('renders no tool calls explicitly when the agent returned without using tools', () => {
      expect(new MCPFusionReport().render('done')).toContain('Tool calls: none')
    })

    it.each([
      ['success', undefined, '- /scrape scrape__scrape_web_pages → scrape_web_pages: success'],
      ['error', new Error('timeout'), '- /scrape scrape__scrape_web_pages → scrape_web_pages: error — timeout'],
    ])('renders a %s tool call', (status, error, expected) => {
      const report = buildReport([
        {
          method: 'recordToolCall',
          args: ['/scrape', 'scrape__scrape_web_pages', 'scrape_web_pages', status, error],
        },
      ])

      expect(report.render('done')).toContain(expected)
    })

    it('preserves call order for multi-tool agent runs', () => {
      const report = buildReport([
        {method: 'recordToolCall', args: ['/a', 'a__first', 'first', 'success']},
        {method: 'recordToolCall', args: ['/b', 'b__second', 'second', 'success']},
      ])

      const output = report.render('done')

      expect(output.indexOf('a__first')).toBeLessThan(output.indexOf('b__second'))
    })
  })

  describe('toJSON', () => {
    it('returns structured report data with all fields', () => {
      const report = new MCPFusionReport()
      report.markAvailable('/tools', ['read_file'])
      report.markUnavailable('/broken', 'connect', new Error('refused'))
      report.recordToolCall('/tools', 'tools__read_file', 'read_file', 'success', null)

      const json = report.toJSON()

      expect(json.available).toEqual([{alias: '/tools', toolNames: ['read_file']}])
      expect(json.unavailable).toEqual([{alias: '/broken', phase: 'connect', reason: 'refused'}])
      expect(json.toolCalls).toEqual([
        {alias: '/tools', exposedName: 'tools__read_file', toolName: 'read_file', status: 'success', reason: undefined},
      ])
    })

    it('returns empty arrays on a fresh report with no recorded events', () => {
      const json = new MCPFusionReport().toJSON()

      expect(json).toEqual({available: [], unavailable: [], toolCalls: []})
    })

    it('serialises a non-Error thrown value as its string representation', () => {
      const report = new MCPFusionReport()
      report.markUnavailable('/svc', 'connect', 'plain string error')

      expect(report.toJSON().unavailable[0].reason).toBe('plain string error')
    })

    it('produces an independent snapshot — mutating JSON output does not affect subsequent calls', () => {
      const report = new MCPFusionReport()
      report.markAvailable('/svc', ['tool_a', 'tool_b'])

      const first = report.toJSON()
      first.available[0].toolNames.push('injected')

      expect(report.toJSON().available[0].toolNames).toHaveLength(2)
    })
  })

  describe('render — section composition', () => {
    it('places answer before availability and provenance in output', () => {
      const report = new MCPFusionReport()
      report.markAvailable('/svc', ['t'])
      const rendered = report.render('my answer')

      const answerPos = rendered.indexOf('my answer')
      const availPos = rendered.indexOf('Available MCP integrations:')
      const provenancePos = rendered.indexOf('Tool calls:')

      expect(answerPos).toBeLessThan(availPos)
      expect(availPos).toBeLessThan(provenancePos)
    })

    it('omits the availability section entirely when no integrations were registered', () => {
      const rendered = new MCPFusionReport().render('answer')

      expect(rendered).not.toContain('Available MCP integrations:')
      expect(rendered).not.toContain('Unavailable MCP integrations:')
    })

    it('renders both available and unavailable sections in the same report', () => {
      const report = buildReport([
        {method: 'markAvailable', args: ['/ok', ['t']]},
        {method: 'markUnavailable', args: ['/broken', 'connect', new Error('refused')]},
      ])

      const rendered = report.render('done')

      expect(rendered).toContain('Available MCP integrations:')
      expect(rendered).toContain('Unavailable MCP integrations:')
    })

    it('renders only unavailable section when all integrations failed to connect', () => {
      const report = buildReport([{method: 'markUnavailable', args: ['/broken', 'connect', new Error('err')]}])

      const rendered = report.render('done')

      expect(rendered).not.toContain('Available MCP integrations:')
      expect(rendered).toContain('Unavailable MCP integrations:')
    })
  })
})
