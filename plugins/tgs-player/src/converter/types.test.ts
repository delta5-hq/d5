import { describe, it, expect } from 'vitest';
import { DEFAULT_OPTIONS } from './types.js';

describe('ConversionOptions', () => {
  it('has correct default values', () => {
    expect(DEFAULT_OPTIONS.outputFormat).toBe('standalone');
    expect(DEFAULT_OPTIONS.minify).toBe(false);
    expect(DEFAULT_OPTIONS.embedAnimation).toBe(true);
  });
});
