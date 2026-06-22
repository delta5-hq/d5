#!/usr/bin/env node
'use strict'

const {execSync} = require('child_process')
const fs = require('fs')
const path = require('path')

const revisionSh = path.join(__dirname, '../../scripts/revision.sh')
const outputFile = path.join(__dirname, '../build/revision/bakedRevision.js')

function computeRevision() {
  const fromEnv = process.env.BUILD_REVISION
  if (fromEnv) return fromEnv
  try {
    return execSync(`bash ${revisionSh}`, {encoding: 'utf8'}).trim()
  } catch {
    return 'dev'
  }
}

const revision = computeRevision()

fs.mkdirSync(path.dirname(outputFile), {recursive: true})
fs.writeFileSync(
  outputFile,
  `"use strict";\nObject.defineProperty(exports, "__esModule", { value: true });\nexports["default"] = ${JSON.stringify(revision)};\n`,
)

process.stdout.write(`baked revision: ${revision}\n`)
