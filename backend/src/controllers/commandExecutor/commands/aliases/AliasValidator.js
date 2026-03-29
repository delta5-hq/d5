import {
  validateAlias as validateSingleAlias,
  validateFormat as validateAliasFormat,
  validateNotBuiltIn as validateAliasNotBuiltIn,
  AliasValidationError,
} from './aliasValidation'

export {AliasValidationError}

export class AliasValidator {
  validateFormat(alias) {
    validateAliasFormat(alias)
  }

  validateNotBuiltIn(alias) {
    validateAliasNotBuiltIn(alias)
  }

  validateAlias(alias) {
    validateSingleAlias(alias)
  }

  validateNoDuplicatesInArray(aliases, integrationType) {
    const seen = new Set()
    for (const config of aliases) {
      if (seen.has(config.alias)) {
        throw new AliasValidationError(
          `Duplicate alias '${config.alias}' found in ${integrationType} integrations`,
          'DUPLICATE_IN_ARRAY',
          config.alias,
        )
      }
      seen.add(config.alias)
    }
  }

  validateNoCrossDuplicates(mcpAliases, rpcAliases) {
    const mcpSet = new Set(mcpAliases.map(c => c.alias))
    for (const rpcConfig of rpcAliases) {
      if (mcpSet.has(rpcConfig.alias)) {
        throw new AliasValidationError(
          `Alias '${rpcConfig.alias}' exists in both MCP and RPC integrations`,
          'DUPLICATE_ACROSS_TYPES',
          rpcConfig.alias,
        )
      }
    }
  }

  validateIntegrationArrays(mcpAliases = [], rpcAliases = []) {
    for (const config of mcpAliases) {
      this.validateAlias(config.alias)
    }

    for (const config of rpcAliases) {
      this.validateAlias(config.alias)
    }

    this.validateNoDuplicatesInArray(mcpAliases, 'MCP')
    this.validateNoDuplicatesInArray(rpcAliases, 'RPC')
    this.validateNoCrossDuplicates(mcpAliases, rpcAliases)
  }
}

export default new AliasValidator()
