/**
 * Trim Paths Test Suite
 * 
 * Tests SVG stroke-dasharray/dashoffset computation for Lottie trim paths.
 * Covers offset normalization, start/end swapping, edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

interface MockPathElement {
  attributes: Record<string, string>;
  totalLength: number;
  setAttribute: (name: string, value: string) => void;
  removeAttribute: (name: string) => void;
  getTotalLength: () => number;
}

function createMockPath(totalLength: number): MockPathElement {
  const attributes: Record<string, string> = {};
  return {
    attributes,
    totalLength,
    setAttribute: vi.fn((name: string, value: string) => {
      attributes[name] = value;
    }),
    removeAttribute: vi.fn((name: string) => {
      delete attributes[name];
    }),
    getTotalLength: vi.fn(() => totalLength)
  };
}

const TrimPaths = {
  apply(pathElement: MockPathElement, trimStart: number, trimEnd: number, trimOffset: number): void {
    const offsetPercent = (trimOffset % 360) / 360 * 100;
    
    const rawS = trimStart + offsetPercent;
    const rawE = trimEnd + offsetPercent;
    let s = rawS > 100 ? (rawS % 100) / 100 : rawS / 100;
    let e = rawE > 100 ? (rawE % 100) / 100 : rawE / 100;
    if (s < 0) s += 1;
    if (e < 0) e += 1;
    
    if (s > e) {
      const tmp = s;
      s = e;
      e = tmp;
    }
    
    s = Math.round(s * 10000) * 0.0001;
    e = Math.round(e * 10000) * 0.0001;
    
    const totalLength = pathElement.getTotalLength();
    
    if ((s === 0 && e === 1) || (s === 1 && e === 0)) {
      pathElement.removeAttribute('stroke-dasharray');
      pathElement.removeAttribute('stroke-dashoffset');
      return;
    }
    
    if (s === e) {
      pathElement.setAttribute('stroke-dasharray', '0 ' + totalLength);
      pathElement.setAttribute('stroke-dashoffset', '0');
      return;
    }
    
    const startLength = totalLength * s;
    const endLength = totalLength * e;
    const dashLength = endLength - startLength;
    
    pathElement.setAttribute('stroke-dasharray', dashLength + ' ' + totalLength);
    pathElement.setAttribute('stroke-dashoffset', String(-startLength));
  },
  
  findTrimShape(shapes: Array<{ ty: string }>): { ty: string } | null {
    for (let i = 0; i < shapes.length; i++) {
      if (shapes[i].ty === 'tm') {
        return shapes[i];
      }
    }
    return null;
  }
};

describe('TrimPaths.apply', () => {
  let mockPath: MockPathElement;

  beforeEach(() => {
    mockPath = createMockPath(1000);
  });

  it('should remove dash attributes for full path (0-100%)', () => {
    TrimPaths.apply(mockPath, 0, 100, 0);
    expect(mockPath.removeAttribute).toHaveBeenCalledWith('stroke-dasharray');
    expect(mockPath.removeAttribute).toHaveBeenCalledWith('stroke-dashoffset');
  });

  it('should set zero-length dash for empty path (start=end)', () => {
    TrimPaths.apply(mockPath, 50, 50, 0);
    expect(mockPath.attributes['stroke-dasharray']).toBe('0 1000');
    expect(mockPath.attributes['stroke-dashoffset']).toBe('0');
  });

  it('should calculate correct dasharray for partial trim', () => {
    TrimPaths.apply(mockPath, 25, 75, 0);
    expect(mockPath.attributes['stroke-dasharray']).toBe('500 1000');
    expect(mockPath.attributes['stroke-dashoffset']).toBe('-250');
  });

  it('should handle offset rotation (90 degrees = 25%)', () => {
    TrimPaths.apply(mockPath, 0, 50, 90);
    expect(mockPath.getTotalLength).toHaveBeenCalled();
    expect(mockPath.attributes['stroke-dasharray']).toBeDefined();
  });

  it('should swap start/end if start > end', () => {
    TrimPaths.apply(mockPath, 75, 25, 0);
    expect(mockPath.attributes['stroke-dasharray']).toBe('500 1000');
  });

  it('should handle offset wrapping at 360 degrees', () => {
    TrimPaths.apply(mockPath, 0, 50, 360);
    expect(mockPath.attributes['stroke-dasharray']).toBe('500 1000');
  });

  it('should handle very small path segments', () => {
    TrimPaths.apply(mockPath, 49.99, 50.01, 0);
    expect(mockPath.attributes['stroke-dasharray']).toBeDefined();
  });
});

describe('TrimPaths.findTrimShape', () => {
  it('should find trim shape in array', () => {
    const shapes = [
      { ty: 'sh' },
      { ty: 'fl' },
      { ty: 'tm' },
      { ty: 'st' }
    ];
    const result = TrimPaths.findTrimShape(shapes);
    expect(result).toEqual({ ty: 'tm' });
  });

  it('should return null if no trim shape', () => {
    const shapes = [{ ty: 'sh' }, { ty: 'fl' }];
    expect(TrimPaths.findTrimShape(shapes)).toBeNull();
  });

  it('should return first trim shape if multiple', () => {
    const shapes = [{ ty: 'tm' }, { ty: 'tm' }];
    expect(TrimPaths.findTrimShape(shapes)).toBe(shapes[0]);
  });

  it('should handle empty array', () => {
    expect(TrimPaths.findTrimShape([])).toBeNull();
  });
});
