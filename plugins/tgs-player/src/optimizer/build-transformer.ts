import type { OptimizedBundle } from './bundle-structure-builder.js';
import type { ComputedStaticValue } from './static-value-computer.js';
import type { AnimatedPropertyDescriptor } from './property-analyzer.js';

export interface TransformContext {
  bundle: OptimizedBundle;
  staticValues: ComputedStaticValue[];
  animatedProps: AnimatedPropertyDescriptor[];
}

export interface TransformResult {
  modified: boolean;
  bundle: OptimizedBundle;
}

export type TransformerPlugin = (context: TransformContext) => TransformResult;

export class BuildTransformer {
  private plugins: TransformerPlugin[] = [];

  register(plugin: TransformerPlugin): void {
    this.plugins.push(plugin);
  }

  transform(
    bundle: OptimizedBundle,
    staticValues: ComputedStaticValue[],
    animatedProps: AnimatedPropertyDescriptor[]
  ): OptimizedBundle {
    let current = bundle;
    const context: TransformContext = {
      bundle,
      staticValues,
      animatedProps
    };

    for (const plugin of this.plugins) {
      const result = plugin(context);
      if (result.modified) {
        current = result.bundle;
        context.bundle = current;
      }
    }

    return current;
  }
}
