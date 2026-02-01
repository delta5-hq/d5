/**
 * Extract composable parts from base genie:
 * 1. Radial flash (single flash, frames 32-58) - FULL layers with all animations
 * 2. Eyes blink (single blink cycle) - with proper positioning
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { execSync } from 'node:child_process'

const inputPath = process.argv[2] || 'base-genie.json'
const outputDir = process.argv[3] || '.'

const baseGenie = JSON.parse(readFileSync(inputPath, 'utf-8'))

/* Deep clone and shift all keyframe times by offset */
function shiftKeyframes(obj: any, offset: number): any {
  if (obj === null || typeof obj !== 'object') return obj
  
  if (Array.isArray(obj)) {
    return obj.map(item => shiftKeyframes(item, offset))
  }
  
  const result: any = {}
  for (const key in obj) {
    if (key === 't' && typeof obj[key] === 'number') {
      /* Shift keyframe time */
      result[key] = obj[key] - offset
    } else {
      result[key] = shiftKeyframes(obj[key], offset)
    }
  }
  return result
}

/* Extract radial flash - layers with ip=32, op=58 (first flash burst) */
/* Preserve ALL animations: position, trim paths, opacity, etc. */
function extractRadialFlash() {
  const flashLayers = baseGenie.layers.filter(
    (l: any) => l.nm?.startsWith('Shape Layer') && l.ip === 32 && l.op === 58
  )
  
  console.log(`Found ${flashLayers.length} flash layers`)
  
  /* Deep clone and shift all timing to start at frame 0 */
  const shiftedLayers = flashLayers.map((layer: any) => {
    const shifted = shiftKeyframes(JSON.parse(JSON.stringify(layer)), 32)
    shifted.ip = 0
    shifted.op = 26 // 58 - 32
    shifted.st = 0  // Start time also shifts
    return shifted
  })
  
  const flash = {
    tgs: 1,
    v: baseGenie.v,
    fr: baseGenie.fr,
    ip: 0,
    op: 26,
    w: baseGenie.w,
    h: baseGenie.h,
    nm: 'Radial Flash',
    ddd: 0,
    assets: [],
    layers: shiftedLayers
  }
  
  return flash
}

/* Extract eyes with single blink - face + eyes only, centered in canvas */
function extractEyesBlink() {
  const eyeLayers = baseGenie.layers.filter((l: any) => l.nm === 'eye')
  const faceLayer = baseGenie.layers.find((l: any) => l.nm === 'face')
  
  console.log(`Found ${eyeLayers.length} eye layers, face: ${faceLayer ? 'yes' : 'no'}`)
  
  /* Clone eyes - remove parent reference since face will be root */
  const clonedEyes = eyeLayers.map((layer: any) => {
    const cloned = JSON.parse(JSON.stringify(layer))
    cloned.ip = 0
    cloned.op = 30
    cloned.parent = 4 /* Keep parent to face */
    
    /* Trim shape keyframes to first blink cycle */
    if (cloned.shapes?.[0]?.it?.[0]?.ks?.k && Array.isArray(cloned.shapes[0].it[0].ks.k)) {
      cloned.shapes[0].it[0].ks.k = cloned.shapes[0].it[0].ks.k.filter(
        (kf: any) => kf.t <= 30
      )
      /* Add final keyframe if needed */
      const lastKf = cloned.shapes[0].it[0].ks.k[cloned.shapes[0].it[0].ks.k.length - 1]
      if (lastKf && lastKf.t < 30) {
        cloned.shapes[0].it[0].ks.k.push({ ...lastKf, t: 30 })
      }
    }
    
    return cloned
  })
  
  /* Clone face null - center it in canvas (256, 256) with no parent */
  let clonedFace = null
  if (faceLayer) {
    clonedFace = JSON.parse(JSON.stringify(faceLayer))
    clonedFace.ip = 0
    clonedFace.op = 30
    delete clonedFace.parent /* Remove parent reference to head */
    
    /* Set static centered position */
    clonedFace.ks.p = { a: 0, k: [256, 256, 0] }
  }
  
  /* Build layers array - face first (as parent null), then eyes */
  const layers = clonedFace ? [clonedFace, ...clonedEyes] : clonedEyes
  
  const eyes = {
    tgs: 1,
    v: baseGenie.v,
    fr: baseGenie.fr,
    ip: 0,
    op: 30,
    w: baseGenie.w,
    h: baseGenie.h,
    nm: 'Eyes Blink',
    ddd: 0,
    assets: [],
    layers
  }
  
  return eyes
}

/* Save extracted components */
const flash = extractRadialFlash()
const eyes = extractEyesBlink()

writeFileSync(`${outputDir}/radial-flash.json`, JSON.stringify(flash, null, 2))
writeFileSync(`${outputDir}/eyes-blink.json`, JSON.stringify(eyes, null, 2))

console.log(`Extracted radial-flash.json (${flash.layers.length} layers, ${flash.op} frames)`)
console.log(`Extracted eyes-blink.json (${eyes.layers.length} layers, ${eyes.op} frames)`)

/* Generate .tgs files */
execSync(`gzip -c ${outputDir}/radial-flash.json > ${outputDir}/radial-flash.tgs`)
execSync(`gzip -c ${outputDir}/eyes-blink.json > ${outputDir}/eyes-blink.tgs`)

console.log('Generated .tgs files')
