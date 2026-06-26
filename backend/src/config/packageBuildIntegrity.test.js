import fs from 'fs'
import path from 'path'

const SCRIPTS_DIR = path.resolve(__dirname, '../../scripts')
const BAKE_SCRIPT = 'bakeVersion.js'

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
