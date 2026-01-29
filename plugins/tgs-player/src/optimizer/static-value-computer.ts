import type { LottieAnimation } from '../parser/lottie-types.js';
import type { StaticProperty } from './property-analyzer.js';

export interface ComputedStaticValue {
  path: string;
  originalValue: unknown;
  computedValue: unknown;
  format: 'css-color' | 'svg-path' | 'transform-matrix' | 'number' | 'raw';
}

export class StaticValueComputer {
  compute(_animation: LottieAnimation, staticProps: StaticProperty[]): ComputedStaticValue[] {
    return staticProps.map(prop => this.computeProperty(prop));
  }

  private computeProperty(prop: StaticProperty): ComputedStaticValue {
    switch (prop.type) {
      case 'color':
        return this.computeColor(prop);
      case 'opacity':
        return this.computeOpacity(prop);
      case 'transform':
        return this.computeTransform(prop);
      case 'path':
        return this.computePath(prop);
      default:
        return {
          path: prop.path,
          originalValue: prop.value,
          computedValue: prop.value,
          format: 'raw'
        };
    }
  }

  private computeColor(prop: StaticProperty): ComputedStaticValue {
    const value = prop.value as number[] | undefined;
    if (value === null || value === undefined || !Array.isArray(value) || value.length < 3) {
      return {
        path: prop.path,
        originalValue: value,
        computedValue: 'transparent',
        format: 'css-color'
      };
    }

    const r = Math.round((value[0] ?? 0) * 255);
    const g = Math.round((value[1] ?? 0) * 255);
    const b = Math.round((value[2] ?? 0) * 255);
    const a = value.length > 3 ? value[3] ?? 1 : 1;

    const cssColor = a < 1 
      ? `rgba(${r},${g},${b},${a})` 
      : `rgb(${r},${g},${b})`;

    return {
      path: prop.path,
      originalValue: value,
      computedValue: cssColor,
      format: 'css-color'
    };
  }

  private computeOpacity(prop: StaticProperty): ComputedStaticValue {
    const value = prop.value as number | undefined;
    const normalized = (value ?? 100) / 100;

    return {
      path: prop.path,
      originalValue: value,
      computedValue: normalized,
      format: 'number'
    };
  }

  private computeTransform(prop: StaticProperty): ComputedStaticValue {
    const value = prop.value;
    
    if (Array.isArray(value) && value.length === 2) {
      const x = typeof value[0] === 'number' ? value[0] : 0;
      const y = typeof value[1] === 'number' ? value[1] : 0;
      return {
        path: prop.path,
        originalValue: value,
        computedValue: { x, y },
        format: 'transform-matrix'
      };
    }
    
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if ('x' in obj && 'y' in obj) {
        return {
          path: prop.path,
          originalValue: value,
          computedValue: value,
          format: 'transform-matrix'
        };
      }
    }
    
    return {
      path: prop.path,
      originalValue: value,
      computedValue: value,
      format: 'raw'
    };
  }

  private computePath(prop: StaticProperty): ComputedStaticValue {
    const value = prop.value;
    
    if (typeof value !== 'object' || value === null) {
      return {
        path: prop.path,
        originalValue: value,
        computedValue: value,
        format: 'raw'
      };
    }
    
    const pathData = value as Record<string, unknown>;
    if (!('i' in pathData && 'o' in pathData && 'v' in pathData)) {
      return {
        path: prop.path,
        originalValue: value,
        computedValue: value,
        format: 'raw'
      };
    }
    
    const vertices = pathData.v as number[][];
    const inPoints = pathData.i as number[][];
    const outPoints = pathData.o as number[][];
    const closed = pathData.c === true;
    
    let svgPath = '';
    
    if (vertices.length > 0) {
      const [x0, y0] = vertices[0] ?? [0, 0];
      svgPath = `M${x0},${y0}`;
      
      for (let i = 1; i < vertices.length; i++) {
        const [x, y] = vertices[i] ?? [0, 0];
        const [ox, oy] = outPoints[i - 1] ?? [0, 0];
        const [ix, iy] = inPoints[i] ?? [0, 0];
        const [px, py] = vertices[i - 1] ?? [0, 0];
        
        svgPath += ` C${px + ox},${py + oy} ${x + ix},${y + iy} ${x},${y}`;
      }
      
      if (closed && vertices.length > 0) {
        const [x0, y0] = vertices[0] ?? [0, 0];
        const [ox, oy] = outPoints[vertices.length - 1] ?? [0, 0];
        const [ix, iy] = inPoints[0] ?? [0, 0];
        const [px, py] = vertices[vertices.length - 1] ?? [0, 0];
        
        svgPath += ` C${px + ox},${py + oy} ${x0 + ix},${y0 + iy} ${x0},${y0}Z`;
      }
    }
    
    return {
      path: prop.path,
      originalValue: value,
      computedValue: svgPath,
      format: 'svg-path'
    };
  }
}
