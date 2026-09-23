import {createNoopEmbeddings, createNoopLLM} from './index'

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
    expect(verdict.content).toMatch(/^(YES|NO)/)
    expect(generated.content.length).toBeGreaterThan(0)
  })

  it('yields a fresh model instance per call so callers cannot share state accidentally', () => {
    expect(createNoopLLM().llm).not.toBe(createNoopLLM().llm)
  })
})

describe('createNoopEmbeddings', () => {
  it('returns the embeddings contract vector stores expect', async () => {
    const {embeddings, chunkSize, similarityThreshold} = createNoopEmbeddings()
    const documents = await embeddings.embedDocuments(['alpha', 'beta'])
    const query = await embeddings.embedQuery('alpha')

    expect(documents).toHaveLength(2)
    expect(documents[0]).toHaveLength(query.length)
    expect(typeof chunkSize).toBe('number')
    expect(similarityThreshold).toBe(0)
  })

  it('is deterministic for the same text', async () => {
    const {embeddings} = createNoopEmbeddings()
    await expect(embeddings.embedQuery('same text')).resolves.toEqual(await embeddings.embedQuery('same text'))
  })
})

describe('MOCK_PASS_RATE generator failure seam — integration wiring', () => {
  afterEach(() => {
    delete process.env.MOCK_PASS_RATE
  })

  it('generator invocation throws when MOCK_PASS_RATE=0', async () => {
    process.env.MOCK_PASS_RATE = '0'
    const {llm} = createNoopLLM()
    await expect(llm.invoke([{content: 'Generate some content'}])).rejects.toThrow()
  })

  it('judge invocation is unaffected by MOCK_PASS_RATE=0', async () => {
    process.env.MOCK_PASS_RATE = '0'
    const {llm} = createNoopLLM()
    const result = await llm.invoke([
      {content: 'strict quality judge — rank from best (1) to worst (2)'},
      {content: '=== Candidate 1 ===\nA\n\n=== Candidate 2 ===\nB'},
    ])
    expect(result.content).toBe('1, 2')
  })

  it('verifier invocation is unaffected by MOCK_PASS_RATE=0', async () => {
    process.env.MOCK_PASS_RATE = '0'
    const {llm} = createNoopLLM()
    const result = await llm.invoke([{content: 'strict quality verifier — Reply ONLY with YES or NO'}])
    expect(result.content).toMatch(/^(YES|NO)/)
  })
})
