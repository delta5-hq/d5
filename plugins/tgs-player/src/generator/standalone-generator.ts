import type { LottieAnimation } from '../parser/lottie-types.js';
import type { ConversionOptions } from '../converter/types.js';
import { generateRuntimeCode } from './runtime-bundler.js';
import { serializeAnimationData } from './data-serializer.js';

export function generateStandalonePlayer(
  animation: LottieAnimation,
  options: ConversionOptions
): string {
  const runtimeCode = generateRuntimeCode();
  const animationData = serializeAnimationData(animation);

  return assembleOutput(runtimeCode, animationData, options);
}

function assembleOutput(
  runtime: string,
  data: string,
  options: ConversionOptions
): string {
  const targetSelector = options.targetId ?? 'tgs-player';

  return `(function() {
${runtime}

const animationData = ${data};

const player = new TgsPlayer(animationData, '${targetSelector}');
player.play();
})();`;
}
