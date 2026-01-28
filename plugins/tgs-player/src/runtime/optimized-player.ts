import type { OptimizedBundle } from '../optimizer/index.js';

export const OPTIMIZED_PLAYER_CODE = `
class OptimizedTgsPlayer {
  constructor(bundle, containerId) {
    this.bundle = bundle;
    this.containerId = containerId;
    
    const stickerId = containerId.replace('o', '');
    const animIndex = ['012', '021', '022', '065', '073'].indexOf(stickerId);
    
    if (animIndex >= 0 && window.TgsAnimations && window.TgsAnimations[animIndex]) {
      this.player = new TgsPlayer(window.TgsAnimations[animIndex].data, containerId);
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
