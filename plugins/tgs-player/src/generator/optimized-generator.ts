import { Optimizer, type OptimizationResult } from '../optimizer/index.js';
import { generateRuntimeCode } from './runtime-bundler.js';
import { serializeAnimationData } from './data-serializer.js';
import type { LottieAnimation } from '../parser/lottie-types.js';

export interface OptimizedOutput {
  /* Single bundled JS with runtime + data embedded */
  code: string;
  stats: OptimizationResult['stats'];
}

export function generateOptimizedBundle(animation: LottieAnimation): OptimizedOutput {
  const optimizer = new Optimizer();
  const result = optimizer.optimize(animation);
  
  /* 
   * MVP: Use same runtime and original animation data
   * The optimizer stats show HOW MUCH could be pre-computed
   * Actual pre-computation of static values: TODO
   */
  const runtimeCode = generateRuntimeCode();
  const animationData = serializeAnimationData(animation);
  
  const code = `(function() {
${runtimeCode}

const animationData = ${animationData};

/* Optimization stats: ${result.stats.staticPropsCount} static, ${result.stats.animatedPropsCount} animated */

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
