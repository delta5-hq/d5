#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { TgsConverter } from './converter/tgs-converter.js';

interface CliArgs {
  input: string;
  output?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    printUsage();
    process.exit(1);
  }

  const input = args[0];
  const output = args[1];

  return { input, output };
}

function printUsage(): void {
  console.error('Usage: tgs-convert <input.tgs> [output.js]');
}

function main(): void {
  const { input, output } = parseArgs();
  const inputPath = resolve(input);
  const outputPath = output !== undefined && output !== ''
    ? resolve(output) 
    : inputPath.replace(/\.tgs$/, '.player.js');

  const buffer = readFileSync(inputPath);
  const converter = new TgsConverter();
  const result = converter.convertFromBuffer(new Uint8Array(buffer));

  writeFileSync(outputPath, result.code);
  
  console.error(`Converted: ${basename(inputPath)} → ${basename(outputPath)}`);
  console.error(`  Layers: ${result.metadata.layerCount}`);
  console.error(`  Duration: ${result.metadata.duration.toFixed(2)}s`);
  console.error(`  Size: ${result.metadata.originalSize} → ${result.metadata.outputSize} bytes`);
}

main();
