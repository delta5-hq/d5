import type { LottieAnimation } from '../parser/lottie-types.js';
import type { ConversionOptions, ConversionResult } from './types.js';
import { DEFAULT_OPTIONS } from './types.js';
import { decompressTgs } from '../parser/tgs-decompressor.js';
import { extractMetadata } from '../parser/metadata-extractor.js';
import { validateAnimation, sanitizeAnimation } from '../parser/animation-validator.js';
import { generateStandalonePlayer } from '../generator/standalone-generator.js';

export class TgsConverter {
  private readonly options: ConversionOptions;

  constructor(options: Partial<ConversionOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  convertFromBuffer(buffer: Uint8Array): ConversionResult {
    const animation = decompressTgs(buffer);
    return this.convertAnimation(animation, buffer.length);
  }

  convertFromJson(json: string): ConversionResult {
    const animation = JSON.parse(json) as LottieAnimation;
    return this.convertAnimation(animation, json.length);
  }

  private convertAnimation(
    animation: LottieAnimation,
    originalSize: number
  ): ConversionResult {
    const validation = validateAnimation(animation);
    if (!validation.isValid) {
      throw new Error(`Invalid animation: ${validation.errors.join(', ')}`);
    }

    const sanitized = sanitizeAnimation(animation);
    const metadata = extractMetadata(sanitized);
    const code = generateStandalonePlayer(sanitized, this.options);

    return {
      code,
      metadata: {
        originalSize,
        outputSize: code.length,
        layerCount: metadata.layerCount,
        duration: metadata.duration,
      },
    };
  }
}
