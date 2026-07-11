import {existsSync} from 'fs'
import {bwrapAvailable, BWRAP_PATH} from './bwrapDetector'
import {buildSystemDirArgs} from './systemDirBinds'
import {resolveNodeCommandBindPaths} from './nodeModulesResolver'
import {buildBwrapArgs} from './bwrapArgBuilder'

export class SandboxUnavailableError extends Error {
  constructor() {
    super('bwrap is not available — subprocess sandbox is required but cannot be activated')
    this.name = 'SandboxUnavailableError'
  }
}

// Secure by default: the subprocess sandbox is REQUIRED. A trusted environment that
// cannot provide unprivileged user namespaces (e.g. CI on a runner without userns,
// spawning fixed in-repo test fixtures) may explicitly opt out with
// D5_ALLOW_UNSANDBOXED_SPAWN=true. Production never sets it, so its behaviour is
// unchanged and the sandbox requirement cannot be silently lost.
const unsandboxedSpawnAllowed = () => process.env.D5_ALLOW_UNSANDBOXED_SPAWN === 'true'

export const sandboxSpawn = (command, args, env, {allowNetwork = false} = {}) => {
  if (!bwrapAvailable) {
    if (!unsandboxedSpawnAllowed()) throw new SandboxUnavailableError()
    console.warn(
      `[sandbox] bwrap unavailable and D5_ALLOW_UNSANDBOXED_SPAWN=true — spawning "${command}" without a sandbox (trusted-environment override)`,
    )
    return {command, args: args ?? [], env}
  }

  const systemDirArgs = buildSystemDirArgs(existsSync)
  const bindPaths = resolveNodeCommandBindPaths(command, args, existsSync)

  return {
    command: BWRAP_PATH,
    args: buildBwrapArgs(command, args, {systemDirArgs, bindPaths, allowNetwork}),
    env,
  }
}

export const isSandboxActive = () => bwrapAvailable
