import { describe, it, expect } from 'vitest';
import { validateAnimation } from './animation-validator.js';
import type { LottieAnimation } from './lottie-types.js';

describe('validateAnimation', () => {
  it('validates correct animation structure', () => {
    const animation: LottieAnimation = {
      v: '5.5.2',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'Test',
      ddd: 0,
      assets: [],
      layers: [
        {
          ddd: 0,
          ind: 1,
          ty: 4,
          nm: 'Layer',
          sr: 1,
          ks: { p: { a: 0, k: [0, 0] } },
          ao: 0,
          ip: 0,
          op: 180,
          st: 0,
          bm: 0,
        },
      ],
    };

    const result = validateAnimation(animation);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects invalid frame rate', () => {
    const animation = {
      fr: -1,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      layers: [],
    };

    const result = validateAnimation(animation);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid frame rate');
  });

  it('rejects missing layers', () => {
    const animation = {
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
    };

    const result = validateAnimation(animation);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Missing layers array');
  });

  it('warns about empty layers', () => {
    const animation = {
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      layers: [],
    };

    const result = validateAnimation(animation);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toContain('Animation has no layers');
  });
});
