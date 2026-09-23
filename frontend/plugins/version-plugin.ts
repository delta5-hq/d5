import { execSync } from 'node:child_process'
import path from 'node:path'
import type { Plugin } from 'vite'

export const VERSION_ENDPOINT = '/version'
export const VERSION_SENTINEL = 'dev'

function versionFromScript(scriptPath: string): string {
  try {
    return execSync(`bash "${scriptPath}"`, { encoding: 'utf8' }).trim()
  } catch {
    return VERSION_SENTINEL
  }
}

export function computeVersion(scriptPath: string): string {
  return process.env['BUILD_VERSION'] || versionFromScript(scriptPath)
}

// Never writes to public/ — keeps the working-tree hash stable between build and probe.
export function versionPlugin(): Plugin {
  const scriptPath = path.join(__dirname, '..', '..', 'scripts', 'version.sh')
  const version = computeVersion(scriptPath)
  const body = JSON.stringify({ version }) + '\n'

  return {
    name: 'version-endpoint',

    config() {
      return { define: { __BUILD_VERSION__: JSON.stringify(version) } }
    },

    configureServer(server) {
      server.middlewares.use(VERSION_ENDPOINT, (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(body)
      })
    },

    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version', source: body })
    },
  }
}
