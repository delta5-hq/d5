import { execSync } from 'node:child_process'
import path from 'node:path'
import type { Plugin } from 'vite'

export const REVISION_ENDPOINT = '/revision'
export const REVISION_SENTINEL = 'dev'

function revisionFromScript(scriptPath: string): string {
  try {
    return execSync(`bash "${scriptPath}"`, { encoding: 'utf8' }).trim()
  } catch {
    return REVISION_SENTINEL
  }
}

export function computeRevision(scriptPath: string): string {
  return process.env['BUILD_REVISION'] || revisionFromScript(scriptPath)
}

// Never writes to public/ — keeps the working-tree hash stable between build and probe.
export function revisionPlugin(): Plugin {
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'revision.sh')
  const revision = computeRevision(scriptPath)
  const body = JSON.stringify({ revision }) + '\n'

  return {
    name: 'revision-endpoint',

    config() {
      return { define: { __BUILD_REVISION__: JSON.stringify(revision) } }
    },

    configureServer(server) {
      server.middlewares.use(REVISION_ENDPOINT, (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(body)
      })
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'revision', source: body })
    },
  }
}
