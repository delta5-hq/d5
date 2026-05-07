import {
  stripReliabilitySuffix,
  buildCandidateSuffix,
  buildGateFailureSuffix,
  buildFirstSurvivorSuffix,
  buildJudgeAuthErrorSuffix,
  buildJudgeQuotaErrorSuffix,
  buildJudgmentSuffix,
  REFINED_SUFFIX,
  REFINE_FAILURE_SUFFIX,
} from './reliabilitySuffix'

describe('reliabilitySuffix', () => {
  describe('signal characters', () => {
    it.each([
      ['buildCandidateSuffix', buildCandidateSuffix(2, 3)],
      ['buildFirstSurvivorSuffix', buildFirstSurvivorSuffix(2, 3)],
      ['buildJudgeAuthErrorSuffix', buildJudgeAuthErrorSuffix(2, 3)],
      ['buildJudgeQuotaErrorSuffix', buildJudgeQuotaErrorSuffix(2, 3)],
      ['REFINED_SUFFIX', REFINED_SUFFIX],
    ])('%s uses the ✓ success signal', (_label, suffix) => {
      expect(suffix).toMatch(/^\[✓/)
    })

    it.each([
      ['buildGateFailureSuffix', buildGateFailureSuffix(3)],
      ['REFINE_FAILURE_SUFFIX', REFINE_FAILURE_SUFFIX],
    ])('%s uses the ✗ failure signal', (_label, suffix) => {
      expect(suffix).toMatch(/^\[✗/)
    })
  })

  describe('buildCandidateSuffix', () => {
    it.each([
      [2, 3, '[✓ 2/3 best of 3]'],
      [1, 5, '[✓ 1/5 best of 5]'],
      [1, 1, '[✓ 1/1 best of 1]'],
      [3, 3, '[✓ 3/3 best of 3]'],
    ])('encodes %d/%d as "%s"', (passed, total, expected) => {
      expect(buildCandidateSuffix(passed, total)).toBe(expected)
    })
  })

  describe('buildGateFailureSuffix', () => {
    it.each([
      [1, '[✗ 0/1 passed]'],
      [3, '[✗ 0/3 passed]'],
      [5, '[✗ 0/5 passed]'],
    ])('always encodes zero passes for N=%d', (total, expected) => {
      expect(buildGateFailureSuffix(total)).toBe(expected)
    })
  })

  describe('buildFirstSurvivorSuffix', () => {
    it.each([
      [2, 3, '[✓ 2/3 first-survivor · no judge]'],
      [1, 5, '[✓ 1/5 first-survivor · no judge]'],
      [1, 1, '[✓ 1/1 first-survivor · no judge]'],
    ])('encodes %d/%d with first-survivor label as "%s"', (passed, total, expected) => {
      expect(buildFirstSurvivorSuffix(passed, total)).toBe(expected)
    })
  })

  describe('buildJudgeAuthErrorSuffix', () => {
    it.each([
      [2, 3, '[✓ 2/3 first-survivor · judge auth error]'],
      [1, 5, '[✓ 1/5 first-survivor · judge auth error]'],
    ])('encodes %d/%d as "%s"', (passed, total, expected) => {
      expect(buildJudgeAuthErrorSuffix(passed, total)).toBe(expected)
    })
  })

  describe('buildJudgeQuotaErrorSuffix', () => {
    it.each([
      [2, 3, '[✓ 2/3 first-survivor · judge quota exceeded]'],
      [1, 5, '[✓ 1/5 first-survivor · judge quota exceeded]'],
    ])('encodes %d/%d as "%s"', (passed, total, expected) => {
      expect(buildJudgeQuotaErrorSuffix(passed, total)).toBe(expected)
    })
  })

  describe('buildJudgmentSuffix', () => {
    it('routes reason=null to buildCandidateSuffix', () => {
      const judgment = {reason: null, confidence: 0.87}
      expect(buildJudgmentSuffix(judgment, 2, 3)).toBe(buildCandidateSuffix(2, 3, 0.87))
    })

    it('routes reason=null with null confidence to buildCandidateSuffix without score', () => {
      const judgment = {reason: null, confidence: null}
      expect(buildJudgmentSuffix(judgment, 2, 3)).toBe(buildCandidateSuffix(2, 3, null))
    })

    it('routes judge_auth_error to buildJudgeAuthErrorSuffix', () => {
      const judgment = {reason: 'judge_auth_error', confidence: null}
      expect(buildJudgmentSuffix(judgment, 2, 3)).toBe(buildJudgeAuthErrorSuffix(2, 3))
    })

    it('routes judge_quota_error to buildJudgeQuotaErrorSuffix', () => {
      const judgment = {reason: 'judge_quota_error', confidence: null}
      expect(buildJudgmentSuffix(judgment, 2, 3)).toBe(buildJudgeQuotaErrorSuffix(2, 3))
    })

    it('routes all_judge_calls_failed to buildFirstSurvivorSuffix', () => {
      const judgment = {reason: 'all_judge_calls_failed', confidence: null}
      expect(buildJudgmentSuffix(judgment, 2, 3)).toBe(buildFirstSurvivorSuffix(2, 3))
    })

    it('routes no_alternative_model_available to buildFirstSurvivorSuffix', () => {
      const judgment = {reason: 'no_alternative_model_available', confidence: null}
      expect(buildJudgmentSuffix(judgment, 2, 3)).toBe(buildFirstSurvivorSuffix(2, 3))
    })

    it('routes any unknown reason string to buildFirstSurvivorSuffix', () => {
      const judgment = {reason: 'some_future_reason', confidence: null}
      expect(buildJudgmentSuffix(judgment, 2, 3)).toBe(buildFirstSurvivorSuffix(2, 3))
    })
  })

  describe('constants', () => {
    it('REFINED_SUFFIX encodes a successful single-pass refinement', () => {
      expect(REFINED_SUFFIX).toBe('[✓ refined]')
    })

    it('REFINE_FAILURE_SUFFIX encodes a failed single-pass refinement', () => {
      expect(REFINE_FAILURE_SUFFIX).toBe('[✗ refine failed]')
    })
  })

  describe('stripReliabilitySuffix', () => {
    describe('strips every suffix type produced by this module', () => {
      it.each([
        ['buildCandidateSuffix(2,3)', buildCandidateSuffix(2, 3)],
        ['buildCandidateSuffix(1,5)', buildCandidateSuffix(1, 5)],
        ['buildGateFailureSuffix(3)', buildGateFailureSuffix(3)],
        ['buildGateFailureSuffix(5)', buildGateFailureSuffix(5)],
        ['buildFirstSurvivorSuffix(2,3)', buildFirstSurvivorSuffix(2, 3)],
        ['buildFirstSurvivorSuffix(1,5)', buildFirstSurvivorSuffix(1, 5)],
        ['buildJudgeAuthErrorSuffix(2,3)', buildJudgeAuthErrorSuffix(2, 3)],
        ['buildJudgeQuotaErrorSuffix(2,3)', buildJudgeQuotaErrorSuffix(2, 3)],
        ['REFINED_SUFFIX', REFINED_SUFFIX],
        ['REFINE_FAILURE_SUFFIX', REFINE_FAILURE_SUFFIX],
      ])('strips %s leaving the original title', (_label, suffix) => {
        expect(stripReliabilitySuffix(`base title ${suffix}`)).toBe('base title')
      })
    })

    describe('is idempotent — safe to apply on re-execution', () => {
      it.each([
        ['buildCandidateSuffix', buildCandidateSuffix(2, 3)],
        ['buildGateFailureSuffix', buildGateFailureSuffix(3)],
        ['buildFirstSurvivorSuffix', buildFirstSurvivorSuffix(2, 3)],
        ['buildJudgeAuthErrorSuffix', buildJudgeAuthErrorSuffix(2, 3)],
        ['buildJudgeQuotaErrorSuffix', buildJudgeQuotaErrorSuffix(2, 3)],
        ['REFINED_SUFFIX', REFINED_SUFFIX],
        ['REFINE_FAILURE_SUFFIX', REFINE_FAILURE_SUFFIX],
      ])('applying strip twice is equivalent to applying once for %s', (_label, suffix) => {
        const title = `base ${suffix}`
        expect(stripReliabilitySuffix(stripReliabilitySuffix(title))).toBe(stripReliabilitySuffix(title))
      })
    })

    describe('positional constraint — only strips from the trailing position', () => {
      it('preserves an annotation that appears mid-title', () => {
        const midTitle = `${buildCandidateSuffix(1, 2)} continues here`
        expect(stripReliabilitySuffix(midTitle)).toBe(midTitle)
      })

      it('leaves unrelated bracket expressions untouched', () => {
        expect(stripReliabilitySuffix('analyse competitors [important]')).toBe('analyse competitors [important]')
      })
    })

    describe('whitespace handling', () => {
      it('collapses extra whitespace between title and annotation', () => {
        expect(stripReliabilitySuffix(`title  ${REFINED_SUFFIX}`)).toBe('title')
      })

      it('is case-insensitive for the annotation keyword', () => {
        expect(stripReliabilitySuffix('title [✓ 1/1 BEST OF 1]')).toBe('title')
      })

      it('preserves the full title text preceding the annotation', () => {
        expect(stripReliabilitySuffix(`Part 1: deep analysis ${buildCandidateSuffix(2, 2)}`)).toBe(
          'Part 1: deep analysis',
        )
      })
    })

    describe('degenerate inputs', () => {
      it.each([
        ['null', null, ''],
        ['empty string', '', ''],
        ['plain title without suffix', 'plain title', 'plain title'],
      ])('handles %s gracefully', (_label, input, expected) => {
        expect(stripReliabilitySuffix(input)).toBe(expected)
      })
    })

    describe('confidence-annotated suffixes', () => {
      it('strips suffix with confidence annotation', () => {
        expect(stripReliabilitySuffix('title [✓ 2/3 best of 3 · 0.67]')).toBe('title')
      })

      it('strips suffix with full precision confidence', () => {
        expect(stripReliabilitySuffix(`base ${buildCandidateSuffix(3, 3, 1.0)}`)).toBe('base')
      })

      it('strips suffix with low confidence', () => {
        expect(stripReliabilitySuffix(`title ${buildCandidateSuffix(1, 3, 0.33)}`)).toBe('title')
      })

      it('is idempotent for confidence-annotated suffix', () => {
        const title = `base ${buildCandidateSuffix(2, 3, 0.67)}`
        expect(stripReliabilitySuffix(stripReliabilitySuffix(title))).toBe(stripReliabilitySuffix(title))
      })
    })
  })

  describe('label distinctness across error types', () => {
    it('buildJudgeAuthErrorSuffix and buildJudgeQuotaErrorSuffix carry different labels', () => {
      expect(buildJudgeAuthErrorSuffix(1, 2)).not.toBe(buildJudgeQuotaErrorSuffix(1, 2))
    })

    it('buildFirstSurvivorSuffix, buildJudgeAuthErrorSuffix, and buildJudgeQuotaErrorSuffix are all mutually distinct', () => {
      const suffixes = [
        buildFirstSurvivorSuffix(1, 2),
        buildJudgeAuthErrorSuffix(1, 2),
        buildJudgeQuotaErrorSuffix(1, 2),
      ]
      expect(new Set(suffixes).size).toBe(3)
    })
  })

  describe('buildCandidateSuffix confidence parameter', () => {
    it('omits confidence annotation when null', () => {
      expect(buildCandidateSuffix(2, 3, null)).toBe('[✓ 2/3 best of 3]')
    })

    it('omits confidence annotation when undefined', () => {
      expect(buildCandidateSuffix(2, 3, undefined)).toBe('[✓ 2/3 best of 3]')
    })

    it('omits confidence annotation when NaN', () => {
      expect(buildCandidateSuffix(2, 3, NaN)).toBe('[✓ 2/3 best of 3]')
    })

    it('includes confidence annotation when a valid fraction is supplied', () => {
      expect(buildCandidateSuffix(2, 3, 0.87)).toBe('[✓ 2/3 best of 3 · 0.87]')
    })

    it('formats confidence to two decimal places', () => {
      expect(buildCandidateSuffix(3, 3, 1.0)).toBe('[✓ 3/3 best of 3 · 1.00]')
    })

    it('includes zero confidence as a valid annotation', () => {
      expect(buildCandidateSuffix(1, 3, 0)).toBe('[✓ 1/3 best of 3 · 0.00]')
    })

    it('default confidence (no argument) omits annotation', () => {
      expect(buildCandidateSuffix(1, 5)).toBe('[✓ 1/5 best of 5]')
    })
  })
})
