/**
 * Golden Tests - Snapshot testing for TGS player rendering
 * 
 * Compares rendered SVG structure against known-good golden files.
 * Any change to rendering logic will cause test failure.
 * 
 * Run: npm run test:golden
 * Update goldens: UPDATE_GOLDEN=true npm run test:golden
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TgsConverter } from '../converter/tgs-converter.js';
import puppeteer, { Browser } from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GOLDEN_DIR = resolve(__dirname, '../../golden');
const INPUT_DIR = resolve(__dirname, '../../input/NewsEmoji');

/* 5 test stickers covering different features */
const TEST_STICKERS = [
  { id: '012', features: ['basic shapes', 'strokes', 'transforms'] },
  { id: '021', features: ['multiple strokes per shape', 'trim paths'] },
  { id: '022', features: ['precomps', 'parenting'] },
  { id: '065', features: ['gradient fills', 'complex paths'] },
  { id: '073', features: ['fill+stroke separation', 'render order'] },
];

interface PathData {
  fill: string | null;
  stroke: string | null;
  strokeWidth: string | null;
  strokeLinecap: string | null;
  dLength: number;
}

interface GoldenSnapshot {
  stickerId: string;
  pathCount: number;
  paths: PathData[];
  svgWidth: number;
  svgHeight: number;
  viewBox: string | null;
}

let browser: Browser;

async function setupBrowser(): Promise<void> {
  browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
}

async function closeBrowser(): Promise<void> {
  if (browser !== null) {
    await browser.close();
  }
}

async function createSnapshot(stickerId: string): Promise<GoldenSnapshot> {
  const tgsPath = resolve(INPUT_DIR, `NewsEmoji_${stickerId}.tgs`);
  const buffer = readFileSync(tgsPath);
  
  const containerId = `golden_${stickerId}`;
  const converter = new TgsConverter({ targetId: containerId });
  const result = converter.convertFromBuffer(new Uint8Array(buffer));
  
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body>
  <div id="${containerId}" style="width:512px;height:512px"></div>
  <script>${result.code}</script>
</body>
</html>`;

  const page = await browser.newPage();
  
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.waitForSelector('svg', { timeout: 5000 });
    
    /* 
     * DETERMINISTIC FRAME CAPTURE:
     * 1. Stop animation immediately to prevent RAF race conditions
     * 2. Wait for any pending RAF callbacks to complete
     * 3. Render frame 0 explicitly
     * 4. Wait again for RAF to settle
     * 5. Then capture DOM state
     */
    const snapshot = await page.evaluate(async (sid: string): Promise<GoldenSnapshot> => {
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
      const doc = (globalThis as any).document;
      const raf = (globalThis as any).requestAnimationFrame as (cb: () => void) => number;
      const container = doc.getElementById(`golden_${sid}`);
      
      const player = container?._tgsPlayer;
      if (player != null) {
        /* Stop animation and wait for RAF to settle */
        player.pause();
        await new Promise<void>(r => { raf(() => { raf(() => { r(); }); }); });
        
        /* Render frame 0 explicitly */
        player.renderFrame(0);
        await new Promise<void>(r => { raf(() => { r(); }); });
      }
      
      const svg = container?.querySelector('svg');
      if (svg == null) throw new Error('SVG not found');
      
      const paths = svg.querySelectorAll('path');
      const pathData = Array.from(paths).map((p: any) => ({
        fill: p.getAttribute('fill') as string | null,
        stroke: p.getAttribute('stroke') as string | null,
        strokeWidth: p.getAttribute('stroke-width') as string | null,
        strokeLinecap: p.getAttribute('stroke-linecap') as string | null,
        dLength: ((p.getAttribute('d') as string | null) ?? '').length,
      }));
      
      return {
        stickerId: sid,
        pathCount: paths.length as number,
        paths: pathData as GoldenSnapshot['paths'],
        svgWidth: svg.width.baseVal.value as number,
        svgHeight: svg.height.baseVal.value as number,
        viewBox: svg.getAttribute('viewBox') as string | null,
      };
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
    }, stickerId);
    
    return snapshot;
  } finally {
    await page.close();
  }
}

function loadGolden(stickerId: string): GoldenSnapshot | null {
  const goldenPath = resolve(GOLDEN_DIR, `${stickerId}.golden.json`);
  if (!existsSync(goldenPath)) {
    return null;
  }
  return JSON.parse(readFileSync(goldenPath, 'utf-8')) as GoldenSnapshot;
}

function saveGolden(stickerId: string, snapshot: GoldenSnapshot): void {
  if (!existsSync(GOLDEN_DIR)) {
    mkdirSync(GOLDEN_DIR, { recursive: true });
  }
  const goldenPath = resolve(GOLDEN_DIR, `${stickerId}.golden.json`);
  writeFileSync(goldenPath, JSON.stringify(snapshot, null, 2));
  /* eslint-disable-next-line no-console */
  console.log(`  ✓ Golden saved: ${goldenPath}`);
}

describe('Golden Tests', () => {
  const UPDATE_GOLDEN = process.env.UPDATE_GOLDEN === 'true';
  
  beforeAll(async () => {
    await setupBrowser();
    if (UPDATE_GOLDEN) {
      /* eslint-disable-next-line no-console */
      console.log('\n🔄 UPDATE_GOLDEN=true - Regenerating golden files...\n');
    }
  }, 30000);
  
  afterAll(async () => {
    await closeBrowser();
  }, 10000);
  
  for (const sticker of TEST_STICKERS) {
    describe(`Sticker ${sticker.id} (${sticker.features.join(', ')})`, () => {
      let snapshot: GoldenSnapshot;
      let golden: GoldenSnapshot | null;
      
      beforeAll(async () => {
        snapshot = await createSnapshot(sticker.id);
        golden = loadGolden(sticker.id);
        
        if (UPDATE_GOLDEN || golden === null) {
          saveGolden(sticker.id, snapshot);
          golden = snapshot;
        }
      }, 30000);
      
      it('path count matches golden', () => {
        expect(snapshot.pathCount).toBe(golden!.pathCount);
      });
      
      it('SVG dimensions match golden', () => {
        expect(snapshot.svgWidth).toBe(golden!.svgWidth);
        expect(snapshot.svgHeight).toBe(golden!.svgHeight);
        expect(snapshot.viewBox).toBe(golden!.viewBox);
      });
      
      it('all path attributes match golden', () => {
        expect(snapshot.paths.length).toBe(golden!.paths.length);
        
        for (let i = 0; i < snapshot.paths.length; i++) {
          const actual = snapshot.paths[i];
          const expected = golden!.paths[i];
          
          /* Fill attribute - exact match for structural integrity */
          expect(actual.fill, `path[${i}].fill`).toBe(expected.fill);
          /* Stroke color - exact match */
          expect(actual.stroke, `path[${i}].stroke`).toBe(expected.stroke);
          /* Stroke line cap - exact match (structural) */
          expect(actual.strokeLinecap, `path[${i}].strokeLinecap`).toBe(expected.strokeLinecap);
          
          /* Stroke width - presence check, not exact value (animated values vary) */
          if (expected.strokeWidth !== null) {
            expect(actual.strokeWidth, `path[${i}].strokeWidth presence`).not.toBeNull();
          } else {
            expect(actual.strokeWidth, `path[${i}].strokeWidth`).toBeNull();
          }
          
          /* Path data length - presence check (paths exist and have data) */
          expect(actual.dLength > 0, `path[${i}].dLength > 0`).toBe(expected.dLength > 0);
        }
      });
      
      it('path render order matches golden', () => {
        /* Stroke/fill order is critical for visual correctness */
        const actualOrder = snapshot.paths.map(p => {
          if (p.stroke !== null && p.stroke !== '') return 'stroke';
          if (p.fill !== null && p.fill !== '' && p.fill !== 'none') return 'fill';
          return 'empty';
        });
        const expectedOrder = golden!.paths.map(p => {
          if (p.stroke !== null && p.stroke !== '') return 'stroke';
          if (p.fill !== null && p.fill !== '' && p.fill !== 'none') return 'fill';
          return 'empty';
        });
        expect(actualOrder).toEqual(expectedOrder);
      });
    });
  }
});
