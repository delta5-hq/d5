/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/strict-boolean-expressions, @typescript-eslint/no-unsafe-argument, @typescript-eslint/explicit-function-return-type */
import { describe, it, expect } from 'vitest';
import { TransformCalculator } from '../transform-calculator.js';

/* Mock Interpolator for testing */
const Interpolator = {
  interpolateProperty: (prop: any, frame: number) => {
    if (!prop.a) return prop.k;
    if (frame <= 0) return prop.k[0].s;
    if (frame >= 90) return prop.k[prop.k.length - 1].e || prop.k[prop.k.length - 1].s;
    const t = frame / 90;
    const start = prop.k[0].s;
    const end = prop.k[prop.k.length - 1].e || prop.k[prop.k.length - 1].s;
    if (Array.isArray(start)) {
      return start.map((v, i) => v + (end[i] - v) * t);
    }
    return start + (end - start) * t;
  }
};

describe('TransformCalculator.computeFromKeyframes', () => {
  it('should extract static transform values', () => {
    const ks = {
      p: { k: [100, 200] },
      a: { k: [50, 50] },
      s: { k: [100, 100] },
      r: { k: 0 },
      o: { k: 100 }
    };
    
    const result = TransformCalculator.computeFromKeyframes(ks, 0, Interpolator);
    
    expect(result).toEqual({
      position: [100, 200],
      anchor: [50, 50],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    });
  });

  it('should use default values when properties missing', () => {
    const ks = {};
    
    const result = TransformCalculator.computeFromKeyframes(ks, 0, Interpolator);
    
    expect(result).toEqual({
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    });
  });

  it('should interpolate animated position', () => {
    const ks = {
      p: { a: 1, k: [{ t: 0, s: [0, 0] }, { t: 90, e: [100, 100] }] }
    };
    
    const result = TransformCalculator.computeFromKeyframes(ks, 45, Interpolator);
    
    expect(result.position[0]).toBeCloseTo(50, 1);
    expect(result.position[1]).toBeCloseTo(50, 1);
  });

  it('should interpolate animated scale', () => {
    const ks = {
      s: { a: 1, k: [{ t: 0, s: [100, 100] }, { t: 90, e: [200, 200] }] }
    };
    
    const result = TransformCalculator.computeFromKeyframes(ks, 45, Interpolator);
    
    expect(result.scale[0]).toBeCloseTo(150, 1);
    expect(result.scale[1]).toBeCloseTo(150, 1);
  });

  it('should interpolate animated rotation', () => {
    const ks = {
      r: { a: 1, k: [{ t: 0, s: 0 }, { t: 90, e: 180 }] }
    };
    
    const result = TransformCalculator.computeFromKeyframes(ks, 45, Interpolator);
    
    expect(result.rotation).toBeCloseTo(90, 1);
  });

  it('should interpolate animated opacity', () => {
    const ks = {
      o: { a: 1, k: [{ t: 0, s: 0 }, { t: 90, e: 100 }] }
    };
    
    const result = TransformCalculator.computeFromKeyframes(ks, 45, Interpolator);
    
    expect(result.opacity).toBeCloseTo(50, 1);
  });
});

describe('TransformCalculator.combineParentChild', () => {
  it('should combine identity transforms', () => {
    const parent = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    const child = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result).toEqual({
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    });
  });

  it('should apply parent position to child', () => {
    const parent = {
      position: [100, 200],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    const child = {
      position: [50, 50],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.position).toEqual([150, 250]);
  });

  it('should multiply parent and child scales', () => {
    const parent = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [200, 200],
      rotation: 0,
      opacity: 100
    };
    const child = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [50, 50],
      rotation: 0,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.scale).toEqual([100, 100]);
  });

  it('should add parent and child rotations', () => {
    const parent = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 45,
      opacity: 100
    };
    const child = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 45,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.rotation).toBe(90);
  });

  it('should multiply parent and child opacities', () => {
    const parent = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 50
    };
    const child = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 50
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.opacity).toBe(25);
  });

  it('should preserve child opacity when parent is NULL layer (ty=3)', () => {
    const parent = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 50
    };
    const child = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 80
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 3);
    
    expect(result.opacity).toBe(80);
  });

  it('should rotate child position around parent origin', () => {
    const parent = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 90,
      opacity: 100
    };
    const child = {
      position: [100, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.position[0]).toBeCloseTo(0, 1);
    expect(result.position[1]).toBeCloseTo(100, 1);
  });

  it('should scale child position by parent scale', () => {
    const parent = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [200, 200],
      rotation: 0,
      opacity: 100
    };
    const child = {
      position: [50, 50],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.position).toEqual([100, 100]);
  });

  it('should handle negative parent scale correctly', () => {
    const parent = {
      position: [100, 100],
      anchor: [50, 50],
      scale: [-100, -100],
      rotation: 0,
      opacity: 100
    };
    const child = {
      position: [0, 0],
      anchor: [0, 0],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.position[0]).toBeCloseTo(150, 1);
    expect(result.position[1]).toBeCloseTo(150, 1);
    expect(result.scale).toEqual([-100, -100]);
  });

  it('should preserve child anchor', () => {
    const parent = {
      position: [100, 100],
      anchor: [50, 50],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    const child = {
      position: [0, 0],
      anchor: [25, 25],
      scale: [100, 100],
      rotation: 0,
      opacity: 100
    };
    
    const result = TransformCalculator.combineParentChild(parent, child, 4);
    
    expect(result.anchor).toEqual([25, 25]);
  });
});

describe('TransformCalculator.resolveParentChain', () => {
  it('should return layer transform when no parent', () => {
    const layer = {
      ks: {
        p: { k: [100, 200] },
        s: { k: [150, 150] },
        r: { k: 45 },
        o: { k: 80 }
      }
    };
    const elements = new Map();
    
    const result = TransformCalculator.resolveParentChain(layer, 0, 'test', elements, Interpolator);
    
    expect(result.position).toEqual([100, 200]);
    expect(result.scale).toEqual([150, 150]);
    expect(result.rotation).toBe(45);
    expect(result.opacity).toBe(80);
  });

  it('should combine with single parent transform', () => {
    const parentLayer = {
      ty: 4,
      ks: {
        p: { k: [100, 100] },
        s: { k: [200, 200] },
        r: { k: 0 },
        o: { k: 100 }
      }
    };
    const childLayer = {
      parent: 1,
      ks: {
        p: { k: [50, 0] },
        s: { k: [100, 100] },
        r: { k: 0 },
        o: { k: 100 }
      }
    };
    const elements = new Map([
      ['test_1', { layer: parentLayer }]
    ]);
    
    const result = TransformCalculator.resolveParentChain(childLayer, 0, 'test', elements, Interpolator);
    
    expect(result.position).toEqual([200, 100]);
    expect(result.scale).toEqual([200, 200]);
  });

  it('should combine through multiple parent levels', () => {
    const grandparentLayer = {
      ty: 4,
      ks: {
        p: { k: [100, 100] },
        s: { k: [100, 100] },
        r: { k: 0 },
        o: { k: 100 }
      }
    };
    const parentLayer = {
      parent: 1,
      ty: 4,
      ks: {
        p: { k: [50, 50] },
        s: { k: [100, 100] },
        r: { k: 0 },
        o: { k: 100 }
      }
    };
    const childLayer = {
      parent: 2,
      ks: {
        p: { k: [25, 25] },
        s: { k: [100, 100] },
        r: { k: 0 },
        o: { k: 100 }
      }
    };
    const elements = new Map([
      ['test_1', { layer: grandparentLayer }],
      ['test_2', { layer: parentLayer }]
    ]);
    
    const result = TransformCalculator.resolveParentChain(childLayer, 0, 'test', elements, Interpolator);
    
    expect(result.position).toEqual([175, 175]);
  });

  it('should stop when parent not found in elements map', () => {
    const childLayer = {
      parent: 999,
      ks: {
        p: { k: [50, 50] },
        s: { k: [100, 100] },
        r: { k: 0 },
        o: { k: 100 }
      }
    };
    const elements = new Map();
    
    const result = TransformCalculator.resolveParentChain(childLayer, 0, 'test', elements, Interpolator);
    
    expect(result.position).toEqual([50, 50]);
  });

  it('should handle NULL parent layers without affecting opacity', () => {
    const nullParentLayer = {
      ty: 3,
      ks: {
        p: { k: [100, 100] },
        s: { k: [100, 100] },
        r: { k: 0 },
        o: { k: 50 }
      }
    };
    const childLayer = {
      parent: 1,
      ks: {
        p: { k: [0, 0] },
        s: { k: [100, 100] },
        r: { k: 0 },
        o: { k: 100 }
      }
    };
    const elements = new Map([
      ['test_1', { layer: nullParentLayer }]
    ]);
    
    const result = TransformCalculator.resolveParentChain(childLayer, 0, 'test', elements, Interpolator);
    
    expect(result.opacity).toBe(100);
  });
});
