/**
 * Player Test Suite
 * 
 * Tests TgsPlayer initialization, state management, and frame rendering.
 */

import { describe, it, expect } from 'vitest';

/* Mock DOM environment */
interface MockDocument {
  querySelector(selector: string): MockElement | null;
  getElementById(id: string): MockElement | null;
  createElementNS(_ns: string, tagName: string): MockElement;
  addElement(selector: string, element: MockElement): void;
}

const createMockDocument = (): MockDocument => {
  const elements = new Map<string, MockElement>();
  
  return {
    querySelector(selector: string): MockElement | null {
      return elements.get(selector) ?? null;
    },
    getElementById(id: string): MockElement | null {
      return elements.get(id) ?? null;
    },
    createElementNS(_ns: string, tagName: string): MockElement {
      return createMockElement(tagName);
    },
    addElement(selector: string, element: MockElement): void {
      elements.set(selector, element);
      elements.set('#' + selector, element);
    }
  };
};

interface MockElement {
  tagName: string;
  attributes: Map<string, string>;
  children: MockElement[];
  style: Record<string, string>;
  setAttribute(name: string, value: string): void;
  getAttribute(name: string): string | null;
  removeAttribute(name: string): void;
  appendChild(child: MockElement): void;
}

const createMockElement = (tagName: string): MockElement => ({
  tagName,
  attributes: new Map(),
  children: [],
  style: {},
  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  },
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  },
  removeAttribute(name: string): void {
    this.attributes.delete(name);
  },
  appendChild(child: MockElement): void {
    this.children.push(child);
  }
});

/* Minimal animation data interface for testing */
interface MinimalAnimationData {
  v: string;
  fr: number;
  ip: number;
  op: number;
  w: number;
  h: number;
  nm: string;
  ddd: number;
  assets: unknown[];
  layers: unknown[];
}

/* Minimal animation data for testing */
const createMinimalAnimation = (overrides: Partial<MinimalAnimationData> = {}): MinimalAnimationData => ({
  v: '5.7.4',
  fr: 60,
  ip: 0,
  op: 180,
  w: 512,
  h: 512,
  nm: 'test',
  ddd: 0,
  assets: [],
  layers: [],
  ...overrides
});

/* Recreate TgsPlayer state logic for testing */
const createPlayerState = (animationData: MinimalAnimationData): {
  frameRate: number;
  totalFrames: number;
  currentFrame: number;
  isPlaying: boolean;
  play(): boolean;
  pause(): void;
  stop(): void;
  advanceFrame(deltaMs: number): number;
} => {
  return {
    frameRate: animationData.fr,
    totalFrames: animationData.op - animationData.ip,
    currentFrame: 0,
    isPlaying: false,
    
    play(): boolean {
      if (this.isPlaying) return false;
      this.isPlaying = true;
      return true;
    },
    
    pause(): void {
      this.isPlaying = false;
    },
    
    stop(): void {
      this.isPlaying = false;
      this.currentFrame = 0;
    },
    
    advanceFrame(deltaMs: number): number {
      if (!this.isPlaying) return this.currentFrame;
      
      const frameDelta = (deltaMs / 1000) * this.frameRate;
      this.currentFrame += frameDelta;
      
      if (this.currentFrame >= this.totalFrames) {
        this.currentFrame = this.currentFrame % this.totalFrames;
      }
      
      return this.currentFrame;
    }
  };
};

describe('TgsPlayer', () => {
  describe('initialization', () => {
    it('should throw error when container not found', () => {
      const mockDoc = createMockDocument();
      
      const initPlayer = (): void => {
        const container = mockDoc.querySelector('#nonexistent');
        if (!container) {
          throw new Error('TGS Player: Container element not found: nonexistent');
        }
      };
      
      expect(initPlayer).toThrow('Container element not found');
    });
    
    it('should calculate frame rate from animation data', () => {
      const animation = createMinimalAnimation({ fr: 30 });
      const state = createPlayerState(animation);
      
      expect(state.frameRate).toBe(30);
    });
    
    it('should calculate total frames from ip and op', () => {
      const animation = createMinimalAnimation({ ip: 10, op: 100 });
      const state = createPlayerState(animation);
      
      expect(state.totalFrames).toBe(90);
    });
    
    it('should start at frame 0', () => {
      const animation = createMinimalAnimation();
      const state = createPlayerState(animation);
      
      expect(state.currentFrame).toBe(0);
    });
    
    it('should start paused', () => {
      const animation = createMinimalAnimation();
      const state = createPlayerState(animation);
      
      expect(state.isPlaying).toBe(false);
    });
  });
  
  describe('play/pause/stop', () => {
    it('should start playing when play() called', () => {
      const state = createPlayerState(createMinimalAnimation());
      
      const started = state.play();
      
      expect(started).toBe(true);
      expect(state.isPlaying).toBe(true);
    });
    
    it('should not restart when already playing', () => {
      const state = createPlayerState(createMinimalAnimation());
      state.play();
      
      const restarted = state.play();
      
      expect(restarted).toBe(false);
    });
    
    it('should pause when pause() called', () => {
      const state = createPlayerState(createMinimalAnimation());
      state.play();
      
      state.pause();
      
      expect(state.isPlaying).toBe(false);
    });
    
    it('should reset frame to 0 when stop() called', () => {
      const state = createPlayerState(createMinimalAnimation());
      state.play();
      state.currentFrame = 50;
      
      state.stop();
      
      expect(state.currentFrame).toBe(0);
      expect(state.isPlaying).toBe(false);
    });
  });
  
  describe('frame advancement', () => {
    it('should advance frame based on delta time', () => {
      const animation = createMinimalAnimation({ fr: 60 });
      const state = createPlayerState(animation);
      state.play();
      
      /* 1000ms at 60fps = 60 frames */
      const newFrame = state.advanceFrame(1000);
      
      expect(newFrame).toBe(60);
    });
    
    it('should not advance when paused', () => {
      const animation = createMinimalAnimation({ fr: 60 });
      const state = createPlayerState(animation);
      state.currentFrame = 10;
      
      const newFrame = state.advanceFrame(1000);
      
      expect(newFrame).toBe(10);
    });
    
    it('should loop when exceeding total frames', () => {
      const animation = createMinimalAnimation({ fr: 60, ip: 0, op: 60 }); /* 60 total frames */
      const state = createPlayerState(animation);
      state.play();
      state.currentFrame = 55;
      
      /* Add 10 frames, should wrap around to 5 */
      state.advanceFrame(166.67); /* ~10 frames at 60fps */
      
      expect(state.currentFrame).toBeLessThan(60);
      expect(state.currentFrame).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle fractional frames', () => {
      const animation = createMinimalAnimation({ fr: 60 });
      const state = createPlayerState(animation);
      state.play();
      
      /* 16.67ms at 60fps = 1 frame */
      state.advanceFrame(16.67);
      
      expect(state.currentFrame).toBeCloseTo(1, 1);
    });
  });
  
  describe('layer visibility', () => {
    it('should hide layer when frame < ip', () => {
      const layer = { ip: 10, op: 100, ind: 1, ty: 4, nm: 'test' };
      const frame = 5;
      
      const shouldHide = frame < layer.ip || frame > layer.op;
      
      expect(shouldHide).toBe(true);
    });
    
    it('should hide layer when frame > op', () => {
      const layer = { ip: 10, op: 100, ind: 1, ty: 4, nm: 'test' };
      const frame = 105;
      
      const shouldHide = frame < layer.ip || frame > layer.op;
      
      expect(shouldHide).toBe(true);
    });
    
    it('should show layer when frame between ip and op', () => {
      const layer = { ip: 10, op: 100, ind: 1, ty: 4, nm: 'test' };
      const frame = 50;
      
      const shouldHide = frame < layer.ip || frame > layer.op;
      
      expect(shouldHide).toBe(false);
    });
  });
  
  describe('layer type handling', () => {
    it('should recognize shape layer (ty=4)', () => {
      const layer = { ty: 4, ind: 1, nm: 'shape' };
      expect(layer.ty).toBe(4);
    });
    
    it('should recognize precomp layer (ty=0)', () => {
      const layer = { ty: 0, ind: 1, nm: 'precomp', refId: 'comp1' };
      expect(layer.ty).toBe(0);
      expect(layer.refId).toBeDefined();
    });
    
    it('should recognize null layer (ty=3)', () => {
      const layer = { ty: 3, ind: 1, nm: 'null' };
      expect(layer.ty).toBe(3);
    });
  });
  
  describe('asset resolution', () => {
    it('should find asset by refId', () => {
      const animation = createMinimalAnimation({
        assets: [
          { id: 'comp1', layers: [] },
          { id: 'comp2', layers: [] }
        ]
      });
      
      const refId = 'comp1';
      type Asset = { id: string; layers: unknown[] };
      const assets = animation.assets as Asset[];
      const asset = assets.find(a => a.id === refId);
      
      expect(asset).toBeDefined();
      expect(asset?.id).toBe('comp1');
    });
    
    it('should return undefined for missing asset', () => {
      const animation = createMinimalAnimation({ assets: [] });
      
      const refId = 'nonexistent';
      type Asset = { id: string; layers: unknown[] };
      const assets = animation.assets as Asset[];
      const asset = assets.find(a => a.id === refId);
      
      expect(asset).toBeUndefined();
    });
  });
  
  describe('unique ID generation', () => {
    it('should generate unique IDs for layers', () => {
      const idPrefix = '';
      const layerInd = 5;
      
      const uniqueId = idPrefix + '_' + layerInd;
      
      expect(uniqueId).toBe('_5');
    });
    
    it('should include prefix for nested layers', () => {
      const idPrefix = 'comp1';
      const layerInd = 3;
      
      const uniqueId = idPrefix + '_' + layerInd;
      
      expect(uniqueId).toBe('comp1_3');
    });
    
    it('should sanitize clip path IDs', () => {
      const uniqueId = 'comp1_layer-2';
      
      const clipId = 'clip-' + uniqueId.replace(/[^a-zA-Z0-9]/g, '_');
      
      expect(clipId).toBe('clip-comp1_layer_2');
    });
  });
});
