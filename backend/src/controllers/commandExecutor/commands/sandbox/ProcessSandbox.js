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

export const sandboxSpawn = (command, args, env, {allowNetwork = false} = {}) => {
  if (!bwrapAvailable) throw new SandboxUnavailableError()

  const systemDirArgs = buildSystemDirArgs(existsSync)
  const bindPaths = resolveNodeCommandBindPaths(command, args, existsSync)

  return {
    command: BWRAP_PATH,
    args: buildBwrapArgs(command, args, {systemDirArgs, bindPaths, allowNetwork}),
    env,
  }
}

export const isSandboxActive = () => bwrapAvailable
