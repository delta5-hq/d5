export const SAFE_ENV_KEYS = Object.freeze([
  'PATH',
  'HOME',
  'TMPDIR',
  'TEMP',
  'TMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'SHELL',
  'TERM',
  'USER',
  'LOGNAME',
  'TZ',
])

export const safeSystemEnv = () =>
  Object.fromEntries(SAFE_ENV_KEYS.flatMap(k => (process.env[k] !== undefined ? [[k, process.env[k]]] : [])))
