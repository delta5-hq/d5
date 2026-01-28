import type { LottieAnimation } from './lottie-types.js';

export interface TgsParseResult {
  animation: LottieAnimation;
  metadata: AnimationMetadata;
}

export interface AnimationMetadata {
  name: string;
  duration: number;
  frameRate: number;
  totalFrames: number;
  width: number;
  height: number;
  layerCount: number;
  isTgs: boolean;
}

export function extractMetadata(animation: LottieAnimation): AnimationMetadata {
  return {
    name: animation.nm,
    duration: (animation.op - animation.ip) / animation.fr,
    frameRate: animation.fr,
    totalFrames: animation.op - animation.ip,
    width: animation.w,
    height: animation.h,
    layerCount: animation.layers.length,
    isTgs: animation.tgs === 1,
  };
}
