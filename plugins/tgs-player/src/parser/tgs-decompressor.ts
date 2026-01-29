import { inflate } from 'pako';
import type { LottieAnimation } from './lottie-types.js';

export function decompressTgs(buffer: Uint8Array): LottieAnimation {
  const decompressed = inflate(buffer, { to: 'string' });
  return JSON.parse(decompressed) as LottieAnimation;
}

export function parseLottieJson(json: string): LottieAnimation {
  return JSON.parse(json) as LottieAnimation;
}
