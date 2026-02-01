import { describe, it, expect } from 'vitest';
import { TgsConverter } from './tgs-converter.js';
import type { LottieAnimation } from '../parser/lottie-types.js';

describe('TgsConverter - Advanced Features', () => {
  it('handles trim paths in animation', () => {
    const animation: LottieAnimation = {
      v: '5.5.2',
      fr: 60,
      ip: 0,
      op: 60,
      w: 512,
      h: 512,
      nm: 'Test Trim',
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
                  ty: 'st',
                  nm: 'Stroke',
                  c: { a: 0, k: [1, 0, 0, 1] },
                  o: { a: 0, k: 100 },
                  w: { a: 0, k: 2 },
                },
                {
                  ty: 'tm',
                  nm: 'Trim Paths',
                  s: { a: 0, k: 0 },
                  e: { a: 0, k: 50 },
                  o: { a: 0, k: 0 },
                  m: 1,
                },
              ],
            },
          ],
          ip: 0,
          op: 60,
          st: 0,
          bm: 0,
        },
      ],
    };

    const converter = new TgsConverter();
    const result = converter.convertFromJson(JSON.stringify(animation));

    expect(result.code).toContain('TrimPaths');
    expect(result.code).toContain('getTotalLength');
    expect(result.code).toContain('stroke-dasharray');
  });

  it('handles gradient fills in animation', () => {
    const animation: LottieAnimation = {
      v: '5.5.2',
      fr: 60,
      ip: 0,
      op: 60,
      w: 512,
      h: 512,
      nm: 'Test Gradient',
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
                  ty: 'gf',
                  nm: 'Gradient Fill',
                  o: { a: 0, k: 100 },
                  t: 1,
                  g: {
                    p: 2,
                    k: { a: 0, k: [0, 1, 0, 0, 1, 0, 0, 1] },
                  },
                  s: { a: 0, k: [0, 0] },
                  e2: { a: 0, k: [100, 100] },
                },
              ],
            },
          ],
          ip: 0,
          op: 60,
          st: 0,
          bm: 0,
        },
      ],
    };

    const converter = new TgsConverter();
    const result = converter.convertFromJson(JSON.stringify(animation));

    expect(result.code).toContain('GradientBuilder');
    expect(result.code).toContain('linearGradient');
    expect(result.code).toContain('stop');
  });

  it('handles debug logging infrastructure', () => {
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

    const converter = new TgsConverter();
    const result = converter.convertFromJson(JSON.stringify(animation));

    expect(result.code).toContain('DebugLogger');
    expect(result.code).toContain('TGS_DEBUG');
    expect(result.code).toContain('feature(');
  });
});
