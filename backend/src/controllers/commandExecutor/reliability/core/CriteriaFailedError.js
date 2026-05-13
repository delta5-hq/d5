export class CriteriaFailedError extends Error {
  constructor(criterion, attempts) {
    super(`/validate exhausted ${attempts} attempt(s): ${criterion}`)
    this.name = 'CriteriaFailedError'
    this.criterion = criterion
    this.attempts = attempts
  }
}
