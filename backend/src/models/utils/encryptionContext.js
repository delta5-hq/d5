class EncryptionContextValidator {
  static validate(context) {
    if (!context) {
      return null
    }

    if (typeof context !== 'object') {
      throw new Error('Encryption context must be an object')
    }

    const {userId, workflowId} = context

    if (!userId || typeof userId !== 'string') {
      throw new Error('Encryption context requires valid userId')
    }

    if (workflowId !== null && workflowId !== undefined && typeof workflowId !== 'string') {
      throw new Error('Encryption context workflowId must be string, null, or undefined')
    }

    return {
      userId,
      workflowId: workflowId || null,
    }
  }
}

class ADContextBuilder {
  constructor(adBuilder) {
    this.adBuilder = adBuilder
  }

  buildForLLMField(context, fieldPath) {
    if (!context) {
      return null
    }

    const {userId, workflowId} = context
    return this.adBuilder.buildForLLMField(userId, workflowId, fieldPath)
  }

  buildForArrayField(context, arrayName, alias, fieldPath) {
    if (!context) {
      return null
    }

    if (!alias || typeof alias !== 'string') {
      throw new Error(`Array item in '${arrayName}' missing required alias field`)
    }

    const {userId, workflowId} = context
    return this.adBuilder.buildForArrayField(userId, workflowId, arrayName, alias, fieldPath)
  }
}

export {EncryptionContextValidator, ADContextBuilder}
