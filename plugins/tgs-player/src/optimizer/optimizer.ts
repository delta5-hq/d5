import type { LottieAnimation } from '../parser/lottie-types.js';
import type { OptimizedBundle } from './bundle-structure-builder.js';
import { PropertyAnalyzer } from './property-analyzer.js';
import { StaticValueComputer } from './static-value-computer.js';
import { BundleStructureBuilder } from './bundle-structure-builder.js';
import { BuildTransformer } from './build-transformer.js';
import type { TransformerPlugin } from './build-transformer.js';

export interface OptimizerOptions {
  plugins?: TransformerPlugin[];
  verbose?: boolean;
}

export interface OptimizationResult {
  bundle: OptimizedBundle;
  stats: OptimizationStats;
}

export interface OptimizationStats {
  originalSize: number;
  optimizedSize: number;
  staticPropsCount: number;
  animatedPropsCount: number;
  compressionRatio: number;
}

export class Optimizer {
  private analyzer = new PropertyAnalyzer();
  private computer = new StaticValueComputer();
  private builder = new BundleStructureBuilder();
  private transformer = new BuildTransformer();

  constructor(options?: OptimizerOptions) {
    if (options?.plugins !== null && options?.plugins !== undefined) {
      for (const plugin of options.plugins) {
        this.transformer.register(plugin);
      }
    }
  }

  optimize(animation: LottieAnimation): OptimizationResult {
    const classification = this.analyzer.classify(animation);
    
    const computedValues = this.computer.compute(animation, classification.static);
    
    let bundle = this.builder.build(animation, classification, computedValues);
    
    bundle = this.transformer.transform(bundle, computedValues, classification.animated);
    
    const originalSize = JSON.stringify(animation).length;
    const optimizedSize = JSON.stringify(bundle).length;
    
    return {
      bundle,
      stats: {
        originalSize,
        optimizedSize,
        staticPropsCount: classification.static.length,
        animatedPropsCount: classification.animated.length,
        compressionRatio: originalSize > 0 ? optimizedSize / originalSize : 0
      }
    };
  }
}
