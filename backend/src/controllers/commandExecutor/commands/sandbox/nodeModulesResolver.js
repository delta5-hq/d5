import path from 'path'

const NODE_COMMANDS = new Set(['node', 'node-jiti'])
const SCRIPT_EXTENSIONS = new Set(['.js', '.cjs', '.mjs'])
const CO_LOCATED_RESOURCE_DIRS = ['shared-contracts']

const findScriptArg = args => (args ?? []).find(a => SCRIPT_EXTENSIONS.has(path.extname(a)))

const resolveScriptPath = scriptArg => (path.isAbsolute(scriptArg) ? scriptArg : path.resolve(process.cwd(), scriptArg))

const walkUpForNodeModules = (startDir, existsSync) => {
  const results = []
  let dir = startDir
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (existsSync(path.join(dir, 'node_modules'))) results.push(dir)
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return results
}

const collectCoLocatedResourceDirs = (dirsWithNodeModules, resourceDirNames, existsSync) =>
  dirsWithNodeModules.flatMap(dir => resourceDirNames.map(name => path.join(dir, name)).filter(existsSync))

export const resolveNodeCommandBindPaths = (command, args, existsSync) => {
  if (!NODE_COMMANDS.has(command)) return []

  const scriptArg = findScriptArg(args)
  if (!scriptArg) return []

  const scriptPath = resolveScriptPath(scriptArg)
  if (!existsSync(scriptPath)) return []

  const scriptDir = path.dirname(scriptPath)
  const dirsWithNodeModules = walkUpForNodeModules(scriptDir, existsSync)

  if (dirsWithNodeModules.length === 0) return [scriptDir]

  const [projectRoot, ...ancestorRoots] = dirsWithNodeModules
  const ancestorNodeModuleDirs = ancestorRoots.map(d => path.join(d, 'node_modules'))
  const coLocatedResourceDirs = collectCoLocatedResourceDirs(dirsWithNodeModules, CO_LOCATED_RESOURCE_DIRS, existsSync)

  return [projectRoot, ...ancestorNodeModuleDirs, ...coLocatedResourceDirs]
}
