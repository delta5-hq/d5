import type { LottieAnimation, LottieLayer, ShapeElement } from './lottie-types.js';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateAnimation(animation: unknown): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(animation)) {
    errors.push('Animation must be an object');
    return { isValid: false, errors, warnings };
  }

  const anim = animation as Partial<LottieAnimation>;

  if (typeof anim.fr !== 'number' || anim.fr <= 0) {
    errors.push('Invalid frame rate');
  }

  if (typeof anim.w !== 'number' || anim.w <= 0) {
    errors.push('Invalid width');
  }

  if (typeof anim.h !== 'number' || anim.h <= 0) {
    errors.push('Invalid height');
  }

  if (!Array.isArray(anim.layers)) {
    errors.push('Missing layers array');
  } else if (anim.layers.length === 0) {
    warnings.push('Animation has no layers');
  }

  if (typeof anim.ip !== 'number' || typeof anim.op !== 'number') {
    errors.push('Invalid in/out points');
  } else if (anim.op <= anim.ip) {
    errors.push('Out point must be greater than in point');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

export function sanitizeAnimation(animation: LottieAnimation): LottieAnimation {
  return {
    ...animation,
    layers: animation.layers.map(sanitizeLayer),
    assets: animation.assets ?? [],
  };
}

function sanitizeLayer(layer: LottieLayer): LottieLayer {
  return {
    ...layer,
    shapes: layer.shapes?.map(sanitizeShape) ?? [],
  };
}

function sanitizeShape(shape: ShapeElement): ShapeElement {
  const sanitized: ShapeElement = {
    ...shape,
  };
  
  if (shape.it !== undefined) {
    sanitized.it = shape.it.map(sanitizeShape);
  }
  
  return sanitized;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
