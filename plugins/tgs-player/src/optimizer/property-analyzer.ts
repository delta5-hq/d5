import type { LottieAnimation, AnimatedProperty } from '../parser/lottie-types.js';

export interface PropertyClassification {
  static: StaticProperty[];
  animated: AnimatedPropertyDescriptor[];
}

export interface StaticProperty {
  path: string;
  value: unknown;
  type: 'color' | 'opacity' | 'transform' | 'path' | 'other';
}

export interface AnimatedPropertyDescriptor {
  path: string;
  value: unknown;
  type: 'color' | 'opacity' | 'transform' | 'path' | 'other';
}

export class PropertyAnalyzer {
  classify(animation: LottieAnimation): PropertyClassification {
    const result: PropertyClassification = {
      static: [],
      animated: []
    };

    this.traverseProperties(animation, '', result);
    return result;
  }

  private traverseProperties(
    obj: unknown,
    path: string,
    result: PropertyClassification
  ): void {
    if (obj === null || obj === undefined || typeof obj !== 'object') return;

    if (this.isAnimatedProperty(obj)) {
      const prop = obj as AnimatedProperty;
      const type = this.classifyPropertyType(path, prop.k);
      
      if (prop.a === 0) {
        result.static.push({
          path,
          value: prop.k,
          type
        });
      } else {
        result.animated.push({
          path,
          value: prop.k,
          type
        });
      }
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        this.traverseProperties(item, `${path}[${index}]`, result);
      });
    } else {
      for (const [key, value] of Object.entries(obj)) {
        this.traverseProperties(value, path ? `${path}.${key}` : key, result);
      }
    }
  }

  private isAnimatedProperty(obj: unknown): boolean {
    if (obj === null || obj === undefined || typeof obj !== 'object') return false;
    const prop = obj as Record<string, unknown>;
    
    if (!('a' in prop && 'k' in prop)) return false;
    
    const a = prop.a;
    if (typeof a !== 'number') return false;
    if (a !== 0 && a !== 1) return false;
    
    return true;
  }

  private classifyPropertyType(path: string, value: unknown): StaticProperty['type'] {
    if (this.isColorValue(value)) return 'color';
    if (this.isOpacityValue(value, path)) return 'opacity';
    if (this.isTransformValue(value)) return 'transform';
    if (this.isPathValue(value)) return 'path';
    return 'other';
  }

  private isColorValue(value: unknown): boolean {
    if (!Array.isArray(value)) return false;
    if (value.length < 3 || value.length > 4) return false;
    return value.every(v => typeof v === 'number' && v >= 0 && v <= 1);
  }

  private isOpacityValue(value: unknown, path: string): boolean {
    if (typeof value !== 'number') return false;
    return path.endsWith('.o') || path.includes('.o.k');
  }

  private isTransformValue(value: unknown): boolean {
    if (Array.isArray(value)) {
      return value.length === 2 && value.every(v => typeof v === 'number');
    }
    if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      return ('x' in obj && 'y' in obj) || ('a' in obj && 'k' in obj);
    }
    return false;
  }

  private isPathValue(value: unknown): boolean {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return 'i' in obj && 'o' in obj && 'v' in obj;
  }
}
