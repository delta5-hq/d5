import type { LottieAnimation } from '../parser/lottie-types.js';
import type { PropertyClassification, AnimatedPropertyDescriptor } from './property-analyzer.js';
import type { ComputedStaticValue } from './static-value-computer.js';

export interface OptimizedBundle {
  version: string;
  staticInit: Record<string, unknown>;
  animatedProps: AnimatedPropertyDescriptor[];
  metadata: BundleMetadata;
}

export interface BundleMetadata {
  originalSize: number;
  staticCount: number;
  animatedCount: number;
  compressionRatio: number;
}

export class BundleStructureBuilder {
  build(
    animation: LottieAnimation,
    classification: PropertyClassification,
    computedValues: ComputedStaticValue[]
  ): OptimizedBundle {
    const staticInit = this.buildStaticInit(computedValues);
    const animatedProps = this.buildAnimatedProps(classification.animated);
    const metadata = this.buildMetadata(animation, classification, computedValues);

    return {
      version: '1.0.0-optimized',
      staticInit,
      animatedProps,
      metadata
    };
  }

  private buildStaticInit(computedValues: ComputedStaticValue[]): Record<string, unknown> {
    const init: Record<string, unknown> = {};

    for (const computed of computedValues) {
      const pathParts = computed.path.split('.');
      let current = init;

      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (part === null || part === undefined) continue;

        if (current[part] === null || current[part] === undefined) {
          current[part] = {};
        }
        current = current[part] as Record<string, unknown>;
      }

      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart !== null && lastPart !== undefined) {
        current[lastPart] = computed.computedValue;
      }
    }

    return init;
  }

  private buildAnimatedProps(animatedProps: PropertyClassification['animated']): AnimatedPropertyDescriptor[] {
    return animatedProps;
  }

  private buildMetadata(
    animation: LottieAnimation,
    classification: PropertyClassification,
    computedValues: ComputedStaticValue[]
  ): BundleMetadata {
    const originalSize = JSON.stringify(animation).length;
    const optimizedSize = JSON.stringify(computedValues).length;

    return {
      originalSize,
      staticCount: classification.static.length,
      animatedCount: classification.animated.length,
      compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 0
    };
  }
}
