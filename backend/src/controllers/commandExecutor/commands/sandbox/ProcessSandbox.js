import {existsSync} from 'fs'
import {bwrapAvailable, BWRAP_PATH} from './bwrapDetector'
import {buildSystemDirArgs} from './systemDirBinds'
import {resolveNodeCommandBindPaths} from './nodeModulesResolver'
import {buildBwrapArgs} from './bwrapArgBuilder'

export const sandboxSpawn = (command, args, env) => {
  if (!bwrapAvailable) return {command, args: args ?? [], env}

  const systemDirArgs = buildSystemDirArgs(existsSync)
  const bindPaths = resolveNodeCommandBindPaths(command, args, existsSync)

  return {
    command: BWRAP_PATH,
    args: buildBwrapArgs(command, args, {systemDirArgs, bindPaths}),
    env,
  }
}

export const isSandboxActive = () => bwrapAvailable
