import {execFileSync} from 'child_process'

export const BWRAP_PATH = '/usr/bin/bwrap'

const detect = () => {
  try {
    execFileSync(BWRAP_PATH, ['--version'], {stdio: 'ignore', timeout: 2000})
    return true
  } catch {
    return false
  }
}

export const bwrapAvailable = detect()
