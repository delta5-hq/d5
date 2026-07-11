export class CommandStringBuilder {
  buildCommandString(params) {
    const flags = []

    if (params?.lang) {
      flags.push(`--lang=${params.lang}`)
    }

    if (params?.citations) {
      flags.push('--citations')
    }

    if (params?.maxChunks) {
      flags.push(`--max-chunks=${params.maxChunks}`)
    }

    if (params?.minYear) {
      flags.push(`--min-year=${params.minYear}`)
    }

    if (params?.context) {
      flags.push(`--context=${params.context}`)
    }

    return flags.length > 0 ? flags.join(' ') : ''
  }

  buildSyntheticNode(params) {
    const commandString = this.buildCommandString(params)
    return commandString ? {command: commandString} : null
  }
}
