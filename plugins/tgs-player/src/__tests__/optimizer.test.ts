/**
 * Optimizer Test Suite
 * 
 * Tests static property analysis and pre-computation of values.
 * Covers PropertyAnalyzer, StaticValueComputer, and in-place precomputation.
 * Tests both unit behavior and integration with real TGS data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PropertyAnalyzer } from '../optimizer/property-analyzer.js';
import { StaticValueComputer } from '../optimizer/static-value-computer.js';
import { precomputeStaticValues } from '../optimizer/precompute-static.js';
import { decompressTgs } from '../parser/tgs-decompressor.js';
import type { LottieAnimation } from '../parser/lottie-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = resolve(__dirname, '../../input/NewsEmoji');

/* Test stickers with known property distributions */
const TEST_STICKERS = [
  { id: '012', expectedStaticRatio: 0.80 }, // 80.6% static
  { id: '021', expectedStaticRatio: 0.96 }, // 96.8% static
  { id: '073', expectedStaticRatio: 0.81 }, // 81.3% static
];

describe('PropertyAnalyzer', () => {
  const analyzer = new PropertyAnalyzer();

  it('should classify static properties (a=0)', () => {
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [256, 256, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
        shapes: [{ ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 } } as any]
        /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
      }]
    };

    const result = analyzer.classify(animation);
    
    expect(result.static.length).toBeGreaterThan(0);
    expect(result.animated.length).toBe(0);
  });

  it('should classify animated properties (a=1)', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {
          o: { a: 1, k: [{ t: 0, s: [100], e: [50] }, { t: 180, s: [50] }] },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [0, 0, 0] },
        } as any,
        shapes: []
      }]
    };
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

    const result = analyzer.classify(animation);
    
    expect(result.animated.length).toBeGreaterThan(0);
    const opacityProp = result.animated.find(p => p.path.includes('.o'));
    expect(opacityProp).toBeDefined();
  });

  it('should handle empty animation', () => {
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const result = analyzer.classify(animation);
    
    expect(result.static).toEqual([]);
    expect(result.animated).toEqual([]);
  });

  it('should handle missing properties with defaults', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {} as any,
        shapes: []
      }]
    };
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

    const result = analyzer.classify(animation);
    
    /* Missing properties should not be classified */
    expect(result.static.length + result.animated.length).toBe(0);
  });

  it('should correctly identify color properties', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {} as any,
        shapes: [{ ty: 'fl', c: { a: 0, k: [1, 0.5, 0, 1] }, o: { a: 0, k: 100 } } as any]
      }]
    };
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

    const result = analyzer.classify(animation);
    
    const colorProp = result.static.find(p => p.type === 'color');
    expect(colorProp).toBeDefined();
    expect(colorProp?.value).toEqual([1, 0.5, 0, 1]);
  });

  it('should correctly identify opacity properties', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: { o: { a: 0, k: 75 }, p: { a: 0, k: [0, 0, 0] } } as any,
        shapes: []
      }]
    };
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

    const result = analyzer.classify(animation);
    
    const opacityProp = result.static.find(p => p.type === 'opacity');
    expect(opacityProp).toBeDefined();
    expect(opacityProp?.value).toBe(75);
  });
});

describe('StaticValueComputer', () => {
  const computer = new StaticValueComputer();

  it('should compute CSS color from RGB array', () => {
    const staticProps = [{
      path: 'layers[0].shapes[0].c',
      value: [1, 0, 0, 1],
      type: 'color' as const
    }];

    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const result = computer.compute(animation, staticProps);
    
    expect(result).toHaveLength(1);
    expect(result[0].computedValue).toBe('rgb(255,0,0)');
    expect(result[0].format).toBe('css-color');
  });

  it('should compute CSS color with alpha', () => {
    const staticProps = [{
      path: 'layers[0].shapes[0].c',
      value: [0, 0.5, 1, 0.8],
      type: 'color' as const
    }];

    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const result = computer.compute(animation, staticProps);
    
    expect(result[0].computedValue).toBe('rgba(0,128,255,0.8)');
    expect(result[0].format).toBe('css-color');
  });

  it('should normalize opacity to 0-1 range', () => {
    const staticProps = [{
      path: 'layers[0].ks.o',
      value: 75,
      type: 'opacity' as const
    }];

    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const result = computer.compute(animation, staticProps);
    
    expect(result[0].computedValue).toBe(0.75);
    expect(result[0].format).toBe('number');
  });

  it('should handle invalid color arrays gracefully', () => {
    const staticProps = [{
      path: 'layers[0].shapes[0].c',
      value: [1, 0],
      type: 'color' as const
    }];

    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const result = computer.compute(animation, staticProps);
    
    expect(result[0].computedValue).toBe('transparent');
    expect(result[0].format).toBe('css-color');
  });

  it('should compute transform coordinates', () => {
    const staticProps = [{
      path: 'layers[0].ks.p',
      value: [100, 200],
      type: 'transform' as const
    }];

    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const result = computer.compute(animation, staticProps);
    
    expect(result[0].computedValue).toEqual({ x: 100, y: 200 });
    expect(result[0].format).toBe('transform-matrix');
  });

  it('should handle edge case: all color channels at boundary (0 and 1)', () => {
    const staticProps = [{
      path: 'test.c',
      value: [0, 1, 0, 1],
      type: 'color' as const
    }];

    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const result = computer.compute(animation, staticProps);
    
    expect(result[0].computedValue).toBe('rgb(0,255,0)');
  });
});

describe('precomputeStaticValues', () => {
  it('should precompute static color values in-place', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {} as any,
        shapes: [{ ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] }, o: { a: 0, k: 100 } } as any]
      }]
    };
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment */

    const stats = precomputeStaticValues(animation);
    
    expect(stats.colorsPrecomputed).toBeGreaterThan(0);
    expect(stats.totalStatic).toBeGreaterThan(0);
    
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    /* Verify in-place mutation */
    const fill = (animation.layers[0].shapes as any)[0];
    expect(typeof fill.c.k).toBe('string');
    expect(fill.c.k).toBe('rgb(255,0,0)');
    expect(fill.c._precomputed).toBe(true);
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  });

  it('should not modify animated properties', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {} as any,
        shapes: [{ ty: 'fl', c: { a: 1, k: [{ t: 0, s: [1,0,0,1], e: [0,1,0,1] }] }, o: { a: 0, k: 100 } } as any]
      }]
    };

    const stats = precomputeStaticValues(animation);
    
    expect(stats.colorsPrecomputed).toBe(0);
    
    /* Verify animated property unchanged */
    const fill = (animation.layers[0].shapes as any)[0];
    expect(Array.isArray(fill.c.k)).toBe(true);
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  });

  it('should handle empty animation', () => {
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [], layers: []
    };

    const stats = precomputeStaticValues(animation);
    
    expect(stats.colorsPrecomputed).toBe(0);
    expect(stats.totalStatic).toBe(0);
  });

  it('should handle RGBA colors with alpha channel', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {} as any,
        shapes: [{ ty: 'fl', c: { a: 0, k: [1, 0, 0, 0.5] }, o: { a: 0, k: 100 } } as any]
      }]
    };

    const stats = precomputeStaticValues(animation);
    
    expect(stats.colorsPrecomputed).toBe(1);
    
    const fill = (animation.layers[0].shapes as any)[0];
    expect(fill.c.k).toBe('rgba(255,0,0,0.5)');
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  });

  it('should handle non-color static properties without errors', () => {
    const animation: LottieAnimation = {
      v: '5.7.4', fr: 60, ip: 0, op: 180, w: 512, h: 512, nm: 'test', ddd: 0, assets: [],
      layers: [{
        ddd: 0, ind: 1, ty: 4, nm: 'Layer', sr: 1, ao: 0, ip: 0, op: 180, st: 0, bm: 0,
        ks: {
          o: { a: 0, k: 100 },
          p: { a: 0, k: [256, 256] },
        },
        shapes: []
      }]
    };

    const stats = precomputeStaticValues(animation);
    
    expect(stats.totalStatic).toBeGreaterThan(0);
    expect(stats.colorsPrecomputed).toBe(0);
  });
});

describe('Real TGS Integration', () => {
  const testData: Array<{ id: string; animation: LottieAnimation }> = [];

  beforeAll(() => {
    for (const sticker of TEST_STICKERS) {
      const tgsPath = resolve(INPUT_DIR, `NewsEmoji_${sticker.id}.tgs`);
      const buffer = readFileSync(tgsPath);
      const animation = decompressTgs(new Uint8Array(buffer));
      testData.push({ id: sticker.id, animation });
    }
  });

  for (const sticker of TEST_STICKERS) {
    describe(`Sticker ${sticker.id}`, () => {
      let animation: LottieAnimation;
      let analyzer: PropertyAnalyzer;

      beforeAll(() => {
        const data = testData.find(d => d.id === sticker.id);
        if (!data) throw new Error(`Test data not found for ${sticker.id}`);
        animation = data.animation;
        analyzer = new PropertyAnalyzer();
      });

      it('should have majority static properties', () => {
        const result = analyzer.classify(animation);
        const total = result.static.length + result.animated.length;
        
        expect(total).toBeGreaterThan(0);
        const staticRatio = result.static.length / total;
        expect(staticRatio).toBeGreaterThan(sticker.expectedStaticRatio);
      });

      it('should precompute static colors without errors', () => {
        const animationCopy = JSON.parse(JSON.stringify(animation)) as LottieAnimation;
        const stats = precomputeStaticValues(animationCopy);
        
        expect(stats.totalStatic).toBeGreaterThan(0);
        expect(stats.colorsPrecomputed).toBeGreaterThanOrEqual(0);
      });

      it('should classify properties consistently', () => {
        const result1 = analyzer.classify(animation);
        const result2 = analyzer.classify(animation);
        
        expect(result1.static.length).toBe(result2.static.length);
        expect(result1.animated.length).toBe(result2.animated.length);
      });
    });
  }
});
