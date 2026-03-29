export class EnvironmentValidator {
  constructor(requiredVars = ['D5_USER_ID']) {
    this.requiredVars = requiredVars
  }

  validate() {
    const missing = this.requiredVars.filter(varName => !process.env[varName])

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }
  }

  getUserId() {
    return process.env.D5_USER_ID
  }
}
