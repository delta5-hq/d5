/**
 * TGS Decompressor Test Suite
 * 
 * Tests gzip decompression of TGS files and JSON parsing.
 * Uses real TGS files from input directory.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decompressTgs, parseLottieJson } from '../tgs-decompressor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INPUT_DIR = resolve(__dirname, '../../../input/NewsEmoji');

describe('decompressTgs', () => {
  it('should decompress valid TGS file', () => {
    const tgsPath = resolve(INPUT_DIR, 'NewsEmoji_012.tgs');
    const buffer = readFileSync(tgsPath);
    const animation = decompressTgs(new Uint8Array(buffer));
    
    expect(animation).toBeDefined();
    expect(animation.v).toBeDefined();
    expect(animation.layers).toBeInstanceOf(Array);
  });

  it('should extract animation metadata', () => {
    const tgsPath = resolve(INPUT_DIR, 'NewsEmoji_012.tgs');
    const buffer = readFileSync(tgsPath);
    const animation = decompressTgs(new Uint8Array(buffer));
    
    expect(animation.w).toBe(512);
    expect(animation.h).toBe(512);
    expect(animation.fr).toBe(60);
    expect(animation.ip).toBe(0);
    expect(animation.op).toBeGreaterThan(0);
  });

  it('should extract layers', () => {
    const tgsPath = resolve(INPUT_DIR, 'NewsEmoji_012.tgs');
    const buffer = readFileSync(tgsPath);
    const animation = decompressTgs(new Uint8Array(buffer));
    
    expect(animation.layers.length).toBeGreaterThan(0);
    expect(animation.layers[0]).toHaveProperty('ty');
    expect(animation.layers[0]).toHaveProperty('ks');
  });

  it('should handle complex sticker with gradients', () => {
    const tgsPath = resolve(INPUT_DIR, 'NewsEmoji_065.tgs');
    const buffer = readFileSync(tgsPath);
    const animation = decompressTgs(new Uint8Array(buffer));
    
    expect(animation).toBeDefined();
    expect(animation.layers.length).toBeGreaterThan(0);
  });

  it('should throw on invalid gzip data', () => {
    const invalidBuffer = new Uint8Array([0, 1, 2, 3]);
    expect(() => decompressTgs(invalidBuffer)).toThrow();
  });
});

describe('parseLottieJson', () => {
  it('should parse valid Lottie JSON', () => {
    const json = JSON.stringify({
      v: '5.7.4',
      fr: 60,
      ip: 0,
      op: 180,
      w: 512,
      h: 512,
      nm: 'test',
      ddd: 0,
      assets: [],
      layers: []
    });
    
    const animation = parseLottieJson(json);
    
    expect(animation.v).toBe('5.7.4');
    expect(animation.fr).toBe(60);
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseLottieJson('not valid json')).toThrow();
  });

  it('should handle minimal animation', () => {
    const json = JSON.stringify({
      v: '5.0',
      fr: 30,
      ip: 0,
      op: 60,
      w: 100,
      h: 100,
      nm: 'minimal',
      ddd: 0,
      assets: [],
      layers: []
    });
    
    const animation = parseLottieJson(json);
    expect(animation.layers).toEqual([]);
  });
});
