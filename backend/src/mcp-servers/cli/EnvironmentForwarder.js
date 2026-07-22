export class EnvironmentForwarder {
  getEnvironment() {
    return {...process.env}
  }
}
