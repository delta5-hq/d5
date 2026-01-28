import type { LottieAnimation } from '../parser/lottie-types.js';

export function serializeAnimationData(animation: LottieAnimation): string {
  return JSON.stringify(animation, null, 2);
}
