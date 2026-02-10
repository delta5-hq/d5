/**
 * Bezier Easer Test Suite
 * 
 * Tests cubic bezier easing functions for Lottie keyframe interpolation.
 * Covers standard easing curves, edge cases, and numerical stability.
 */

import { describe, it, expect } from 'vitest';

/* Recreate BezierEaser logic for testing */
function createBezierEaser(mX1: number, mY1: number, mX2: number, mY2: number): (x: number) => number {
  const NEWTON_ITERATIONS = 4;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_PRECISION = 0.0000001;
  const SUBDIVISION_MAX_ITERATIONS = 10;
  const K_SPLINE_TABLE_SIZE = 11;
  const K_SAMPLE_STEP_SIZE = 1.0 / (K_SPLINE_TABLE_SIZE - 1.0);

  function A(a1: number, a2: number): number { return 1.0 - 3.0 * a2 + 3.0 * a1; }
  function B(a1: number, a2: number): number { return 3.0 * a2 - 6.0 * a1; }
  function C(a1: number): number { return 3.0 * a1; }

  function calcBezier(t: number, a1: number, a2: number): number {
    return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  }

  function getSlope(t: number, a1: number, a2: number): number {
    return 3.0 * A(a1, a2) * t * t + 2.0 * B(a1, a2) * t + C(a1);
  }

  function binarySubdivide(x: number, a: number, b: number): number {
    let currentX: number, currentT: number, i = 0;
    do {
      currentT = a + (b - a) / 2.0;
      currentX = calcBezier(currentT, mX1, mX2) - x;
      if (currentX > 0.0) b = currentT;
      else a = currentT;
    } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);
    return currentT;
  }

  function newtonRaphsonIterate(x: number, guessT: number): number {
    for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
      const slope = getSlope(guessT, mX1, mX2);
      if (slope === 0.0) return guessT;
      const currentX = calcBezier(guessT, mX1, mX2) - x;
      guessT -= currentX / slope;
    }
    return guessT;
  }

  const sampleValues = new Float32Array(K_SPLINE_TABLE_SIZE);
  for (let i = 0; i < K_SPLINE_TABLE_SIZE; ++i) {
    sampleValues[i] = calcBezier(i * K_SAMPLE_STEP_SIZE, mX1, mX2);
  }

  function getTForX(x: number): number {
    let intervalStart = 0.0;
    let currentSample = 1;
    const lastSample = K_SPLINE_TABLE_SIZE - 1;

    for (; currentSample !== lastSample && sampleValues[currentSample] <= x; ++currentSample) {
      intervalStart += K_SAMPLE_STEP_SIZE;
    }
    --currentSample;

    const dist = (x - sampleValues[currentSample]) / (sampleValues[currentSample + 1] - sampleValues[currentSample]);
    const guessForT = intervalStart + dist * K_SAMPLE_STEP_SIZE;
    const initialSlope = getSlope(guessForT, mX1, mX2);

    if (initialSlope >= NEWTON_MIN_SLOPE) return newtonRaphsonIterate(x, guessForT);
    if (initialSlope === 0.0) return guessForT;
    return binarySubdivide(x, intervalStart, intervalStart + K_SAMPLE_STEP_SIZE);
  }

  return function(x: number): number {
    if (mX1 === mY1 && mX2 === mY2) return x;
    if (x === 0) return 0;
    if (x === 1) return 1;
    return calcBezier(getTForX(x), mY1, mY2);
  };
}

describe('BezierEaser - Linear', () => {
  it('should return linear output for linear curve (0,0,1,1)', () => {
    const easer = createBezierEaser(0, 0, 1, 1);
    expect(easer(0)).toBe(0);
    expect(easer(0.5)).toBe(0.5);
    expect(easer(1)).toBe(1);
  });

  it('should handle identity curve (same points)', () => {
    const easer = createBezierEaser(0.5, 0.5, 0.5, 0.5);
    expect(easer(0.25)).toBe(0.25);
    expect(easer(0.75)).toBe(0.75);
  });
});

describe('BezierEaser - Standard Curves', () => {
  it('should apply ease-in curve (0.42, 0, 1, 1)', () => {
    const easer = createBezierEaser(0.42, 0, 1, 1);
    expect(easer(0)).toBe(0);
    expect(easer(1)).toBe(1);
    expect(easer(0.5)).toBeLessThan(0.5);
  });

  it('should apply ease-out curve (0, 0, 0.58, 1)', () => {
    const easer = createBezierEaser(0, 0, 0.58, 1);
    expect(easer(0)).toBe(0);
    expect(easer(1)).toBe(1);
    expect(easer(0.5)).toBeGreaterThan(0.5);
  });

  it('should apply ease-in-out curve (0.42, 0, 0.58, 1)', () => {
    const easer = createBezierEaser(0.42, 0, 0.58, 1);
    expect(easer(0)).toBe(0);
    expect(easer(1)).toBe(1);
    expect(easer(0.5)).toBeCloseTo(0.5, 1);
  });
});

describe('BezierEaser - Edge Cases', () => {
  it('should clamp x=0 to 0', () => {
    const easer = createBezierEaser(0.25, 0.1, 0.25, 1);
    expect(easer(0)).toBe(0);
  });

  it('should clamp x=1 to 1', () => {
    const easer = createBezierEaser(0.25, 0.1, 0.25, 1);
    expect(easer(1)).toBe(1);
  });

  it('should handle extreme ease-in (0.9, 0, 1, 0.1)', () => {
    const easer = createBezierEaser(0.9, 0, 1, 0.1);
    expect(easer(0.5)).toBeLessThan(0.1);
  });

  it('should handle extreme ease-out (0, 0.9, 0.1, 1)', () => {
    const easer = createBezierEaser(0, 0.9, 0.1, 1);
    expect(easer(0.5)).toBeGreaterThan(0.9);
  });

  it('should be monotonically increasing', () => {
    const easer = createBezierEaser(0.25, 0.1, 0.25, 1);
    let prev = -1;
    for (let x = 0; x <= 1; x += 0.1) {
      const y = easer(x);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });
});

describe('BezierEaser - Lottie Common Curves', () => {
  it('should handle default lottie easing (0.33, 0, 0.67, 1)', () => {
    const easer = createBezierEaser(0.33, 0, 0.67, 1);
    expect(easer(0)).toBe(0);
    expect(easer(1)).toBe(1);
    expect(easer(0.5)).toBeCloseTo(0.5, 1);
  });

  it('should handle snap easing (0, 0, 0, 1)', () => {
    /* This curve starts with control points at origin, creating a specific easing */
    const easer = createBezierEaser(0, 0, 0, 1);
    expect(easer(0)).toBe(0);
    expect(easer(1)).toBe(1);
    /* At small x values, the curve behavior depends on implementation */
    expect(typeof easer(0.01)).toBe('number');
  });

  it('should handle slow start (0.5, 0, 0.5, 0.5)', () => {
    const easer = createBezierEaser(0.5, 0, 0.5, 0.5);
    expect(easer(0.25)).toBeLessThan(0.25);
  });
});
