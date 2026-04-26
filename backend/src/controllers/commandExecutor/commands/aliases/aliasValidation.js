import {queryCommands} from '../../constants/commandRegExp'

export const VALID_ALIAS_PATTERN = /^\/[a-zA-Z][a-zA-Z0-9_-]*$/
export const BUILT_IN_COMMANDS = new Set(queryCommands)

export class AliasValidationError extends Error {
  constructor(message, code, alias) {
    super(message)
    this.name = 'AliasValidationError'
    this.code = code
    this.alias = alias
  }
}

export const validateFormat = alias => {
  if (!alias || typeof alias !== 'string') {
    throw new AliasValidationError('Alias must be a non-empty string', 'INVALID_FORMAT', alias)
  }

  if (!alias.startsWith('/')) {
    throw new AliasValidationError('Alias must start with /', 'MISSING_SLASH', alias)
  }

  if (!VALID_ALIAS_PATTERN.test(alias)) {
    throw new AliasValidationError(
      'Alias must contain only letters, numbers, hyphens, and underscores after the leading slash',
      'INVALID_CHARACTERS',
      alias,
    )
  }
}

export const validateNotBuiltIn = alias => {
  if (BUILT_IN_COMMANDS.has(alias)) {
    throw new AliasValidationError(`Alias '${alias}' conflicts with a built-in command`, 'RESERVED_COMMAND', alias)
  }
}

export const validateAlias = alias => {
  validateFormat(alias)
  validateNotBuiltIn(alias)
}

export const isValidAlias = alias => {
  try {
    validateAlias(alias)
    return true
  } catch (error) {
    if (error instanceof AliasValidationError) {
      return false
    }
    throw error
  }
}
