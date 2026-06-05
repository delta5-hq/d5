import {existsSync} from 'fs'
import {execFileSync} from 'child_process'
import {buildBwrapArgs} from './bwrapArgBuilder'
import {buildSystemDirArgs} from './systemDirBinds'

export const BWRAP_PATH = '/usr/bin/bwrap'
export const BWRAP_PROBE_TIMEOUT_MS = 2000

export const buildSandboxCapabilityProbeArgs = fileExists =>
  buildBwrapArgs('node', ['-e', 'process.exit(0)'], {
    systemDirArgs: buildSystemDirArgs(fileExists),
    bindPaths: [],
    allowNetwork: true,
  })

const detect = () => {
  try {
    execFileSync(BWRAP_PATH, buildSandboxCapabilityProbeArgs(existsSync), {
      stdio: 'ignore',
      timeout: BWRAP_PROBE_TIMEOUT_MS,
      env: process.env,
    })
    return true
  } catch {
    return false
  }
}

export const bwrapAvailable = detect()
