/**
 * Pre-computes static property values in-place within Lottie JSON.
 * 
 * For properties with a=0 (static), converts:
 *   { a: 0, k: [1, 0.6, 0, 1] }  →  { a: 0, k: "rgb(255,153,0)", _precomputed: true }
 * 
 * Runtime detects _precomputed flag and uses value directly.
 */

import type { LottieAnimation } from '../parser/lottie-types.js';

interface PrecomputeStats {
  colorsPrecomputed: number;
  totalStatic: number;
}

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

function isColorArray(k: unknown): k is number[] {
  if (!Array.isArray(k)) return false;
  if (k.length < 3 || k.length > 4) return false;
  return k.every(v => typeof v === 'number' && v >= 0 && v <= 1);
}

function walkAndPrecompute(obj: unknown, stats: PrecomputeStats): void {
  if (obj === null || typeof obj !== 'object') return;
  
  if (Array.isArray(obj)) {
    for (const item of obj) {
      walkAndPrecompute(item, stats);
    }
    return;
  }
  
  const record = obj as Record<string, unknown>;
  
  if ('a' in record && 'k' in record && record.a === 0) {
    stats.totalStatic++;
    
    if (isColorArray(record.k)) {
      const precomputed = colorArrayToString(record.k);
      record.k = precomputed;
      record._precomputed = true;
      stats.colorsPrecomputed++;
    }
  }
  
  for (const key of Object.keys(record)) {
    walkAndPrecompute(record[key], stats);
  }
}

export function precomputeStaticValues(animation: LottieAnimation): PrecomputeStats {
  const stats: PrecomputeStats = {
    colorsPrecomputed: 0,
    totalStatic: 0
  };
  
  walkAndPrecompute(animation, stats);
  
  return stats;
}
