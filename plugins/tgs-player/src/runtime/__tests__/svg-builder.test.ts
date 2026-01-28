/**
 * SVG Builder Test Suite
 * 
 * Tests SVG element creation and path/transform utilities.
 */

import { describe, it, expect } from 'vitest';

/* Recreate SvgBuilder logic for testing */
const createSvgBuilder = () => {
  const NS = 'http://www.w3.org/2000/svg';
  
  return {
    NS,
    
    pathDataToString(pathData: { v: number[][]; i: number[][]; o: number[][]; c: boolean } | null): string {
      if (!pathData || !pathData.v || pathData.v.length === 0) return '';
      
      const v = pathData.v;
      const i = pathData.i;
      const o = pathData.o;
      const closed = pathData.c;

      const parts = ['M' + v[0][0] + ',' + v[0][1]];

      for (let j = 1; j < v.length; j++) {
        const prevOut = o[j - 1];
        const currIn = i[j];
        const curr = v[j];
        const prev = v[j - 1];
        
        parts.push(
          'C' + (prev[0] + prevOut[0]) + ',' + (prev[1] + prevOut[1]) +
          ' ' + (curr[0] + currIn[0]) + ',' + (curr[1] + currIn[1]) +
          ' ' + curr[0] + ',' + curr[1]
        );
      }

      if (closed && v.length > 1) {
        const lastOut = o[v.length - 1];
        const firstIn = i[0];
        const last = v[v.length - 1];
        const first = v[0];
        
        parts.push(
          'C' + (last[0] + lastOut[0]) + ',' + (last[1] + lastOut[1]) +
          ' ' + (first[0] + firstIn[0]) + ',' + (first[1] + firstIn[1]) +
          ' ' + first[0] + ',' + first[1] + 'Z'
        );
      }

      return parts.join(' ');
    },
    
    rgbToString(color: number[] | string): string {
      if (typeof color === 'string') return color;
      const r = Math.round(Math.max(0, Math.min(1, color[0])) * 255);
      const g = Math.round(Math.max(0, Math.min(1, color[1])) * 255);
      const b = Math.round(Math.max(0, Math.min(1, color[2])) * 255);
      return 'rgb(' + r + ',' + g + ',' + b + ')';
    },
    
    buildTransformString(transform: {
      position?: number[];
      anchor?: number[];
      rotation?: number;
      scale?: number[];
    }): string[] {
      const fmt = (n: number) => {
        if (!Number.isFinite(n)) return 0;
        return Math.round(n * 1000) / 1000;
      };
      
      const px = fmt(transform.position ? transform.position[0] : 0);
      const py = fmt(transform.position ? transform.position[1] : 0);
      const ax = fmt(transform.anchor ? transform.anchor[0] : 0);
      const ay = fmt(transform.anchor ? transform.anchor[1] : 0);
      const r = fmt(transform.rotation || 0);
      const sx = fmt(transform.scale ? transform.scale[0] / 100 : 1);
      const sy = fmt(transform.scale ? transform.scale[1] / 100 : 1);
      
      const parts: string[] = [];
      
      parts.push('translate(' + px + ',' + py + ')');
      
      if (r !== 0) {
        parts.push('rotate(' + r + ')');
      }
      
      if (sx !== 1 || sy !== 1) {
        parts.push('scale(' + sx + ',' + sy + ')');
      }
      
      if (ax !== 0 || ay !== 0) {
        parts.push('translate(' + (-ax) + ',' + (-ay) + ')');
      }
      
      return parts;
    }
  };
};

describe('SvgBuilder', () => {
  describe('pathDataToString', () => {
    const builder = createSvgBuilder();
    
    it('should return empty string for null pathData', () => {
      expect(builder.pathDataToString(null)).toBe('');
    });
    
    it('should return empty string for empty vertices', () => {
      expect(builder.pathDataToString({ v: [], i: [], o: [], c: false })).toBe('');
    });
    
    it('should convert single point to M command', () => {
      const pathData = {
        v: [[10, 20]],
        i: [[0, 0]],
        o: [[0, 0]],
        c: false
      };
      
      const result = builder.pathDataToString(pathData);
      expect(result).toBe('M10,20');
    });
    
    it('should convert two points to M and C commands', () => {
      const pathData = {
        v: [[0, 0], [100, 100]],
        i: [[0, 0], [0, 0]],
        o: [[0, 0], [0, 0]],
        c: false
      };
      
      const result = builder.pathDataToString(pathData);
      expect(result).toContain('M0,0');
      expect(result).toContain('C');
      expect(result).toContain('100,100');
    });
    
    it('should include bezier handles in curve calculation', () => {
      const pathData = {
        v: [[0, 0], [100, 0]],
        i: [[0, 0], [-20, 50]],  // in-tangent
        o: [[20, 50], [0, 0]],   // out-tangent
        c: false
      };
      
      const result = builder.pathDataToString(pathData);
      /* first point + out-tangent = 0+20, 0+50 = 20,50 */
      expect(result).toContain('C20,50');
      /* last point + in-tangent = 100-20, 0+50 = 80,50 */
      expect(result).toContain('80,50');
    });
    
    it('should close path with Z when c=true', () => {
      const pathData = {
        v: [[0, 0], [100, 0], [50, 100]],
        i: [[0, 0], [0, 0], [0, 0]],
        o: [[0, 0], [0, 0], [0, 0]],
        c: true
      };
      
      const result = builder.pathDataToString(pathData);
      expect(result).toContain('Z');
    });
    
    it('should not close path when c=false', () => {
      const pathData = {
        v: [[0, 0], [100, 0], [50, 100]],
        i: [[0, 0], [0, 0], [0, 0]],
        o: [[0, 0], [0, 0], [0, 0]],
        c: false
      };
      
      const result = builder.pathDataToString(pathData);
      expect(result).not.toContain('Z');
    });
    
    it('should handle complex path with multiple segments', () => {
      const pathData = {
        v: [[0, 0], [100, 0], [100, 100], [0, 100]],
        i: [[0, 0], [0, 0], [0, 0], [0, 0]],
        o: [[0, 0], [0, 0], [0, 0], [0, 0]],
        c: true
      };
      
      const result = builder.pathDataToString(pathData);
      const cCount = (result.match(/C/g) || []).length;
      /* 4 vertices closed = 4 curves (3 between vertices + 1 closing) */
      expect(cCount).toBe(4);
    });
  });
  
  describe('rgbToString', () => {
    const builder = createSvgBuilder();
    
    it('should return string color unchanged', () => {
      expect(builder.rgbToString('#ff0000')).toBe('#ff0000');
      expect(builder.rgbToString('rgb(255,0,0)')).toBe('rgb(255,0,0)');
    });
    
    it('should convert normalized RGB array to rgb string', () => {
      expect(builder.rgbToString([1, 0, 0])).toBe('rgb(255,0,0)');
      expect(builder.rgbToString([0, 1, 0])).toBe('rgb(0,255,0)');
      expect(builder.rgbToString([0, 0, 1])).toBe('rgb(0,0,255)');
    });
    
    it('should handle intermediate values', () => {
      expect(builder.rgbToString([0.5, 0.5, 0.5])).toBe('rgb(128,128,128)');
      expect(builder.rgbToString([0.2, 0.4, 0.6])).toBe('rgb(51,102,153)');
    });
    
    it('should clamp values to 0-1 range', () => {
      expect(builder.rgbToString([-0.5, 1.5, 0.5])).toBe('rgb(0,255,128)');
    });
    
    it('should handle black and white', () => {
      expect(builder.rgbToString([0, 0, 0])).toBe('rgb(0,0,0)');
      expect(builder.rgbToString([1, 1, 1])).toBe('rgb(255,255,255)');
    });
  });
  
  describe('buildTransformString', () => {
    const builder = createSvgBuilder();
    
    it('should include position translate', () => {
      const parts = builder.buildTransformString({
        position: [100, 200]
      });
      
      expect(parts[0]).toBe('translate(100,200)');
    });
    
    it('should include rotation when non-zero', () => {
      const parts = builder.buildTransformString({
        position: [0, 0],
        rotation: 45
      });
      
      expect(parts).toContain('rotate(45)');
    });
    
    it('should not include rotation when zero', () => {
      const parts = builder.buildTransformString({
        position: [0, 0],
        rotation: 0
      });
      
      expect(parts.join(' ')).not.toContain('rotate');
    });
    
    it('should include scale when not 100%', () => {
      const parts = builder.buildTransformString({
        position: [0, 0],
        scale: [50, 200]
      });
      
      expect(parts).toContain('scale(0.5,2)');
    });
    
    it('should not include scale when 100%', () => {
      const parts = builder.buildTransformString({
        position: [0, 0],
        scale: [100, 100]
      });
      
      expect(parts.join(' ')).not.toContain('scale');
    });
    
    it('should include anchor translate when non-zero', () => {
      const parts = builder.buildTransformString({
        position: [0, 0],
        anchor: [50, 50]
      });
      
      /* Anchor should be negated */
      expect(parts).toContain('translate(-50,-50)');
    });
    
    it('should apply transforms in correct order', () => {
      const parts = builder.buildTransformString({
        position: [100, 100],
        rotation: 45,
        scale: [50, 50],
        anchor: [25, 25]
      });
      
      /* Order: translate(position), rotate, scale, translate(-anchor) */
      expect(parts[0]).toContain('translate(100,100)');
      expect(parts[1]).toContain('rotate');
      expect(parts[2]).toContain('scale');
      expect(parts[3]).toContain('translate(-25,-25)');
    });
    
    it('should handle NaN/Infinity by returning 0', () => {
      const parts = builder.buildTransformString({
        position: [NaN, Infinity]
      });
      
      expect(parts[0]).toBe('translate(0,0)');
    });
    
    it('should round values to 3 decimal places', () => {
      const parts = builder.buildTransformString({
        position: [10.123456789, 20.987654321]
      });
      
      expect(parts[0]).toBe('translate(10.123,20.988)');
    });
  });
});
