#!/usr/bin/env node
'use strict'

const {execSync} = require('child_process')
const fs = require('fs')
const path = require('path')

const versionSh = path.join(__dirname, '../../scripts/version.sh')
const outputFile = path.join(__dirname, '../build/version/bakedVersion.js')

function computeVersion() {
  const fromEnv = process.env.BUILD_VERSION
  if (fromEnv) return fromEnv
  try {
    return execSync(`bash ${versionSh}`, {encoding: 'utf8'}).trim()
  } catch {
    return 'dev'
  }
}

const version = computeVersion()

fs.mkdirSync(path.dirname(outputFile), {recursive: true})
fs.writeFileSync(
  outputFile,
  `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports["default"] = ${JSON.stringify(version)};\n`,
)

process.stdout.write(`baked version: ${version}\n`)
