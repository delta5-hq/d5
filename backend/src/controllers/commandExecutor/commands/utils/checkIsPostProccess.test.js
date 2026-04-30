import {checkIsPostProccess} from './checkIsPostProccess'

describe('checkIsPostProccess', () => {
  describe('post-processing commands', () => {
    it('should identify /foreach as post-process', () => {
      expect(checkIsPostProccess('/foreach')).toBeTruthy()
      expect(checkIsPostProccess('/foreach item in @list')).toBeTruthy()
    })

    it('should identify /summarize as post-process', () => {
      expect(checkIsPostProccess('/summarize')).toBeTruthy()
      expect(checkIsPostProccess('/summarize with params')).toBeTruthy()
    })

    it('should identify /outline with summarize param as post-process', () => {
      expect(checkIsPostProccess('/outline --summarize')).toBeTruthy()
      expect(checkIsPostProccess('/outline --summarize --other')).toBeTruthy()
    })

    it('should not identify /outline without summarize param', () => {
      expect(checkIsPostProccess('/outline')).toBeFalsy()
      expect(checkIsPostProccess('/outline --levels=3')).toBeFalsy()
    })
  })

  describe('meta-instruction commands', () => {
    it('should identify /refine as requiring exclusion', () => {
      expect(checkIsPostProccess('/refine')).toBeTruthy()
      expect(checkIsPostProccess('/refine with instructions')).toBeTruthy()
    })

    it('should identify /validate as requiring exclusion', () => {
      expect(checkIsPostProccess('/validate')).toBeTruthy()
      expect(checkIsPostProccess('/validate criteria here')).toBeTruthy()
    })
  })

  describe('regular commands', () => {
    it('should not identify LLM commands as post-process', () => {
      expect(checkIsPostProccess('/claude')).toBeFalsy()
      expect(checkIsPostProccess('/chat')).toBeFalsy()
      expect(checkIsPostProccess('/perplexity')).toBeFalsy()
    })

    it('should not identify orchestrator commands as post-process', () => {
      expect(checkIsPostProccess('/steps')).toBeFalsy()
      expect(checkIsPostProccess('/switch')).toBeFalsy()
    })

    it('should not identify utility commands as post-process', () => {
      expect(checkIsPostProccess('/web')).toBeFalsy()
      expect(checkIsPostProccess('/scholar')).toBeFalsy()
      expect(checkIsPostProccess('/download')).toBeFalsy()
    })

    it('should not identify regular text as post-process', () => {
      expect(checkIsPostProccess('regular content')).toBeFalsy()
      expect(checkIsPostProccess('text mentioning /validate')).toBeFalsy()
      expect(checkIsPostProccess('  leading spaces')).toBeFalsy()
    })
  })

  describe('edge cases', () => {
    it('should handle empty string', () => {
      expect(checkIsPostProccess('')).toBeFalsy()
    })

    it('should handle null/undefined gracefully via falsy check', () => {
      // checkIsPostProccess uses str.startsWith which will throw on null
      // This documents the current behavior - caller must provide string
      expect(() => checkIsPostProccess(null)).toThrow()
      expect(() => checkIsPostProccess(undefined)).toThrow()
    })

    it('should be case-sensitive', () => {
      expect(checkIsPostProccess('/VALIDATE')).toBeFalsy()
      expect(checkIsPostProccess('/Refine')).toBeFalsy()
      expect(checkIsPostProccess('/FOREACH')).toBeFalsy()
    })

    it('should require exact prefix match', () => {
      expect(checkIsPostProccess('pre/validate')).toBeFalsy()
      expect(checkIsPostProccess(' /validate')).toBeFalsy()
    })
  })
})
