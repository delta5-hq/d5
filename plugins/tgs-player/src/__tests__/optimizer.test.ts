import { describe, it, expect } from 'vitest';
import { Optimizer } from '../optimizer/optimizer.js';
import type { LottieAnimation } from '../parser/lottie-types.js';

/* Mock animation with static and animated properties */
const mockAnimation: LottieAnimation = {
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 180,
  w: 512,
  h: 512,
  nm: 'test',
  ddd: 0,
  assets: [],
  layers: [
    {
      ddd: 0,
      ind: 1,
      ty: 4,
      nm: 'Shape Layer',
      sr: 1,
      ks: {
        o: { a: 0, k: 100 },
        r: { a: 0, k: 0 },
        p: { a: 0, k: [256, 256, 0] },
        a: { a: 0, k: [0, 0, 0] },
        s: { a: 0, k: [100, 100, 100] },
      },
      ao: 0,
      /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      shapes: [
        {
          ty: 'rc',
          d: 1,
          s: { a: 0, k: [100, 100] },
          p: { a: 0, k: [0, 0] },
          nm: 'Rectangle',
        },
        {
          ty: 'fl',
          c: { a: 0, k: [1, 0, 0, 1] },
          o: { a: 1, k: [
            { t: 0, s: [100], e: [50] },
            { t: 180, s: [50], e: [100] }
          ]},
          nm: 'Fill',
        } as any,
      ] as any,
      /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
      ip: 0,
      op: 180,
      st: 0,
      bm: 0,
    },
  ],
};

describe('Optimizer Integration', () => {
  it('should optimize animation and reduce size', () => {
    const optimizer = new Optimizer();
    const result = optimizer.optimize(mockAnimation);
    
    expect(result.bundle).toBeDefined();
    expect(result.stats.originalSize).toBeGreaterThan(0);
    expect(result.stats.optimizedSize).toBeGreaterThan(0);
    expect(result.stats.compressionRatio).toBeGreaterThan(0);
    expect(result.stats.compressionRatio).toBeLessThan(100);
  });

  it('should classify static vs animated properties', () => {
    const optimizer = new Optimizer();
    const result = optimizer.optimize(mockAnimation);
    
    expect(result.stats.staticPropsCount).toBeGreaterThan(0);
    expect(result.stats.animatedPropsCount).toBeGreaterThan(0);
  });

  it('should generate valid optimized bundle structure', () => {
    const optimizer = new Optimizer();
    const result = optimizer.optimize(mockAnimation);
    
    expect(result.bundle.version).toBe('1.0.0-optimized');
    expect(result.bundle.metadata).toBeDefined();
    expect(result.bundle.metadata.staticCount).toBe(result.stats.staticPropsCount);
    expect(result.bundle.metadata.animatedCount).toBe(result.stats.animatedPropsCount);
  });
});
