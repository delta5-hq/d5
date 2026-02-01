import { describe, it, expect } from 'vitest';
import { extractMetadata } from './metadata-extractor.js';
import type { LottieAnimation } from './lottie-types.js';

describe('extractMetadata', () => {
  it('extracts basic animation properties', () => {
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
      layers: [],
      tgs: 1,
    };

    const metadata = extractMetadata(animation);

    expect(metadata.name).toBe('Test Animation');
    expect(metadata.frameRate).toBe(60);
    expect(metadata.totalFrames).toBe(180);
    expect(metadata.duration).toBe(3);
    expect(metadata.width).toBe(512);
    expect(metadata.height).toBe(512);
    expect(metadata.isTgs).toBe(true);
  });
});
