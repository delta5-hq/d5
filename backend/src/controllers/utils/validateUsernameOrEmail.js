const usernameOrEmailPattern = /\s/
const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\.[a-zA-Z]{2,})?$/u

export const isInvalidUsernameOrEmail = str => {
  return usernameOrEmailPattern.test(str)
}

export const isValidEmail = str => {
  return emailPattern.test(str)
}
