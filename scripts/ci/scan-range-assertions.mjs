#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const RANGE_MATCHERS = [
  'toBeGreaterThan',
  'toBeGreaterThanOrEqual',
  'toBeLessThan',
  'toBeLessThanOrEqual',
]

const GUARDED_MODULE_PATTERNS = [
  /SubtreeForkRunner/,
  /commodityForkMerge/,
  /commodityForkSuccess/,
  /commodityParams/,
  /runCommand/,
]

const TEST_FILE_PATTERN = /\.(test|spec)\.[cm]?[jt]sx?$/
const IGNORED_DIRECTORIES = new Set(['node_modules', 'dist', '.git'])

function collectTestFiles(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry)
    const stat = statSync(full)

    if (stat.isDirectory()) {
      return IGNORED_DIRECTORIES.has(entry) ? [] : collectTestFiles(full)
    }

    return TEST_FILE_PATTERN.test(entry) ? [full] : []
  })
}

function isGuardedModule(modulePath) {
  return GUARDED_MODULE_PATTERNS.some(pattern => pattern.test(modulePath))
}

function addBinding(names, name) {
  if (/^[a-zA-Z_$][\w$]*$/.test(name)) names.add(name)
}

function bindingName(specifier) {
  const trimmed = specifier.trim()
  const esmAlias = trimmed.match(/\s+as\s+([a-zA-Z_$][\w$]*)$/)
  if (esmAlias) return esmAlias[1]

  const commonJsAlias = trimmed.match(/:\s*([a-zA-Z_$][\w$]*)$/)
  if (commonJsAlias) return commonJsAlias[1]

  return trimmed.match(/^([a-zA-Z_$][\w$]*)/)?.[1] ?? ''
}

function addNamedBindings(names, specifiers) {
  specifiers.split(',').forEach(specifier => addBinding(names, bindingName(specifier)))
}

function collectEsmImportBindings(source, names) {
  const namedImportRe = /import\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g
  const defaultImportRe = /import\s+([a-zA-Z_$][\w$]*)\s+from\s+['"]([^'"]+)['"]/g

  for (const match of source.matchAll(namedImportRe)) {
    if (isGuardedModule(match[2])) addNamedBindings(names, match[1])
  }

  for (const match of source.matchAll(defaultImportRe)) {
    if (isGuardedModule(match[2])) addBinding(names, match[1])
  }
}

function collectCommonJsImportBindings(source, names) {
  const requireRe =
    /(?:const|let|var)\s+([a-zA-Z_$][\w$]*|\{[^}]+\})\s*=\s*require\(\s*['"]([^'"]+)['"]\s*\)/g

  for (const match of source.matchAll(requireRe)) {
    if (!isGuardedModule(match[2])) continue

    const binding = match[1].trim()
    if (binding.startsWith('{')) {
      addNamedBindings(names, binding.slice(1, -1))
    } else {
      addBinding(names, binding)
    }
  }
}

function collectImportedGuardedNames(source) {
  const names = new Set()
  collectEsmImportBindings(source, names)
  collectCommonJsImportBindings(source, names)
  return names
}

function collectAliasBindings(source) {
  return source
    .split('\n')
    .map(line => line.match(/^\s*(?:const|let|var)\s+([a-zA-Z_$][\w$]*)\s*=\s*(.+)$/))
    .filter(Boolean)
    .map(match => ({name: match[1], expression: match[2]}))
}

function rootIdentifier(expression) {
  return expression.match(/^\s*([a-zA-Z_$][\w$]*)/)?.[1] ?? null
}

function collectGuardedValueNames(source) {
  const names = collectImportedGuardedNames(source)
  const aliases = collectAliasBindings(source)

  for (let changed = true; changed; ) {
    changed = false
    for (const alias of aliases) {
      const sourceRoot = rootIdentifier(alias.expression)
      if (sourceRoot && names.has(sourceRoot) && !names.has(alias.name)) {
        names.add(alias.name)
        changed = true
      }
    }
  }

  return names
}

function isCommentLine(line) {
  return /^\s*(\/\/|\/\*)/.test(line)
}

function expectRootIdentifier(line) {
  const expectedValue = line.match(/\bexpect\(\s*([a-zA-Z_$][\w$]*(?:\.[\w$]+)*)/)?.[1]
  return expectedValue ? rootIdentifier(expectedValue) : null
}

function findViolations(source, guardedNames) {
  if (guardedNames.size === 0) return []

  const rangePattern = new RegExp(`\\.(${RANGE_MATCHERS.join('|')})\\(`)

  return source
    .split('\n')
    .map((line, index) => ({lineNumber: index + 1, content: line.trim(), raw: line}))
    .filter(line => rangePattern.test(line.raw))
    .filter(line => !isCommentLine(line.raw))
    .filter(line => guardedNames.has(expectRootIdentifier(line.raw)))
}

function reportViolations(scanRoot, filePath, violations) {
  const rel = relative(scanRoot, filePath)
  for (const {lineNumber, content} of violations) {
    console.error(`RANGE-VIOLATION: ${rel}:${lineNumber}`)
    console.error(`  ${content}`)
    console.error(
      `  Range matchers (toBeGreaterThan / toBeLessThan family) are forbidden on fork/call` +
        ` counts imported from guarded modules. Use exact equality (toBe / toHaveBeenCalledTimes).`,
    )
  }
}

const scanRoots = (process.argv.length > 2 ? process.argv.slice(2) : [process.cwd()]).map(root => resolve(root))
let totalViolations = 0

for (const scanRoot of scanRoots) {
  for (const filePath of collectTestFiles(scanRoot)) {
    const source = readFileSync(filePath, 'utf8')
    const violations = findViolations(source, collectGuardedValueNames(source))

    if (violations.length > 0) {
      reportViolations(scanRoot, filePath, violations)
      totalViolations += violations.length
    }
  }
}

if (totalViolations > 0) {
  console.error(`\n${totalViolations} range-assertion violation(s) found.`)
  process.exit(1)
}
