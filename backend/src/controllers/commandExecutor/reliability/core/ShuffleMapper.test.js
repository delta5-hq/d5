import ShuffleMapper from './ShuffleMapper'

describe('ShuffleMapper', () => {
  describe('createShuffleMapping', () => {
    describe('permutation invariants', () => {
      it('should produce valid permutation for any count > 0', () => {
        ;[1, 2, 3, 5, 10, 100].forEach(count => {
          const {presentationOrder} = ShuffleMapper.createShuffleMapping(count)

          expect(presentationOrder).toHaveLength(count)
          expect(new Set(presentationOrder).size).toBe(count)
          expect(presentationOrder.every(idx => idx >= 0 && idx < count)).toBe(true)
        })
      })

      it('should preserve bijection property through remapper', () => {
        ;[2, 3, 10].forEach(count => {
          const {remapToOriginal} = ShuffleMapper.createShuffleMapping(count)
          const remapped = Array.from({length: count}, (_, i) => remapToOriginal(i))

          expect(new Set(remapped).size).toBe(count)
          expect(remapped.every(idx => idx >= 0 && idx < count)).toBe(true)
        })
      })
    })

    describe('boundary cases', () => {
      it('should handle single element degenerate case', () => {
        const {presentationOrder, remapToOriginal} = ShuffleMapper.createShuffleMapping(1)

        expect(presentationOrder).toEqual([0])
        expect(remapToOriginal(0)).toBe(0)
      })

      it('should handle two elements with valid permutations', () => {
        const orderings = new Set()

        for (let i = 0; i < 10; i++) {
          const {presentationOrder} = ShuffleMapper.createShuffleMapping(2)
          orderings.add(presentationOrder.join(','))
        }

        expect(orderings.size).toBeGreaterThanOrEqual(1)
        expect(orderings.size).toBeLessThanOrEqual(2)
      })
    })

    describe('error resilience', () => {
      it('should enforce fallback to index 0 for out-of-bounds inputs', () => {
        const {remapToOriginal} = ShuffleMapper.createShuffleMapping(5)

        expect(remapToOriginal(-100)).toBe(0)
        expect(remapToOriginal(-1)).toBe(0)
        expect(remapToOriginal(5)).toBe(0)
        expect(remapToOriginal(1000)).toBe(0)
        expect(remapToOriginal(Number.MAX_SAFE_INTEGER)).toBe(0)
      })
    })

    describe('randomization properties', () => {
      it('should produce non-identity permutations with high probability', () => {
        const identityCount = Array.from({length: 50}, () => {
          const {presentationOrder} = ShuffleMapper.createShuffleMapping(10)
          return presentationOrder.every((val, idx) => val === idx) ? 1 : 0
        }).reduce((a, b) => a + b, 0)

        expect(identityCount).toBeLessThan(5)
      })

      it('should produce diverse permutations across multiple calls', () => {
        const orderings = new Set()

        for (let i = 0; i < 30; i++) {
          const {presentationOrder} = ShuffleMapper.createShuffleMapping(5)
          orderings.add(presentationOrder.join(','))
        }

        expect(orderings.size).toBeGreaterThan(10)
      })
    })
  })

  describe('createIdentityMapping', () => {
    it('should produce identity permutation for any count', () => {
      ;[1, 2, 5, 10].forEach(count => {
        const {presentationOrder} = ShuffleMapper.createIdentityMapping(count)
        const expected = Array.from({length: count}, (_, i) => i)

        expect(presentationOrder).toEqual(expected)
      })
    })

    it('should preserve index-to-self mapping through remapper', () => {
      ;[3, 5, 10].forEach(count => {
        const {remapToOriginal} = ShuffleMapper.createIdentityMapping(count)

        Array.from({length: count}, (_, i) => i).forEach(idx => {
          expect(remapToOriginal(idx)).toBe(idx)
        })
      })
    })

    it('should enforce fallback for out-of-bounds indices', () => {
      const {remapToOriginal} = ShuffleMapper.createIdentityMapping(5)

      expect(remapToOriginal(-1)).toBe(0)
      expect(remapToOriginal(5)).toBe(0)
      expect(remapToOriginal(100)).toBe(0)
    })
  })

  describe('createExplicitMapping', () => {
    it('should preserve user-provided permutation exactly', () => {
      const testCases = [[0], [1, 0], [2, 0, 1], [3, 1, 0, 2]]

      testCases.forEach(order => {
        const {presentationOrder} = ShuffleMapper.createExplicitMapping(order)
        expect(presentationOrder).toEqual(order)
      })
    })

    it('should map presentation indices to original indices per explicit order', () => {
      const order = [2, 0, 1]
      const {remapToOriginal} = ShuffleMapper.createExplicitMapping(order)

      order.forEach((expectedOriginal, presentIdx) => {
        expect(remapToOriginal(presentIdx)).toBe(expectedOriginal)
      })
    })

    it('should isolate internal state from input array', () => {
      const original = [1, 0, 2]
      const {presentationOrder} = ShuffleMapper.createExplicitMapping(original)

      presentationOrder[0] = 999

      expect(original[0]).toBe(1)
    })

    it('should enforce fallback for out-of-bounds access', () => {
      const {remapToOriginal} = ShuffleMapper.createExplicitMapping([2, 1, 0])

      expect(remapToOriginal(-1)).toBe(0)
      expect(remapToOriginal(3)).toBe(0)
      expect(remapToOriginal(100)).toBe(0)
    })
  })

  describe('integration: composition properties', () => {
    it('should preserve candidate set through shuffle and remap cycle', () => {
      ;[2, 5, 10].forEach(count => {
        const candidates = Array.from({length: count}, (_, i) => `Candidate_${i}`)
        const {presentationOrder, remapToOriginal} = ShuffleMapper.createShuffleMapping(count)

        const presented = presentationOrder.map(idx => candidates[idx])
        const remapped = Array.from({length: count}, (_, i) => candidates[remapToOriginal(i)])

        expect(new Set(presented).size).toBe(count)
        expect(new Set(remapped).size).toBe(count)
        presented.forEach(c => expect(candidates).toContain(c))
        remapped.forEach(c => expect(candidates).toContain(c))
      })
    })

    it('should maintain deterministic mapping for explicit order', () => {
      const order = [2, 0, 1]
      const candidates = ['A', 'B', 'C']

      const {presentationOrder, remapToOriginal} = ShuffleMapper.createExplicitMapping(order)

      const presented = presentationOrder.map(idx => candidates[idx])
      expect(presented).toEqual(['C', 'A', 'B'])

      const indices = [0, 1, 2].map(remapToOriginal)
      expect(indices).toEqual([2, 0, 1])
    })
  })
})
