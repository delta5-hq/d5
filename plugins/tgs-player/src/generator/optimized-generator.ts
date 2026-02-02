import { Optimizer, type OptimizationResult } from '../optimizer/index.js';
import { generateRuntimeCode } from './runtime-bundler.js';
import { serializeAnimationData } from './data-serializer.js';
import type { LottieAnimation } from '../parser/lottie-types.js';

export interface OptimizedOutput {
  code: string;
  stats: OptimizationResult['stats'];
}

export function generateOptimizedBundle(animation: LottieAnimation): OptimizedOutput {
  const optimizer = new Optimizer();
  const result = optimizer.optimize(animation);
  
  const runtimeCode = generateRuntimeCode();
  const animationData = serializeAnimationData(animation);
  
  const code = `(function() {
${runtimeCode}

const animationData = ${animationData};

if (typeof window !== 'undefined') {
  window.TgsPlayer = TgsPlayer;
  window.TgsAnimations = window.TgsAnimations || [];
  window.TgsAnimations.push({ id: 'optimized', data: animationData, type: 'optimized' });
}
})();`;
  
  return {
    code,
    stats: result.stats
  };
}
