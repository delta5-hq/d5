const INTEGRATIONS_COLLECTION = 'integrations'

class ADBuilder {
  buildForLLMField(userId, workflowId, fieldPath) {
    return this.build(INTEGRATIONS_COLLECTION, userId, normalizeWorkflowId(workflowId), fieldPath)
  }

  buildForArrayField(userId, workflowId, arrayName, alias, fieldPath) {
    return this.build(INTEGRATIONS_COLLECTION, userId, normalizeWorkflowId(workflowId), arrayName, alias, fieldPath)
  }

  build(...parts) {
    const totalSize = parts.reduce((sum, part) => sum + 4 + Buffer.byteLength(part, 'utf8'), 0)
    const buffer = Buffer.allocUnsafe(totalSize)

    let offset = 0
    for (const part of parts) {
      const partBytes = Buffer.from(part, 'utf8')
      buffer.writeUInt32BE(partBytes.length, offset)
      offset += 4
      partBytes.copy(buffer, offset)
      offset += partBytes.length
    }

    return buffer
  }
}

function normalizeWorkflowId(workflowId) {
  return workflowId || ''
}

export default new ADBuilder()
