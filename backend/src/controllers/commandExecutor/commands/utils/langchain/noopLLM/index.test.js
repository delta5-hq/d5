import {createNoopLLM} from './index'

describe('createNoopLLM (factory wiring)', () => {
  it('returns the {llm, chunkSize} contract getLLM consumers expect', () => {
    const {llm, chunkSize} = createNoopLLM()
    expect(typeof llm.invoke).toBe('function')
    expect(typeof chunkSize).toBe('number')
    expect(chunkSize).toBeGreaterThan(0)
  })

  it('wires planner-classifier output through the chat model end-to-end', async () => {
    const {llm} = createNoopLLM()
    const ranking = await llm.invoke([
      {content: 'strict quality judge — rank from best (1) to worst (2)'},
      {content: '=== Candidate 1 ===\nA\n\n=== Candidate 2 ===\nB'},
    ])
    const verdict = await llm.invoke([{content: 'strict quality verifier — Reply ONLY with YES or NO'}])
    const generated = await llm.invoke([{content: 'List 3 colors'}])

    expect(ranking.content).toBe('1, 2')
    expect(verdict.content).toMatch(/^YES/)
    expect(generated.content.length).toBeGreaterThan(0)
  })

  it('yields a fresh model instance per call so callers cannot share state accidentally', () => {
    expect(createNoopLLM().llm).not.toBe(createNoopLLM().llm)
  })
})
