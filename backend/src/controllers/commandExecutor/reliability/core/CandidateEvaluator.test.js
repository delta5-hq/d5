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

        const result = CandidateEvaluator.validate(store, 'create table', {
          isTableCommand: true,
        })

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

        const result = CandidateEvaluator.validate(store, 'create table', {
          isTableCommand: true,
        })

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

        const result = CandidateEvaluator.validate(store, 'create table', {
          isTableCommand: true,
        })

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

        const result = CandidateEvaluator.validate(store, 'create table', {
          isTableCommand: false,
        })

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

        const result = CandidateEvaluator.validate(store, 'test', {
          isTableCommand: true,
        })

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

    describe('error content detection', () => {
      describe('rejection boundary', () => {
        it('should reject when the sole output node carries the error prefix', () => {
          const store = {
            getOutput: () => ({
              nodes: [{id: '1', title: 'Error: Unauthorized'}],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(false)
          expect(result.reason).toBe('error_content')
        })

        it('should reject when every output node carries the error prefix', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: 'Error: primary call failed'},
                {id: '2', title: 'Error: fallback also failed'},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(false)
          expect(result.reason).toBe('error_content')
        })

        it('should reject when the only meaningful node carries the error prefix', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: ''},
                {id: '2', title: '   '},
                {id: '3', title: 'Error: timed out'},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(false)
          expect(result.reason).toBe('error_content')
        })
      })

      describe('acceptance boundary', () => {
        it('should accept when no output node carries the error prefix', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: 'Red'},
                {id: '2', title: 'Blue'},
                {id: '3', title: 'Green'},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })

        it('should accept when only a subset of nodes carry the error prefix', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: 'Error: why approach X fails'},
                {id: '2', title: 'Consider alternative Y instead'},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'analyze approach X')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })

        it('should accept when all meaningful nodes have empty titles', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: ''},
                {id: '2', title: '   '},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })
      })

      describe('meaningful node filter', () => {
        it('should exclude nodes with empty-string titles from the error check', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: ''},
                {id: '2', title: 'Valid content'},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })

        it('should exclude nodes with whitespace-only titles from the error check', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: '   \t  '},
                {id: '2', title: 'Valid content'},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })

        it('should exclude nodes with null titles from the error check', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {id: '1', title: null},
                {id: '2', title: 'Valid content'},
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })

        it('should exclude nodes with undefined titles from the error check', () => {
          const store = {
            getOutput: () => ({
              nodes: [{id: '1'}, {id: '2', title: 'Valid content'}],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })
      })

      describe('prefix matching rules', () => {
        it('should treat the error prefix as case-sensitive', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {
                  id: '1',
                  title: 'error: lowercase prefix is not an error marker',
                },
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })

        it('should match the prefix after stripping leading whitespace from the title', () => {
          const store = {
            getOutput: () => ({
              nodes: [{id: '1', title: '  Error: leading spaces'}],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(false)
          expect(result.reason).toBe('error_content')
        })

        it('should not match when the error prefix appears mid-string', () => {
          const store = {
            getOutput: () => ({
              nodes: [
                {
                  id: '1',
                  title: 'Result contains Error: description mid-text',
                },
              ],
              edges: [],
            }),
          }

          const result = CandidateEvaluator.validate(store, 'list 3 colors')

          expect(result.pass).toBe(true)
          expect(result.reason).toBeNull()
        })
      })

      describe('isErrorText', () => {
        it('should return true when the string starts with the error prefix', () => {
          expect(CandidateEvaluator.isErrorText('Error: missing key')).toBe(true)
        })

        it('should return true when leading whitespace precedes the error prefix', () => {
          expect(CandidateEvaluator.isErrorText('  Error: rate limit')).toBe(true)
        })

        it('should return false when the string does not start with the error prefix', () => {
          expect(CandidateEvaluator.isErrorText('Valid response content')).toBe(false)
        })

        it('should return false for a lowercase error prefix', () => {
          expect(CandidateEvaluator.isErrorText('error: lowercase')).toBe(false)
        })

        it('should return false for an empty string', () => {
          expect(CandidateEvaluator.isErrorText('')).toBe(false)
        })

        it('should return false for null', () => {
          expect(CandidateEvaluator.isErrorText(null)).toBe(false)
        })

        it('should return false for undefined', () => {
          expect(CandidateEvaluator.isErrorText(undefined)).toBe(false)
        })
      })
    })
  })
})
