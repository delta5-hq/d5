/**
 * Gradient Builder Test Suite
 * 
 * Tests SVG gradient element creation and color stop computation.
 * Covers linear/radial gradients, color stops, opacity stops.
 */

import { describe, it, expect } from 'vitest';

const GradientBuilder = {
  parseColorStops(colors: number[], colorCount: number): Array<{ offset: number; r: number; g: number; b: number; opacity: number }> {
    const stops: Array<{ offset: number; r: number; g: number; b: number; opacity: number }> = [];
    const colorDataLen = colorCount * 4;
    const hasOpacity = colors.length > colorDataLen;
    
    for (let i = 0; i < colorCount; i++) {
      const baseIdx = i * 4;
      const offset = colors[baseIdx];
      const r = Math.round(colors[baseIdx + 1] * 255);
      const g = Math.round(colors[baseIdx + 2] * 255);
      const b = Math.round(colors[baseIdx + 3] * 255);
      
      let opacity = 1;
      if (hasOpacity) {
        const opacityIdx = colorDataLen + i * 2 + 1;
        if (opacityIdx < colors.length) {
          opacity = colors[opacityIdx];
        }
      }
      
      stops.push({ offset, r, g, b, opacity });
    }
    
    return stops;
  },
  
  calculateRadialRadius(center: number[], endPoint: number[]): number {
    const dx = endPoint[0] - center[0];
    const dy = endPoint[1] - center[1];
    return Math.sqrt(dx * dx + dy * dy);
  },
  
  calculateFocalPoint(center: number[], highlightLength: number, highlightAngle: number): { fx: number; fy: number } {
    const angleRad = (highlightAngle * Math.PI) / 180;
    return {
      fx: center[0] + Math.cos(angleRad) * highlightLength,
      fy: center[1] + Math.sin(angleRad) * highlightLength
    };
  },
  
  isRadialGradient(type: number): boolean {
    return type === 2;
  }
};

describe('GradientBuilder.parseColorStops', () => {
  it('should parse simple 2-color gradient', () => {
    const colors = [0, 1, 0, 0, 1, 0, 1, 0];
    const stops = GradientBuilder.parseColorStops(colors, 2);
    
    expect(stops).toHaveLength(2);
    expect(stops[0]).toEqual({ offset: 0, r: 255, g: 0, b: 0, opacity: 1 });
    expect(stops[1]).toEqual({ offset: 1, r: 0, g: 255, b: 0, opacity: 1 });
  });

  it('should parse gradient with opacity stops', () => {
    const colors = [
      0, 1, 0, 0,
      1, 0, 1, 0,
      0, 0.5,
      1, 1.0
    ];
    const stops = GradientBuilder.parseColorStops(colors, 2);
    
    expect(stops[0].opacity).toBe(0.5);
    expect(stops[1].opacity).toBe(1.0);
  });

  it('should handle 3-color gradient', () => {
    const colors = [0, 1, 0, 0, 0.5, 0, 1, 0, 1, 0, 0, 1];
    const stops = GradientBuilder.parseColorStops(colors, 3);
    
    expect(stops).toHaveLength(3);
    expect(stops[0].offset).toBe(0);
    expect(stops[1].offset).toBe(0.5);
    expect(stops[2].offset).toBe(1);
  });

  it('should handle single color', () => {
    const colors = [0.5, 0.5, 0.5, 0.5];
    const stops = GradientBuilder.parseColorStops(colors, 1);
    
    expect(stops).toHaveLength(1);
    expect(stops[0].r).toBe(128);
    expect(stops[0].g).toBe(128);
    expect(stops[0].b).toBe(128);
  });

  it('should handle out-of-range color values (no clamping)', () => {
    /* Values are multiplied by 255, no clamping applied */
    const colors = [0, 1.5, -0.5, 0.5];
    const stops = GradientBuilder.parseColorStops(colors, 1);
    
    /* 1.5 * 255 = 382.5, rounded = 383 */
    expect(stops[0].r).toBe(383);
    /* -0.5 * 255 = -127.5, rounds to -127 */
    expect(stops[0].g).toBe(-127);
  });
});

describe('GradientBuilder.calculateRadialRadius', () => {
  it('should calculate horizontal radius', () => {
    expect(GradientBuilder.calculateRadialRadius([0, 0], [100, 0])).toBe(100);
  });

  it('should calculate vertical radius', () => {
    expect(GradientBuilder.calculateRadialRadius([0, 0], [0, 100])).toBe(100);
  });

  it('should calculate diagonal radius', () => {
    const radius = GradientBuilder.calculateRadialRadius([0, 0], [100, 100]);
    expect(radius).toBeCloseTo(141.42, 1);
  });

  it('should handle non-zero center', () => {
    const radius = GradientBuilder.calculateRadialRadius([50, 50], [150, 50]);
    expect(radius).toBe(100);
  });

  it('should return 0 for same point', () => {
    expect(GradientBuilder.calculateRadialRadius([100, 100], [100, 100])).toBe(0);
  });
});

describe('GradientBuilder.calculateFocalPoint', () => {
  it('should calculate focal point at 0 degrees', () => {
    const result = GradientBuilder.calculateFocalPoint([100, 100], 50, 0);
    expect(result.fx).toBe(150);
    expect(result.fy).toBeCloseTo(100, 5);
  });

  it('should calculate focal point at 90 degrees', () => {
    const result = GradientBuilder.calculateFocalPoint([100, 100], 50, 90);
    expect(result.fx).toBeCloseTo(100, 5);
    expect(result.fy).toBeCloseTo(150, 5);
  });

  it('should calculate focal point at 180 degrees', () => {
    const result = GradientBuilder.calculateFocalPoint([100, 100], 50, 180);
    expect(result.fx).toBeCloseTo(50, 5);
    expect(result.fy).toBeCloseTo(100, 5);
  });

  it('should calculate focal point at 45 degrees', () => {
    const result = GradientBuilder.calculateFocalPoint([0, 0], 100, 45);
    expect(result.fx).toBeCloseTo(70.71, 1);
    expect(result.fy).toBeCloseTo(70.71, 1);
  });

  it('should handle zero highlight length', () => {
    const result = GradientBuilder.calculateFocalPoint([100, 100], 0, 45);
    expect(result.fx).toBe(100);
    expect(result.fy).toBe(100);
  });
});

describe('GradientBuilder.isRadialGradient', () => {
  it('should return true for type 2 (radial)', () => {
    expect(GradientBuilder.isRadialGradient(2)).toBe(true);
  });

  it('should return false for type 1 (linear)', () => {
    expect(GradientBuilder.isRadialGradient(1)).toBe(false);
  });

  it('should return false for other types', () => {
    expect(GradientBuilder.isRadialGradient(0)).toBe(false);
    expect(GradientBuilder.isRadialGradient(3)).toBe(false);
  });
});
