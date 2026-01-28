import { describe, it, expect } from 'vitest';
import { TgsConverter } from './tgs-converter.js';
import type { LottieAnimation } from '../parser/lottie-types.js';

describe('TgsConverter', () => {
  it('converts valid JSON animation', () => {
    const animation: LottieAnimation = {
      v: '5.5.2',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'Test Animation',
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
            p: { a: 0, k: [256, 256] },
            s: { a: 0, k: [100, 100] },
            r: { a: 0, k: 0 },
            o: { a: 0, k: 100 },
          },
          ao: 0,
          shapes: [
            {
              ty: 'gr',
              nm: 'Group',
              it: [
                {
                  ty: 'sh',
                  nm: 'Path',
                  ks: {
                    a: 0,
                    k: {
                      i: [[0, 0]],
                      o: [[0, 0]],
                      v: [[0, 0]],
                      c: true,
                    },
                  },
                },
                {
                  ty: 'fl',
                  nm: 'Fill',
                  c: { a: 0, k: [1, 0, 0, 1] },
                  o: { a: 0, k: 100 },
                },
              ],
            },
          ],
          ip: 0,
          op: 180,
          st: 0,
          bm: 0,
        },
      ],
    };

    const converter = new TgsConverter();
    const json = JSON.stringify(animation);
    const result = converter.convertFromJson(json);

    expect(result.code).toContain('TgsPlayer');
    expect(result.code).toContain('BezierEaser');
    expect(result.code).toContain('Interpolator');
    expect(result.code).toContain('SvgBuilder');
    expect(result.metadata.layerCount).toBe(1);
    expect(result.metadata.duration).toBe(3);
  });

  it('throws on invalid animation', () => {
    const converter = new TgsConverter();
    const invalidJson = JSON.stringify({ invalid: true });

    expect(() => converter.convertFromJson(invalidJson)).toThrow('Invalid animation');
  });

  it('respects conversion options', () => {
    const animation: LottieAnimation = {
      v: '5.5.2',
      fr: 60,
      ip: 0,
      op: 60,
      w: 512,
      h: 512,
      nm: 'Test',
      ddd: 0,
      assets: [],
      layers: [],
    };

    const converter = new TgsConverter({ targetId: 'custom-target' });
    const result = converter.convertFromJson(JSON.stringify(animation));

    expect(result.code).toContain('custom-target');
  });
});
