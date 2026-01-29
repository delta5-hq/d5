/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect } from 'vitest';
import { StrokeOrderDetector } from '../stroke-order-detector.js';

describe('StrokeOrderDetector.analyzeGroup', () => {
  it('should return defaults when no fill or stroke', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'rc' }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: -1,
      strokeIndex: -1,
      strokeFirst: false
    });
  });

  it('should detect fill only', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'fl', ix: 2 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 2,
      strokeIndex: -1,
      strokeFirst: false
    });
  });

  it('should detect stroke only', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'st', ix: 3 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: -1,
      strokeIndex: 3,
      strokeFirst: false
    });
  });

  it('should detect gradient stroke only', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'gs', ix: 3 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: -1,
      strokeIndex: 3,
      strokeFirst: false
    });
  });

  it('should detect fill before stroke (strokeFirst=false)', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'fl', ix: 2 },
      { ty: 'st', ix: 3 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 2,
      strokeIndex: 3,
      strokeFirst: false
    });
  });

  it('should detect stroke before fill (strokeFirst=true)', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'st', ix: 2 },
      { ty: 'fl', ix: 3 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 3,
      strokeIndex: 2,
      strokeFirst: true
    });
  });

  it('should use gradient fill index', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'gf', ix: 5 },
      { ty: 'st', ix: 6 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 5,
      strokeIndex: 6,
      strokeFirst: false
    });
  });

  it('should use gradient stroke index', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'fl', ix: 2 },
      { ty: 'gs', ix: 4 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 2,
      strokeIndex: 4,
      strokeFirst: false
    });
  });

  it('should handle both gradient fill and gradient stroke', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'gf', ix: 10 },
      { ty: 'gs', ix: 20 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 10,
      strokeIndex: 20,
      strokeFirst: false
    });
  });

  it('should detect strokeFirst with gradients', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'gs', ix: 1 },
      { ty: 'gf', ix: 2 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 2,
      strokeIndex: 1,
      strokeFirst: true
    });
  });

  it('should use last fill when multiple fills present', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'fl', ix: 1 },
      { ty: 'fl', ix: 2 },
      { ty: 'st', ix: 3 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 2,
      strokeIndex: 3,
      strokeFirst: false
    });
  });

  it('should use last stroke when multiple strokes present', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'fl', ix: 1 },
      { ty: 'st', ix: 2 },
      { ty: 'st', ix: 3 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 1,
      strokeIndex: 3,
      strokeFirst: false
    });
  });

  it('should handle empty items array', () => {
    const items: any[] = [];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: -1,
      strokeIndex: -1,
      strokeFirst: false
    });
  });

  it('should ignore items without ix property', () => {
    const items = [
      { ty: 'sh' },
      { ty: 'fl' },
      { ty: 'st' }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: -1,
      strokeIndex: -1,
      strokeFirst: false
    });
  });

  it('should handle complex real-world group', () => {
    const items = [
      { ty: 'rc', ix: 1 },
      { ty: 'sh', ix: 2 },
      { ty: 'tm', ix: 3 },
      { ty: 'fl', ix: 4 },
      { ty: 'st', ix: 5 },
      { ty: 'tr', ix: 6 }
    ];
    
    const result = StrokeOrderDetector.analyzeGroup(items);
    
    expect(result).toEqual({
      fillIndex: 4,
      strokeIndex: 5,
      strokeFirst: false
    });
  });
});
