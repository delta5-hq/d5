export const SYSTEM_DIRS = Object.freeze([
  '/usr',
  '/lib',
  '/lib64',
  '/lib32',
  '/opt',
  '/etc/ssl',
  '/etc/resolv.conf',
  '/etc/nsswitch.conf',
])

export const buildSystemDirArgs = existsSync => SYSTEM_DIRS.filter(existsSync).flatMap(dir => ['--ro-bind', dir, dir])
