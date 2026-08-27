import fs from 'fs'
import path from 'path'

// Covers command handlers and reliability core — the user-facing execution paths
// where ad-hoc console.log leaks into server stdout and obscures structured logging.
// NOTE: src/controllers/utils/ contains pre-existing violations in legacy files
// (getThumbnail.js, messureTime.js) and is excluded until those are resolved.
const SOURCE_ROOTS = [__dirname, path.resolve(__dirname, '../reliability')]

const isSourceFile = filePath => filePath.endsWith('.js') && !filePath.endsWith('.test.js')

const sourceFilesUnder = root => {
  const entries = fs.readdirSync(root, {withFileTypes: true})

  return entries.flatMap(entry => {
    const entryPath = path.join(root, entry.name)
    if (entry.isDirectory()) return sourceFilesUnder(entryPath)
    return isSourceFile(entryPath) ? [entryPath] : []
  })
}

const relativeFile = filePath => path.relative(path.resolve(__dirname, '../../..'), filePath)

describe('command handler logging invariants', () => {
  it('user-facing command handlers and reliability code do not emit ad-hoc console.log traces', () => {
    const offenders = SOURCE_ROOTS.flatMap(sourceFilesUnder)
      .map(filePath => ({
        filePath,
        source: fs.readFileSync(filePath, 'utf8'),
      }))
      .filter(({source}) => /console\.log\s*\(/.test(source))
      .map(({filePath}) => relativeFile(filePath))

    expect(offenders).toEqual([])
  })
})
