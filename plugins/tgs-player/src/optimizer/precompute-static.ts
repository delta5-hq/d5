/**
 * Pre-computes static property values in-place within Lottie JSON.
 * 
 * For properties with a=0 (static), converts:
 *   { a: 0, k: [1, 0.6, 0, 1] }  →  { a: 0, k: "rgb(255,153,0)", _precomputed: true }
 * 
 * TgsPlayer detects _precomputed and uses value directly without conversion.
 */

import type { LottieAnimation } from '../parser/lottie-types.js';

interface PrecomputeStats {
  colorsPrecomputed: number;
  totalStatic: number;
}

/* Convert [r,g,b] or [r,g,b,a] array to CSS rgb/rgba string */
function colorArrayToString(k: number[]): string {
  const r = Math.round(Math.max(0, Math.min(1, k[0])) * 255);
  const g = Math.round(Math.max(0, Math.min(1, k[1])) * 255);
  const b = Math.round(Math.max(0, Math.min(1, k[2])) * 255);
  if (k.length > 3 && k[3] !== 1) {
    const a = Math.max(0, Math.min(1, k[3]));
    return `rgba(${r},${g},${b},${a})`;
  }
  return `rgb(${r},${g},${b})`;
}

/* Check if property looks like a color (array of 3-4 numbers 0-1) */
function isColorArray(k: unknown): k is number[] {
  if (!Array.isArray(k)) return false;
  if (k.length < 3 || k.length > 4) return false;
  return k.every(v => typeof v === 'number' && v >= 0 && v <= 1);
}

/* Recursively walk object and precompute static color values */
function walkAndPrecompute(obj: unknown, stats: PrecomputeStats): void {
  if (obj === null || typeof obj !== 'object') return;
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      walkAndPrecompute(item, stats);
    }
    return;
  }
  
  const record = obj as Record<string, unknown>;
  
  /* Check if this is an animatable property with a=0 (static) */
  if ('a' in record && 'k' in record && record.a === 0) {
    stats.totalStatic++;
    
    /* Precompute color if it's a color array */
    if (isColorArray(record.k)) {
      const precomputed = colorArrayToString(record.k);
      record.k = precomputed;
      record._precomputed = true;
      stats.colorsPrecomputed++;
    }
  }
  
  /* Recurse into all properties */
  for (const key of Object.keys(record)) {
    walkAndPrecompute(record[key], stats);
  }
}

/**
 * Precomputes static values in-place within the animation JSON.
 * Modifies the input object directly.
 */
export function precomputeStaticValues(animation: LottieAnimation): PrecomputeStats {
  const stats: PrecomputeStats = {
    colorsPrecomputed: 0,
    totalStatic: 0
  };
  
  walkAndPrecompute(animation, stats);
  
  return stats;
}
