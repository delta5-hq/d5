#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename, dirname } from 'node:path';
import { TgsConverter } from './converter/tgs-converter.js';

interface CliArgs {
  input: string;
  output?: string | undefined;
  targetId?: string | undefined;
}

function generateIndexHtml(playerJsFile: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>TGS Player</title>
  <style>
    body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a1a; }
    #tgs-player { width: 512px; height: 512px; background: white; border-radius: 8px; }
  </style>
</head>
<body>
  <div id="tgs-player"></div>
  <script src="${playerJsFile}"></script>
</body>
</html>`;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  let input = '';
  let output: string | undefined;
  let targetId: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' && i + 1 < args.length) {
      output = args[i + 1];
      i++;
    } else if (args[i] === '--target' && i + 1 < args.length) {
      targetId = args[i + 1];
      i++;
    } else if (input === undefined || input === '') {
      input = args[i];
    } else if (output === undefined || output === '') {
      /* Second positional argument is output */
      output = args[i];
    }
  }

  if (input === undefined || input === '') {
    printUsage();
    process.exit(1);
  }

  return { input, output, targetId };
}

function printUsage(): void {
  /* eslint-disable-next-line no-console */
  console.error('Usage: tgs-convert <input.tgs> [output.js] [--target <id>]');
}

function main(): void {
  const { input, output, targetId } = parseArgs();
  const inputPath = resolve(input);
  const outputPath = output !== undefined && output !== ''
    ? resolve(output) 
    : inputPath.replace(/\.tgs$/, '.player.js');

  const buffer = readFileSync(inputPath);
  const options = targetId !== undefined && targetId !== '' ? { targetId } : {};
  const converter = new TgsConverter(options);
  const result = converter.convertFromBuffer(new Uint8Array(buffer));

  writeFileSync(outputPath, result.code);
  
  /* Generate index.html in same directory */
  const outputDir = dirname(outputPath);
  const indexPath = resolve(outputDir, 'index.html');
  writeFileSync(indexPath, generateIndexHtml(basename(outputPath)));
  
  /* eslint-disable no-console */
  console.error(`Converted: ${basename(inputPath)} → ${basename(outputPath)}`);
  console.error(`  Layers: ${result.metadata.layerCount}`);
  console.error(`  Duration: ${result.metadata.duration.toFixed(2)}s`);
  console.error(`  Size: ${result.metadata.originalSize} → ${result.metadata.outputSize} bytes`);
  /* eslint-enable no-console */
}

main();
