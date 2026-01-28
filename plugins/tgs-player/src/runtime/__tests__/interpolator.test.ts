/**
 * Interpolator Test Suite
 * 
 * Tests keyframe interpolation for Lottie animations.
 * Covers lerp, array interpolation, keyframe finding, bezier easing, and path interpolation.
 */

import { describe, it, expect } from 'vitest';

/* Extract Interpolator logic for testing (runtime code is string, so we recreate logic) */
const Interpolator = {
  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  lerpArray(a: number[], b: number[] | undefined, t: number): number[] {
    const bArr = b && Array.isArray(b) ? b : a;
    const result = new Array(a.length);
    for (let i = 0; i < a.length; i++) {
      result[i] = this.lerp(a[i], bArr[i] ?? a[i], t);
    }
    return result;
  },

  unwrapScalar(val: number | number[]): number | number[] {
    if (Array.isArray(val) && val.length === 1) return val[0];
    return val;
  },

  findKeyframeIndex(keyframes: Array<{ t: number }>, frame: number): number {
    for (let i = 0; i < keyframes.length - 1; i++) {
      if (frame >= keyframes[i].t && frame < keyframes[i + 1].t) {
        return i;
      }
    }
    return Math.max(0, keyframes.length - 2);
  },

  extractBezierHandle(handle: number | number[] | undefined, index: number): number {
    if (!handle) return 0;
    return Array.isArray(handle) ? handle[index] : handle;
  },

  interpolateProperty(property: { a: number; k: unknown }, frame: number): unknown {
    if (property.a === 0) return property.k;

    const keyframes = property.k as Array<{ t: number; s: number[]; e?: number[]; o?: unknown; i?: unknown }>;
    if (!keyframes || keyframes.length === 0) return 0;
    
    if (frame <= keyframes[0].t) return this.unwrapScalar(keyframes[0].s);
    
    const lastKf = keyframes[keyframes.length - 1];
    if (frame >= lastKf.t) return this.unwrapScalar(lastKf.s);

    const idx = this.findKeyframeIndex(keyframes, frame);
    const kf = keyframes[idx];
    const nextKf = keyframes[idx + 1];

    const duration = nextKf.t - kf.t;
    if (duration === 0) return this.unwrapScalar(kf.s);
    
    const elapsed = frame - kf.t;
    const t = elapsed / duration;

    const startVal = kf.s;
    const endVal = kf.e || nextKf.s;

    if (Array.isArray(startVal)) {
      const result = this.lerpArray(startVal, endVal, t);
      return this.unwrapScalar(result);
    }
    return this.lerp(startVal[0], (endVal as number[])[0], t);
  },

  lerpPoints(a: number[][], b: number[][], t: number): number[][] {
    const result = new Array(Math.min(a.length, b.length));
    for (let i = 0; i < result.length; i++) {
      result[i] = this.lerpArray(a[i], b[i], t);
    }
    return result;
  }
};

describe('Interpolator.lerp', () => {
  it('should return start value at t=0', () => {
    expect(Interpolator.lerp(0, 100, 0)).toBe(0);
  });

  it('should return end value at t=1', () => {
    expect(Interpolator.lerp(0, 100, 1)).toBe(100);
  });

  it('should return midpoint at t=0.5', () => {
    expect(Interpolator.lerp(0, 100, 0.5)).toBe(50);
  });

  it('should handle negative values', () => {
    expect(Interpolator.lerp(-100, 100, 0.5)).toBe(0);
  });

  it('should handle t outside 0-1 range', () => {
    expect(Interpolator.lerp(0, 100, 1.5)).toBe(150);
    expect(Interpolator.lerp(0, 100, -0.5)).toBe(-50);
  });
});

describe('Interpolator.lerpArray', () => {
  it('should interpolate each element', () => {
    const result = Interpolator.lerpArray([0, 0], [100, 200], 0.5);
    expect(result).toEqual([50, 100]);
  });

  it('should handle undefined b array by using a', () => {
    const result = Interpolator.lerpArray([10, 20], undefined, 0.5);
    expect(result).toEqual([10, 20]);
  });

  it('should handle missing elements in b by using a values', () => {
    const result = Interpolator.lerpArray([10, 20, 30], [100], 0.5);
    expect(result[0]).toBe(55);
    expect(result[1]).toBe(20);
    expect(result[2]).toBe(30);
  });

  it('should handle empty arrays', () => {
    const result = Interpolator.lerpArray([], [], 0.5);
    expect(result).toEqual([]);
  });
});

describe('Interpolator.unwrapScalar', () => {
  it('should unwrap single-element array', () => {
    expect(Interpolator.unwrapScalar([42])).toBe(42);
  });

  it('should preserve multi-element array', () => {
    expect(Interpolator.unwrapScalar([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('should preserve scalar value', () => {
    expect(Interpolator.unwrapScalar(42)).toBe(42);
  });

  it('should handle empty array', () => {
    expect(Interpolator.unwrapScalar([])).toEqual([]);
  });
});

describe('Interpolator.findKeyframeIndex', () => {
  const keyframes = [{ t: 0 }, { t: 30 }, { t: 60 }, { t: 90 }];

  it('should find correct index in middle', () => {
    expect(Interpolator.findKeyframeIndex(keyframes, 45)).toBe(1);
  });

  it('should find first keyframe at start', () => {
    expect(Interpolator.findKeyframeIndex(keyframes, 0)).toBe(0);
  });

  it('should find last segment at end', () => {
    expect(Interpolator.findKeyframeIndex(keyframes, 89)).toBe(2);
  });

  it('should clamp to last valid index for frames beyond end', () => {
    expect(Interpolator.findKeyframeIndex(keyframes, 100)).toBe(2);
  });

  it('should handle exact keyframe times', () => {
    expect(Interpolator.findKeyframeIndex(keyframes, 30)).toBe(1);
    expect(Interpolator.findKeyframeIndex(keyframes, 60)).toBe(2);
  });
});

describe('Interpolator.extractBezierHandle', () => {
  it('should extract from array', () => {
    expect(Interpolator.extractBezierHandle([0.5, 0.7], 0)).toBe(0.5);
    expect(Interpolator.extractBezierHandle([0.5, 0.7], 1)).toBe(0.7);
  });

  it('should return scalar as-is', () => {
    expect(Interpolator.extractBezierHandle(0.5, 0)).toBe(0.5);
  });

  it('should return 0 for undefined', () => {
    expect(Interpolator.extractBezierHandle(undefined, 0)).toBe(0);
  });
});

describe('Interpolator.interpolateProperty', () => {
  it('should return static value for a=0', () => {
    const prop = { a: 0, k: [100, 200] };
    expect(Interpolator.interpolateProperty(prop, 50)).toEqual([100, 200]);
  });

  it('should return first keyframe value before animation start', () => {
    const prop = {
      a: 1,
      k: [
        { t: 30, s: [0] },
        { t: 60, s: [100] }
      ]
    };
    expect(Interpolator.interpolateProperty(prop, 0)).toBe(0);
  });

  it('should return last keyframe value after animation end', () => {
    const prop = {
      a: 1,
      k: [
        { t: 0, s: [0] },
        { t: 60, s: [100] }
      ]
    };
    expect(Interpolator.interpolateProperty(prop, 100)).toBe(100);
  });

  it('should interpolate between keyframes', () => {
    const prop = {
      a: 1,
      k: [
        { t: 0, s: [0], e: [100] },
        { t: 100, s: [100] }
      ]
    };
    expect(Interpolator.interpolateProperty(prop, 50)).toBe(50);
  });

  it('should handle empty keyframes', () => {
    const prop = { a: 1, k: [] };
    expect(Interpolator.interpolateProperty(prop, 50)).toBe(0);
  });
});

describe('Interpolator.lerpPoints', () => {
  it('should interpolate 2D point arrays', () => {
    const a = [[0, 0], [10, 10]];
    const b = [[100, 100], [110, 110]];
    const result = Interpolator.lerpPoints(a, b, 0.5);
    expect(result).toEqual([[50, 50], [60, 60]]);
  });

  it('should handle different length arrays by using minimum', () => {
    const a = [[0, 0], [10, 10], [20, 20]];
    const b = [[100, 100]];
    const result = Interpolator.lerpPoints(a, b, 0.5);
    expect(result).toHaveLength(1);
  });

  it('should handle empty arrays', () => {
    const result = Interpolator.lerpPoints([], [], 0.5);
    expect(result).toEqual([]);
  });
});
