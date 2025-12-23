import log from 'loglevel'

/* Feature-level logger factory matching backend-v2 pattern */
export const createLogger = (prefix: string) => {
  const upperPrefix = prefix.toUpperCase()

  return {
    info: (message: string, ...args: unknown[]) => {
      log.info(`[${upperPrefix}] ${message}`, ...args)
    },

    debug: (message: string, ...args: unknown[]) => {
      log.debug(`[${upperPrefix}] ${message}`, ...args)
    },

    warn: (message: string, ...args: unknown[]) => {
      log.warn(`[${upperPrefix}] ${message}`, ...args)
    },

    error: (message: string, ...args: unknown[]) => {
      log.error(`[${upperPrefix}] ERROR: ${message}`, ...args)
    },
  }
}
