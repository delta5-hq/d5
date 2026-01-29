/**
 * Data Serializer Test Suite
 * 
 * Tests animation data serialization for embedding in generated JS.
 */

import { describe, it, expect } from 'vitest';
import { serializeAnimationData } from '../data-serializer.js';
import type { LottieAnimation } from '../../parser/lottie-types.js';

describe('serializeAnimationData', () => {
  it('should serialize animation to JSON string', () => {
    const animation: LottieAnimation = {
      v: '5.7.4',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'test',
      ddd: 0,
      assets: [],
      layers: []
    };
    
    const result = serializeAnimationData(animation);
    
    expect(typeof result).toBe('string');
    expect(JSON.parse(result)).toEqual(animation);
  });

  it('should preserve all animation properties', () => {
    const animation: LottieAnimation = {
      v: '5.7.4',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'test',
      ddd: 0,
      assets: [{ id: 'asset1', layers: [] }],
      layers: [{
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Layer',
        sr: 1,
        ao: 0,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [256, 256, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ip: 0,
        op: 180,
        st: 0,
        bm: 0,
        shapes: []
      }]
    };
    
    const result = serializeAnimationData(animation);
    const parsed = JSON.parse(result) as LottieAnimation;
    
    expect(parsed.assets).toHaveLength(1);
    expect(parsed.layers).toHaveLength(1);
    expect(parsed.layers[0].ks.o).toEqual({ a: 0, k: 100 });
  });

  it('should handle nested structures', () => {
    const animation: LottieAnimation = {
      v: '5.7.4',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'test',
      ddd: 0,
      assets: [],
      layers: [{
        ddd: 0,
        ind: 1,
        ty: 4,
        nm: 'Layer',
        sr: 1,
        ao: 0,
        ks: {
          o: { a: 0, k: 100 },
          r: { a: 0, k: 0 },
          p: { a: 0, k: [0, 0, 0] },
          a: { a: 0, k: [0, 0, 0] },
          s: { a: 0, k: [100, 100, 100] },
        },
        ip: 0,
        op: 180,
        st: 0,
        bm: 0,
        shapes: [{
          ty: 'gr',
          it: [
            { ty: 'sh', ks: { a: 0, k: { v: [[0, 0]], i: [[0, 0]], o: [[0, 0]], c: false } } },
            { ty: 'fl', c: { a: 0, k: [1, 0, 0, 1] } }
          ]
        }]
      }]
    };
    
    const result = serializeAnimationData(animation);
    const parsed = JSON.parse(result) as LottieAnimation;
    
    expect((parsed.layers[0].shapes as unknown[])[0]).toHaveProperty('ty', 'gr');
  });

  it('should format with indentation', () => {
    const animation: LottieAnimation = {
      v: '5.7.4',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'test',
      ddd: 0,
      assets: [],
      layers: []
    };
    
    const result = serializeAnimationData(animation);
    
    expect(result).toContain('\n');
    expect(result).toContain('  ');
  });

  it('should handle empty layers', () => {
    const animation: LottieAnimation = {
      v: '5.7.4',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'empty',
      ddd: 0,
      assets: [],
      layers: []
    };
    
    const result = serializeAnimationData(animation);
    expect((JSON.parse(result) as LottieAnimation).layers).toEqual([]);
  });
});
