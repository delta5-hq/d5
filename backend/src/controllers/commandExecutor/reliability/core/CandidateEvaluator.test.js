import CandidateEvaluator from './CandidateEvaluator'

describe('CandidateEvaluator', () => {
  describe('validate', () => {
    describe('empty output validation', () => {
      it('should reject when both nodes and edges are empty', () => {
        const store = {
          getOutput: () => ({nodes: [], edges: []}),
        }

        const result = CandidateEvaluator.validate(store, 'test prompt')

        expect(result.pass).toBe(false)
        expect(result.reason).toBe('empty_output')
      })

      it('should accept when nodes exist but edges are empty', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'Test Node'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'test prompt')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should accept when edges exist but nodes are empty', () => {
        const store = {
          getOutput: () => ({
            nodes: [],
            edges: [{id: 'e1', start: 'n1', end: 'n2'}],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'test prompt')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })
    })

    describe('echo detection', () => {
      it('should detect exact prompt echo', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'test prompt'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'test prompt')

        expect(result.pass).toBe(false)
        expect(result.reason).toBe('echo_detected')
      })

      it('should detect echo when concatenated titles match prompt', () => {
        const store = {
          getOutput: () => ({
            nodes: [
              {id: '1', title: 'repeat'},
              {id: '2', title: 'exactly'},
            ],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'repeat exactly')

        expect(result.pass).toBe(false)
        expect(result.reason).toBe('echo_detected')
      })

      it('should not false-positive on partial match', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'test prompt with additional content'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'test prompt')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should not false-positive on substring match', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'testing'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'test')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should handle whitespace in echo detection', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: '  test  prompt  '}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, '  test  prompt  ')

        expect(result.pass).toBe(false)
        expect(result.reason).toBe('echo_detected')
      })

      it('should handle empty prompt without false echo detection', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: ''}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, '')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should handle null prompt without false echo detection', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'some content'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, null)

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should handle undefined prompt without false echo detection', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'some content'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, undefined)

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should treat missing titles as empty strings in concatenation', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1'}, {id: '2', title: 'content that differs'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'some prompt')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })
    })

    describe('table validation', () => {
      it('should reject table command without gridOptions', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'Some text'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'create table', {isTableCommand: true})

        expect(result.pass).toBe(false)
        expect(result.reason).toBe('no_grid_options')
      })

      it('should accept table command with gridOptions', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', gridOptions: {columnDefs: [], rowData: []}}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'create table', {isTableCommand: true})

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should accept table command with gridOptions in second node', () => {
        const store = {
          getOutput: () => ({
            nodes: [
              {id: '1', title: 'Header'},
              {id: '2', gridOptions: {columnDefs: [], rowData: []}},
            ],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'create table', {isTableCommand: true})

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should not apply table validation when isTableCommand is false', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'Some text'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'create table', {isTableCommand: false})

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })

      it('should not apply table validation when option is undefined', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'Some text'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'create table')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })
    })

    describe('combined validations', () => {
      it('should prioritize empty check over echo check', () => {
        const store = {
          getOutput: () => ({nodes: [], edges: []}),
        }

        const result = CandidateEvaluator.validate(store, '')

        expect(result.pass).toBe(false)
        expect(result.reason).toBe('empty_output')
      })

      it('should prioritize echo check over table check', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'test'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'test', {isTableCommand: true})

        expect(result.pass).toBe(false)
        expect(result.reason).toBe('echo_detected')
      })

      it('should pass all validations for valid output', () => {
        const store = {
          getOutput: () => ({
            nodes: [{id: '1', title: 'Different from prompt'}],
            edges: [],
          }),
        }

        const result = CandidateEvaluator.validate(store, 'original prompt')

        expect(result.pass).toBe(true)
        expect(result.reason).toBeNull()
      })
    })
  })
})
