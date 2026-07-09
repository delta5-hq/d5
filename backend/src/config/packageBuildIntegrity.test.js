import fs from 'fs'
import path from 'path'

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts')
const BAKE_SCRIPT = 'bakeVersion.js'

const SRC_DIR = path.resolve(__dirname, '../../src')

const STATIC_ASSET_EXTENSIONS = new Set(['.json', '.yaml', '.yml', '.md', '.txt', '.sql', '.graphql', '.html', '.svg'])
const RELATIVE_IMPORT_RE = /(?:from|require\()\s*['"](\.[^"']+)['"]/g

function isProductionSourceFile(filename) {
  return filename.endsWith('.js') && !filename.includes('.test.') && !filename.includes('.integration.')
}

function staticAssetImports(fileContent, fileDir) {
  return [...fileContent.matchAll(RELATIVE_IMPORT_RE)]
    .map(([, imp]) => imp)
    .filter(imp => STATIC_ASSET_EXTENSIONS.has(path.extname(imp)))
    .map(imp => ({
      asset: path.relative(SRC_DIR, path.resolve(fileDir, imp)),
      importingFile: path.relative(SRC_DIR, fileDir),
    }))
}

function discoverProductionStaticAssets() {
  const found = []
  const walk = dir => {
    for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        walk(full)
        continue
      }
      if (!isProductionSourceFile(entry.name)) continue
      found.push(...staticAssetImports(fs.readFileSync(full, 'utf8'), dir))
    }
  }
  walk(SRC_DIR)
  return found
}

function nodeScriptRefsInCommand(command) {
  return [...command.matchAll(/\bnode\s+scripts\/([\w.-]+\.js)\b/g)].map(m => m[1])
}

describe('package.json build task: bake-script integrity', () => {
  const {scripts} = require('../../package.json')
  const buildCommand = scripts.build ?? ''
  const referencedFiles = nodeScriptRefsInCommand(buildCommand)

  it('build task invokes exactly one node scripts/ entry', () => {
    expect(referencedFiles).toHaveLength(1)
  })

  it('build task references the canonical bake script — rename regression gate', () => {
    expect(referencedFiles).toContain(BAKE_SCRIPT)
  })

  it.each(referencedFiles)('scripts/%s must exist at the package scripts directory', file => {
    expect(fs.existsSync(path.join(SCRIPTS_DIR, file))).toBe(true)
  })
})

describe('package.json build task: no runtime file-copy dependency', () => {
  const {scripts} = require('../../package.json')

  it('build command does not carry --copy-files — production modules must not import non-JS assets', () => {
    expect(scripts.build).not.toContain('--copy-files')
  })
})

describe('production source: no static non-JS asset imports', () => {
  const productionAssets = discoverProductionStaticAssets()

  it('no production module imports a non-JS asset — ensures Babel compilation is self-contained without --copy-files', () => {
    if (productionAssets.length > 0) {
      const report = productionAssets.map(e => `  ${e.importingFile} imports ${e.asset}`).join('\n')
      throw new Error(`Production modules must not import non-JS assets (use inline constants instead):\n${report}`)
    }
    expect(productionAssets).toHaveLength(0)
  })
})

describe('static asset import scanner: RELATIVE_IMPORT_RE coverage', () => {
  it('detects ESM import-from syntax with single quotes', () => {
    const code = "import shapes from './suffixGrammarShapes.json'"
    const matches = [...code.matchAll(RELATIVE_IMPORT_RE)].map(([, imp]) => imp)
    expect(matches).toContain('./suffixGrammarShapes.json')
  })

  it('detects ESM import-from syntax with double quotes', () => {
    const code = 'import data from "./data.yaml"'
    const matches = [...code.matchAll(RELATIVE_IMPORT_RE)].map(([, imp]) => imp)
    expect(matches).toContain('./data.yaml')
  })

  it('detects CJS require() syntax', () => {
    const code = "const x = require('./config.json')"
    const matches = [...code.matchAll(RELATIVE_IMPORT_RE)].map(([, imp]) => imp)
    expect(matches).toContain('./config.json')
  })

  it('does not detect absolute bare module imports — only relative paths are local assets', () => {
    const code = "import x from 'some-package/file.json'"
    const matches = [...code.matchAll(RELATIVE_IMPORT_RE)].map(([, imp]) => imp)
    expect(matches).toHaveLength(0)
  })

  it('does not detect relative JS imports — .js extension is not in the static-asset set', () => {
    const code = "import x from './module.js'"
    const matches = [...code.matchAll(RELATIVE_IMPORT_RE)].map(([, imp]) => imp)
    // regex matches the path; asset filter excludes .js — verify the path is captured but ext is .js
    expect(matches).toContain('./module.js')
    expect(STATIC_ASSET_EXTENSIONS.has(path.extname('./module.js'))).toBe(false)
  })
})

describe('production file classifier: isProductionSourceFile', () => {
  it('classifies plain .js files as production', () => {
    expect(isProductionSourceFile('module.js')).toBe(true)
  })

  it('excludes .test.js files', () => {
    expect(isProductionSourceFile('module.test.js')).toBe(false)
  })

  it('excludes .integration.js files', () => {
    expect(isProductionSourceFile('module.integration.js')).toBe(false)
  })

  it('excludes .integration.test.js files', () => {
    expect(isProductionSourceFile('module.integration.test.js')).toBe(false)
  })

  it('excludes non-.js extensions — TypeScript, JSON, and extension-less files are not production modules', () => {
    expect(isProductionSourceFile('module.ts')).toBe(false)
    expect(isProductionSourceFile('module.json')).toBe(false)
    expect(isProductionSourceFile('module')).toBe(false)
  })
})
