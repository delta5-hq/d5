import { BEZIER_EASER_CODE } from '../runtime/bezier-easer.js';
import { INTERPOLATOR_CODE } from '../runtime/interpolator.js';
import { SVG_BUILDER_CODE } from '../runtime/svg-builder.js';
import { PLAYER_CODE } from '../runtime/player.js';

export function generateRuntimeCode(): string {
  return [
    BEZIER_EASER_CODE,
    INTERPOLATOR_CODE,
    SVG_BUILDER_CODE,
    PLAYER_CODE,
  ].join('\n\n');
}
