/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { describe, it, expect } from 'vitest';
import { ShapeCollector } from '../shape-collector.js';

describe('ShapeCollector.extractFromGroup', () => {
  it('should return empty result when no items', () => {
    const group = { it: [] };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result).toEqual({
      paths: [],
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    });
  });

  it('should extract shape paths', () => {
    const group = {
      it: [
        { ty: 'sh', ks: { k: { v: [[0, 0], [10, 10]] } } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]).toEqual({ v: [[0, 0], [10, 10]] });
  });

  it('should extract multiple shape paths', () => {
    const group = {
      it: [
        { ty: 'sh', ks: { k: { v: [[0, 0], [10, 10]] } } },
        { ty: 'sh', ks: { k: { v: [[20, 20], [30, 30]] } } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.paths).toHaveLength(2);
  });

  it('should extract rectangle paths', () => {
    const group = {
      it: [
        { ty: 'rc', p: { k: [0, 0] }, s: { k: [100, 100] }, r: { k: 0 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.paths).toHaveLength(1);
  });

  it('should extract ellipse paths', () => {
    const group = {
      it: [
        { ty: 'el', p: { k: [0, 0] }, s: { k: [100, 100] } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.paths).toHaveLength(1);
  });

  it('should extract fill', () => {
    const group = {
      it: [
        { ty: 'fl', c: { k: [1, 0, 0] }, o: { k: 100 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.fill).toMatchObject({ c: { k: [1, 0, 0] }, o: { k: 100 } });
  });

  it('should extract stroke', () => {
    const group = {
      it: [
        { ty: 'st', c: { k: [0, 0, 1] }, o: { k: 100 }, w: { k: 5 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.stroke).toMatchObject({ c: { k: [0, 0, 1] }, o: { k: 100 }, w: { k: 5 } });
  });

  it('should extract trim path', () => {
    const group = {
      it: [
        { ty: 'tm', s: { k: 0 }, e: { k: 100 }, o: { k: 0 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.trimPath).toMatchObject({ s: { k: 0 }, e: { k: 100 }, o: { k: 0 } });
  });

  it('should extract gradient fill', () => {
    const group = {
      it: [
        { ty: 'gf', s: { k: [0, 0] }, e: { k: [100, 0] }, g: { k: { p: 3, k: [0, 1, 0, 0] } } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.gradientFill).toBeDefined();
    expect(result.gradientFill?.ty).toBe('gf');
  });

  it('should extract gradient stroke', () => {
    const group = {
      it: [
        { ty: 'gs', s: { k: [0, 0] }, e: { k: [100, 0] }, g: { k: { p: 3, k: [0, 1, 0, 0] } }, w: { k: 3 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.gradientStroke).toBeDefined();
    expect(result.gradientStroke?.ty).toBe('gs');
  });

  it('should extract all shape types together', () => {
    const group = {
      it: [
        { ty: 'sh', ks: { k: { v: [[0, 0], [10, 10]] } } },
        { ty: 'rc', p: { k: [50, 50] }, s: { k: [100, 100] }, r: { k: 0 } },
        { ty: 'fl', c: { k: [1, 0, 0] }, o: { k: 100 } },
        { ty: 'st', c: { k: [0, 0, 1] }, o: { k: 100 }, w: { k: 2 } },
        { ty: 'tm', s: { k: 0 }, e: { k: 50 }, o: { k: 0 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.paths).toHaveLength(2);
    expect(result.fill).toBeDefined();
    expect(result.stroke).toBeDefined();
    expect(result.trimPath).toBeDefined();
  });

  it('should use last fill when multiple fills', () => {
    const group = {
      it: [
        { ty: 'fl', c: { k: [1, 0, 0] }, o: { k: 50 } },
        { ty: 'fl', c: { k: [0, 1, 0] }, o: { k: 100 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.fill?.c.k).toEqual([0, 1, 0]);
  });

  it('should use last stroke when multiple strokes', () => {
    const group = {
      it: [
        { ty: 'st', c: { k: [1, 0, 0] }, w: { k: 2 } },
        { ty: 'st', c: { k: [0, 1, 0] }, w: { k: 5 } }
      ]
    };
    
    const result = ShapeCollector.extractFromGroup(group);
    
    expect(result.stroke?.w.k).toBe(5);
  });
});

describe('ShapeCollector.extractLayerLevel', () => {
  it('should return empty result when no shapes', () => {
    const shapes: any[] = [];
    
    const result = ShapeCollector.extractLayerLevel(shapes);
    
    expect(result).toEqual({
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    });
  });

  it('should extract layer-level fill', () => {
    const shapes = [
      { ty: 'fl', c: { k: [1, 0, 0] }, o: { k: 100 } }
    ];
    
    const result = ShapeCollector.extractLayerLevel(shapes);
    
    expect(result.fill).toMatchObject({ c: { k: [1, 0, 0] }, o: { k: 100 } });
  });

  it('should extract layer-level stroke', () => {
    const shapes = [
      { ty: 'st', c: { k: [0, 0, 1] }, w: { k: 3 } }
    ];
    
    const result = ShapeCollector.extractLayerLevel(shapes);
    
    expect(result.stroke).toMatchObject({ c: { k: [0, 0, 1] }, w: { k: 3 } });
  });

  it('should extract layer-level trim path', () => {
    const shapes = [
      { ty: 'tm', s: { k: 10 }, e: { k: 90 }, o: { k: 0 } }
    ];
    
    const result = ShapeCollector.extractLayerLevel(shapes);
    
    expect(result.trimPath).toMatchObject({ s: { k: 10 }, e: { k: 90 }, o: { k: 0 } });
  });

  it('should skip group shapes', () => {
    const shapes = [
      { ty: 'gr', it: [{ ty: 'fl', c: { k: [1, 0, 0] } }] },
      { ty: 'fl', c: { k: [0, 1, 0] }, o: { k: 100 } }
    ];
    
    const result = ShapeCollector.extractLayerLevel(shapes);
    
    expect(result.fill?.c.k).toEqual([0, 1, 0]);
  });

  it('should extract all layer-level properties', () => {
    const shapes = [
      { ty: 'fl', c: { k: [1, 0, 0] }, o: { k: 100 } },
      { ty: 'st', c: { k: [0, 0, 1] }, w: { k: 2 } },
      { ty: 'tm', s: { k: 0 }, e: { k: 100 }, o: { k: 0 } }
    ];
    
    const result = ShapeCollector.extractLayerLevel(shapes);
    
    expect(result.fill).toBeDefined();
    expect(result.stroke).toBeDefined();
    expect(result.trimPath).toBeDefined();
  });
});

describe('ShapeCollector.mergeWithLayerDefaults', () => {
  it('should use group values when layer defaults empty', () => {
    const groupShapes = {
      paths: [],
      fill: { c: { k: [1, 0, 0] } },
      stroke: { c: { k: [0, 0, 1] }, w: { k: 3 } },
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    const layerDefaults = {
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    
    const result = ShapeCollector.mergeWithLayerDefaults(groupShapes, layerDefaults);
    
    expect(result.fill).toEqual({ c: { k: [1, 0, 0] } });
    expect(result.stroke).toEqual({ c: { k: [0, 0, 1] }, w: { k: 3 } });
  });

  it('should use layer defaults when group values missing', () => {
    const groupShapes = {
      paths: [],
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    const layerDefaults = {
      fill: { c: { k: [0, 1, 0] } },
      stroke: { c: { k: [1, 0, 0] }, w: { k: 5 } },
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    
    const result = ShapeCollector.mergeWithLayerDefaults(groupShapes, layerDefaults);
    
    expect(result.fill).toEqual({ c: { k: [0, 1, 0] } });
    expect(result.stroke).toEqual({ c: { k: [1, 0, 0] }, w: { k: 5 } });
  });

  it('should prefer group values over layer defaults', () => {
    const groupShapes = {
      paths: [],
      fill: { c: { k: [1, 0, 0] } },
      stroke: { c: { k: [0, 0, 1] }, w: { k: 3 } },
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    const layerDefaults = {
      fill: { c: { k: [0, 1, 0] } },
      stroke: { c: { k: [1, 0, 0] }, w: { k: 5 } },
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    
    const result = ShapeCollector.mergeWithLayerDefaults(groupShapes, layerDefaults);
    
    expect(result.fill?.c.k).toEqual([1, 0, 0]);
    expect(result.stroke?.w.k).toBe(3);
  });

  it('should merge trim paths correctly', () => {
    const groupShapes = {
      paths: [],
      fill: null,
      stroke: null,
      trimPath: { s: { k: 10 }, e: { k: 90 }, o: { k: 0 } },
      gradientFill: null,
      gradientStroke: null
    };
    const layerDefaults = {
      fill: null,
      stroke: null,
      trimPath: { s: { k: 0 }, e: { k: 100 }, o: { k: 0 } },
      gradientFill: null,
      gradientStroke: null
    };
    
    const result = ShapeCollector.mergeWithLayerDefaults(groupShapes, layerDefaults);
    
    expect(result.trimPath?.s.k).toBe(10);
  });

  it('should preserve paths unchanged', () => {
    const paths = [{ v: [[0, 0], [10, 10]] }];
    const groupShapes = {
      paths,
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    const layerDefaults = {
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    
    const result = ShapeCollector.mergeWithLayerDefaults(groupShapes, layerDefaults);
    
    expect(result.paths).toBe(paths);
  });

  it('should handle gradient fills correctly', () => {
    const gradientFill = { ty: 'gf', s: { k: [0, 0] }, e: { k: [100, 0] } };
    const groupShapes = {
      paths: [],
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill,
      gradientStroke: null
    };
    const layerDefaults = {
      fill: { c: { k: [1, 0, 0] } },
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    
    const result = ShapeCollector.mergeWithLayerDefaults(groupShapes, layerDefaults);
    
    expect(result.gradientFill).toBe(gradientFill);
  });

  it('should handle gradient strokes correctly', () => {
    const gradientStroke = { ty: 'gs', s: { k: [0, 0] }, e: { k: [100, 0] }, w: { k: 3 } };
    const groupShapes = {
      paths: [],
      fill: null,
      stroke: null,
      trimPath: null,
      gradientFill: null,
      gradientStroke
    };
    const layerDefaults = {
      fill: null,
      stroke: { c: { k: [1, 0, 0] }, w: { k: 5 } },
      trimPath: null,
      gradientFill: null,
      gradientStroke: null
    };
    
    const result = ShapeCollector.mergeWithLayerDefaults(groupShapes, layerDefaults);
    
    expect(result.gradientStroke).toBe(gradientStroke);
  });
});
