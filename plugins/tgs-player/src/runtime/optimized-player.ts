import type { OptimizedBundle } from '../optimizer/index.js';

export const OPTIMIZED_PLAYER_CODE = `
class OptimizedTgsPlayer {
  constructor(bundle, containerId) {
    this.bundle = bundle;
    this.containerId = containerId;
    
    // TEMPORARY: For MVP, fetch the original animation data
    // and use TgsPlayer directly. Real implementation needs
    // to reconstruct from bundle.staticInit + bundle.animatedProps
    
    const stickerId = containerId.replace('o', '');
    const animIndex = ['012', '021', '022', '065', '073'].indexOf(stickerId);
    
    if (animIndex >= 0 && window.TgsAnimations && window.TgsAnimations[animIndex]) {
      console.log('[OptimizedTgsPlayer] Using original animation data for', stickerId);
      this.player = new TgsPlayer(window.TgsAnimations[animIndex].data, containerId);
    } else {
      console.error('[OptimizedTgsPlayer] Animation data not found for', stickerId);
    }
  }
  
  play() {
    if (this.player && this.player.play) {
      this.player.play();
    }
  }
  
  pause() {
    if (this.player && this.player.pause) {
      this.player.pause();
    }
  }
  
  stop() {
    if (this.player && this.player.stop) {
      this.player.stop();
    }
  }
}
`;

export interface OptimizedPlayerBundle {
  runtime: string;
  bundle: OptimizedBundle;
}

export function generateOptimizedRuntimeCode(): string {
  return OPTIMIZED_PLAYER_CODE;
}
