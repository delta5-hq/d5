import { BEZIER_EASER_CODE } from '../runtime/bezier-easer.js';
import { INTERPOLATOR_CODE } from '../runtime/interpolator.js';
import { SVG_BUILDER_CODE } from '../runtime/svg-builder.js';
import { PLAYER_CODE } from '../runtime/player.js';
import { DEBUG_LOGGER_CODE } from '../runtime/debug-logger.js';
import { TRIM_PATHS_CODE } from '../runtime/trim-paths.js';
import { GRADIENT_BUILDER_CODE } from '../runtime/gradient-builder.js';
import { TRANSFORM_CALCULATOR_CODE } from '../runtime/transform-calculator.js';
import { STROKE_ORDER_DETECTOR_CODE } from '../runtime/stroke-order-detector.js';
import { SHAPE_COLLECTOR_CODE } from '../runtime/shape-collector.js';
import { PATH_ELEMENT_FACTORY_CODE } from '../runtime/path-element-factory.js';
import { GROUP_BUILDER_CODE } from '../runtime/group-builder.js';

export function generateRuntimeCode(): string {
  return [
    DEBUG_LOGGER_CODE,
    BEZIER_EASER_CODE,
    INTERPOLATOR_CODE,
    SVG_BUILDER_CODE,
    TRIM_PATHS_CODE,
    GRADIENT_BUILDER_CODE,
    TRANSFORM_CALCULATOR_CODE,
    STROKE_ORDER_DETECTOR_CODE,
    SHAPE_COLLECTOR_CODE,
    PATH_ELEMENT_FACTORY_CODE,
    GROUP_BUILDER_CODE,
    PLAYER_CODE,
  ].join('\n\n');
}
